import Fastify, {
  LogController,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import fastifyCompress from "@fastify/compress";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppError, isDbError, isJsonParserError } from "./lib/errors.js";
import { sendFastifyError } from "./lib/apiEnvelope.js";
import { redactHeaders, redactQuery } from "./lib/logRedaction.js";
import { appLogger } from "./lib/logger.js";
import { incrementAuthFailure, isAuthFailureCode, observeHttpRequestDuration } from "./lib/metrics.js";
import { env } from "./lib/env.js";
import { incrementRefreshFailure } from "./lib/metrics.js";
import { buildPermissionsPolicyHeaderValue } from "./lib/permissionsPolicy.js";
import { refreshEndpointRoute } from "./appCore/paths.js";
import {
  readFastifyRequestPath,
  readOrCreateRequestId,
  setCorsHeaders,
} from "./fastify/expressCompat.js";
import { registerFastifyApiRoutes } from "./fastify/registerRoutes.js";
import {
  buildManifestPageCspHeaderValue,
  manifestPageFileName,
} from "./appCore/publicPages.js";
import {
  apiDocsAssetsPath,
  apiDocsIndexPath,
  apiDocsJsonPath,
  apiDocsPath,
  readSwaggerUiHtml,
  swaggerUiDistPath,
} from "./lib/swaggerUI.js";
import { openApiSpec } from "./lib/openapi-spec.js";
import { maxMediaFileBytes } from "./modules/news/media.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const clientDistPath = path.resolve(currentDir, "../../client/dist");
const uploadsPath = path.resolve(currentDir, "../uploads");
const manifestPageCspHeader = buildManifestPageCspHeaderValue();
const permissionsPolicyHeader = buildPermissionsPolicyHeaderValue();

type FastifyRequestWithMeta = FastifyRequest & {
  pcpRequestId?: string;
  pcpRequestStartedAt?: bigint;
};

function buildCspHeaderValue(): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'self'"],
    "img-src": ["'self'", "data:", "https:"],
    "font-src": ["'self'", "https:", "data:"],
    "style-src": ["'self'", "https:"],
    "script-src": ["'self'", "https://challenges.cloudflare.com"],
    "frame-src": ["'self'", "https://challenges.cloudflare.com"],
    "connect-src": ["'self'", "https://challenges.cloudflare.com"],
    "script-src-attr": ["'none'"],
  };

  if (env.forceHttpsUpgrade) {
    directives["upgrade-insecure-requests"] = [];
  }

  return Object.entries(directives)
    .map(([key, values]) => (values.length > 0 ? `${key} ${values.join(" ")}` : key))
    .join(";");
}

function shouldRecordRefreshFailure(route: string): boolean {
  return route === refreshEndpointRoute;
}


function applySecurityHeaders(reply: FastifyReply, cspHeader: string): void {
  reply.header("Content-Security-Policy", cspHeader);
  reply.header("Cross-Origin-Opener-Policy", "same-origin");
  reply.header("Cross-Origin-Resource-Policy", "same-origin");
  reply.header("Origin-Agent-Cluster", "?1");
  reply.header("Referrer-Policy", "no-referrer");
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-DNS-Prefetch-Control", "off");
  reply.header("X-Download-Options", "noopen");
  reply.header("X-Frame-Options", "SAMEORIGIN");
  reply.header("X-Permitted-Cross-Domain-Policies", "none");
  reply.header("X-XSS-Protection", "0");
  reply.header("Permissions-Policy", permissionsPolicyHeader);

  if (env.forceHttpsUpgrade) {
    reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

function readOriginHeader(request: FastifyRequest): string {
  const header = request.headers.origin as string | string[] | undefined;
  if (typeof header === "string") {
    return header.trim();
  }

  if (Array.isArray(header) && typeof header[0] === "string") {
    return header[0].trim();
  }

  return "";
}

function resolveCorsOrigin(request: FastifyRequest): string {
  if (env.corsOrigins.includes("*")) {
    return "*";
  }

  const origin = readOriginHeader(request);
  if (origin && env.corsOrigins.includes(origin)) {
    return origin;
  }

  // Do not fall back to a default origin. If the request origin is not allowlisted,
  // omit CORS headers entirely.
  return "";
}

function resolveLogLevel(statusCode: number): "info" | "warn" | "error" {
  if (statusCode >= 500) {
    return "error";
  }
  if (statusCode >= 400) {
    return "warn";
  }
  return "info";
}

function isFastifyJsonBodyError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return code === "FST_ERR_CTP_INVALID_JSON_BODY";
}

async function registerFastifyApiDocs(fastify: FastifyInstance): Promise<void> {
  fastify.get(apiDocsPath, async (_request, reply) => {
    reply.redirect(apiDocsIndexPath);
  });

  fastify.get(apiDocsIndexPath, async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    reply.type("text/html; charset=utf-8").send(readSwaggerUiHtml());
  });

  fastify.get(apiDocsJsonPath, async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    reply.send(openApiSpec);
  });

  await fastify.register(fastifyStatic, {
    root: swaggerUiDistPath,
    prefix: `${apiDocsAssetsPath}/`,
    decorateReply: false,
    index: false,
    setHeaders: (reply) => {
      reply.header("Cache-Control", "public, max-age=3600");
    },
  });
}

export async function createFastifyServer(): Promise<FastifyInstance> {
  const cspHeader = buildCspHeaderValue();
  const fastify = Fastify({
    logger: false,
    trustProxy: env.trustProxy,
    // Default limit. Handlers should still validate payload shape/size.
    bodyLimit: 1024 * 1024,
    logController: new LogController({ disableRequestLogging: true }),
  });

  fastify.addHook("onRequest", async (request, reply) => {
    const req = request as FastifyRequestWithMeta;
    req.pcpRequestStartedAt = process.hrtime.bigint();

    const incomingRequestIdHeader = request.headers["x-request-id"];
    const incomingRequestId = typeof incomingRequestIdHeader === "string"
      ? incomingRequestIdHeader
      : Array.isArray(incomingRequestIdHeader)
        ? incomingRequestIdHeader[0]
        : undefined;

    const requestId = readOrCreateRequestId(request, incomingRequestId);
    req.pcpRequestId = requestId;
    reply.header("X-Request-Id", requestId);

    applySecurityHeaders(reply, cspHeader);

    const corsOrigin = resolveCorsOrigin(request);
    if (corsOrigin) {
      setCorsHeaders(request, reply, corsOrigin);
    }
  });

  fastify.addHook("onSend", async (request, reply, payload) => {
    if (readFastifyRequestPath(request) === `/${manifestPageFileName}`) {
      reply.header("Cache-Control", "no-store");
      reply.header("Content-Security-Policy", manifestPageCspHeader);
    }

    return payload;
  });

  fastify.addHook("onResponse", async (request, reply) => {
    const req = request as FastifyRequestWithMeta;
    const startedAt = req.pcpRequestStartedAt ?? process.hrtime.bigint();
    const elapsedSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    const routePath = readFastifyRequestPath(request);

    observeHttpRequestDuration({
      method: request.method,
      route: routePath,
      statusCode: reply.statusCode,
      durationSeconds: elapsedSeconds,
    });

    const logLevel = resolveLogLevel(reply.statusCode);
    appLogger[logLevel](
      {
        req: {
          id: request.id,
          method: request.method,
          url: request.url,
          query: redactQuery(request.query),
          params: request.params,
          headers: redactHeaders(request.headers as unknown as Record<string, unknown>),
          remoteAddress: request.ip,
          remotePort: request.raw.socket.remotePort,
        },
        res: {
          statusCode: reply.statusCode,
          headers: redactHeaders(reply.getHeaders() as unknown as Record<string, unknown>),
        },
        requestId: req.pcpRequestId ?? "unknown",
        responseTime: Math.round(elapsedSeconds * 1000),
      },
      "request completed"
    );
  });

  fastify.setErrorHandler((error, request, reply) => {
    const req = request as FastifyRequestWithMeta;
    const requestId = req.pcpRequestId ?? "unknown";
    const requestPath = readFastifyRequestPath(request);

    if (error instanceof AppError) {
      if (isAuthFailureCode(error.code)) {
        incrementAuthFailure(error.code, requestPath);
      }
      if (shouldRecordRefreshFailure(requestPath)) {
        incrementRefreshFailure(error.code);
      }

      const logMethod = error.status >= 500 ? appLogger.error.bind(appLogger) : appLogger.warn.bind(appLogger);
      logMethod(
        {
          requestId,
          code: error.code,
          status: error.status,
          err: error,
        },
        "Business error handled"
      );
      sendFastifyError(reply, requestId, error.status, error.code, error.message);
      return;
    }

    if (isJsonParserError(error) || isFastifyJsonBodyError(error)) {
      if (shouldRecordRefreshFailure(requestPath)) {
        incrementRefreshFailure("INVALID_JSON");
      }

      appLogger.warn(
        {
          requestId,
          err: error,
        },
        "Invalid JSON body"
      );
      sendFastifyError(reply, requestId, 400, "INVALID_JSON", "Body JSON invalid.");
      return;
    }

    if (isDbError(error) && error.code === "23505") {
      if (shouldRecordRefreshFailure(requestPath)) {
        incrementRefreshFailure("CONFLICT");
      }

      appLogger.warn(
        {
          requestId,
          code: error.code,
          constraint: error.constraint,
        },
        "Database conflict"
      );
      sendFastifyError(reply, requestId, 409, "CONFLICT", "Resursa exista deja.");
      return;
    }

    appLogger.error(
      {
        requestId,
        err: error,
      },
      "Unhandled server error"
    );
    if (shouldRecordRefreshFailure(requestPath)) {
      incrementRefreshFailure("INTERNAL_SERVER_ERROR");
    }
    sendFastifyError(reply, requestId, 500, "INTERNAL_SERVER_ERROR", "Eroare interna de server.");
  });

  await fastify.register(fastifyCompress, {
    // Disabled global response compression because under the current Fastify/Node runtime
    // large JSON replies can be emitted as `content-encoding: gzip` with an empty body.
    // Request decompression remains enabled.
    globalCompression: false,
    globalDecompression: true,
  });

  // Formidable consumes the raw IncomingMessage in the shared Express handler.
  // Register a passthrough parser so Fastify does not reject multipart requests
  // before the route-level auth guard and upload validation can run.
  fastify.addContentTypeParser(
    /^multipart\/form-data(?:;.*)?$/i,
    { bodyLimit: maxMediaFileBytes },
    (_request, payload, done) => {
      done(null, payload);
    }
  );

  await registerFastifyApiRoutes(fastify);
  await registerFastifyApiDocs(fastify);

  if (existsSync(uploadsPath)) {
    await fastify.register(fastifyStatic, {
      root: uploadsPath,
      prefix: "/uploads/",
      decorateReply: false,
      index: false,
    });
  }

  if (existsSync(clientDistPath)) {
    await fastify.register(fastifyStatic, {
      root: clientDistPath,
      prefix: "/",
      index: false,
      wildcard: false,
      decorateReply: true,
      setHeaders: (reply, filePath) => {
        if (filePath.endsWith(`${path.sep}${manifestPageFileName}`)) {
          reply.header("Cache-Control", "no-store");
          reply.header("Content-Security-Policy", manifestPageCspHeader);
          return;
        }

        if (filePath.endsWith(".html")) {
          reply.header("Cache-Control", "no-store");
          return;
        }

        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          reply.header("Cache-Control", "public, max-age=31536000, immutable");
          return;
        }

        reply.header("Cache-Control", "public, max-age=3600");
      },
    });

    fastify.get("/*", async (_request, reply) => {
      reply.header("Cache-Control", "no-store");
      return reply.sendFile("index.html", clientDistPath);
    });
  }

  fastify.setNotFoundHandler((request, reply) => {
    const requestPath = readFastifyRequestPath(request);
    if (requestPath.startsWith("/api/")) {
      const requestId = (request as FastifyRequestWithMeta).pcpRequestId ?? "unknown";
      sendFastifyError(reply, requestId, 404, "API_ROUTE_NOT_FOUND", "Ruta API inexistenta.");
      return;
    }

    reply.code(404).send("Not found");
  });

  return fastify;
}
