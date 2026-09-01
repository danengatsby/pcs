import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import type { FastifyReply, FastifyRequest, RouteHandlerMethod, HTTPMethods } from "fastify";

const allowedMethods = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const defaultAllowedHeaders = "Content-Type,Authorization,X-CSRF-Token,X-Request-Id";

export type FastifyRouteSpec = {
  method: HTTPMethods;
  url: string;
  handlers: RequestHandler[];
};

type CookieOptions = {
  httpOnly?: boolean;
  sameSite?: "lax" | "strict" | "none" | boolean;
  secure?: boolean;
  path?: string;
  maxAge?: number;
  expires?: Date;
};

type ExpressLikeRequest = FastifyRequest["raw"] & {
  body: unknown;
  query: Record<string, unknown>;
  params: Record<string, string>;
  ip: string;
  originalUrl: string;
  header: (name: string) => string | undefined;
};

type ExpressLikeResponse = {
  locals: {
    requestId: string;
    [key: string]: unknown;
  };
  statusCode: number;
  setHeader: (name: string, value: string | number | readonly string[]) => ExpressLikeResponse;
  status: (code: number) => ExpressLikeResponse;
  json: (payload: unknown) => ExpressLikeResponse;
  send: (payload: unknown) => ExpressLikeResponse;
  write: (chunk: string | Buffer | Uint8Array) => boolean;
  end: (chunk?: string | Buffer | Uint8Array) => ExpressLikeResponse;
  cookie: (name: string, value: string, options?: CookieOptions) => ExpressLikeResponse;
  clearCookie: (name: string, options?: CookieOptions) => ExpressLikeResponse;
};

type NextFunction = (error?: unknown) => void;
type ExpressCompatibleHandler = (req: unknown, res: unknown, next: NextFunction) => unknown;

function appendSetCookie(reply: FastifyReply, value: string): void {
  const existing = reply.getHeader("set-cookie");
  if (!existing) {
    reply.header("set-cookie", [value]);
    return;
  }

  if (Array.isArray(existing)) {
    reply.header("set-cookie", [...existing, value]);
    return;
  }

  reply.header("set-cookie", [String(existing), value]);
}

function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge / 1000))}`);
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  if (options.path) {
    parts.push(`Path=${options.path}`);
  }

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options.secure) {
    parts.push("Secure");
  }

  if (options.sameSite) {
    const valueFromOption = typeof options.sameSite === "string"
      ? options.sameSite
      : options.sameSite === true
        ? "strict"
        : "lax";
    const normalized = valueFromOption.toLowerCase();
    if (normalized === "none" || normalized === "strict" || normalized === "lax") {
      parts.push(`SameSite=${normalized[0]?.toUpperCase()}${normalized.slice(1)}`);
    }
  }

  return parts.join("; ");
}

function normalizeHeaderValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return undefined;
}

export function readFastifyRequestPath(request: FastifyRequest): string {
  const rawPath = request.raw.url ?? request.url ?? "/";
  const withoutQuery = rawPath.split("?")[0] ?? "/";
  if (!withoutQuery) {
    return "/";
  }
  return withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
}

export function readOrCreateRequestId(
  request: FastifyRequest,
  incoming: string | undefined
): string {
  const candidate = (incoming ?? "").trim();
  if (candidate && candidate.length <= 120) {
    return candidate;
  }

  const fallback = request.id?.trim();
  if (fallback) {
    return fallback;
  }

  return randomUUID();
}

function createExpressLikeRequest(request: FastifyRequest): ExpressLikeRequest {
  const raw = request.raw as ExpressLikeRequest;
  raw.body = request.body;
  raw.query = (request.query ?? {}) as Record<string, unknown>;
  raw.params = (request.params ?? {}) as Record<string, string>;
  raw.ip = request.ip;
  raw.originalUrl = request.raw.url ?? request.url ?? "/";
  raw.header = (name: string): string | undefined => {
    const value = request.headers[name.toLowerCase()];
    return normalizeHeaderValue(value);
  };
  return raw;
}

function createExpressLikeResponse(reply: FastifyReply, requestId: string): ExpressLikeResponse {
  const pendingChunks: Buffer[] = [];
  const appendChunk = (chunk: string | Buffer | Uint8Array): void => {
    if (typeof chunk === "string") {
      pendingChunks.push(Buffer.from(chunk));
      return;
    }

    pendingChunks.push(Buffer.from(chunk));
  };

  const res: ExpressLikeResponse = {
    locals: {
      requestId,
    },
    statusCode: reply.statusCode,
    setHeader(name, value) {
      reply.header(name, value);
      return this;
    },
    status(code) {
      this.statusCode = code;
      reply.code(code);
      return this;
    },
    json(payload) {
      if (!reply.sent) {
        reply.send(payload);
      }
      return this;
    },
    send(payload) {
      if (!reply.sent) {
        reply.send(payload);
      }
      return this;
    },
    write(chunk) {
      if (!reply.sent) {
        appendChunk(chunk);
      }
      return !reply.sent;
    },
    end(chunk) {
      if (chunk !== undefined && !reply.sent) {
        appendChunk(chunk);
      }
      if (!reply.sent) {
        reply.send(Buffer.concat(pendingChunks));
      }
      return this;
    },
    cookie(name, value, options) {
      appendSetCookie(reply, serializeCookie(name, value, options));
      return this;
    },
    clearCookie(name, options) {
      appendSetCookie(
        reply,
        serializeCookie(name, "", {
          ...options,
          maxAge: 0,
          expires: new Date(0),
        })
      );
      return this;
    },
  };

  return res;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === "object"
    && value !== null
    && "then" in value
    && typeof (value as { then?: unknown }).then === "function";
}

async function executeHandler(
  handler: RequestHandler,
  req: ExpressLikeRequest,
  res: ExpressLikeResponse
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const finishResolve = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };

    const finishReject = (error: unknown): void => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };

    const next = (error?: unknown): void => {
      if (error) {
        finishReject(error);
        return;
      }
      finishResolve();
    };

    try {
      const compatHandler = handler as unknown as ExpressCompatibleHandler;
      const maybePromise = compatHandler(req, res, next);
      if (isPromiseLike(maybePromise)) {
        void maybePromise.then(
          () => finishResolve(),
          (error) => finishReject(error)
        );
      } else if (handler.length < 3) {
        finishResolve();
      }
    } catch (error) {
      finishReject(error);
    }
  });
}

export function createExpressChainHandler(handlers: RequestHandler[]): RouteHandlerMethod {
  return async (request, reply) => {
    const requestId = (request as FastifyRequest & { pcpRequestId?: string }).pcpRequestId ?? "unknown";
    const req = createExpressLikeRequest(request);
    const res = createExpressLikeResponse(reply, requestId);

    for (const handler of handlers) {
      await executeHandler(handler, req, res);
      if (reply.sent) {
        return;
      }
    }
  };
}

export function setCorsHeaders(request: FastifyRequest, reply: FastifyReply, origin: string): void {
  reply.header("Access-Control-Allow-Origin", origin);
  reply.header("Vary", "Origin");
  reply.header("Access-Control-Allow-Credentials", "true");

  if (request.method.toUpperCase() === "OPTIONS") {
    reply.header(
      "Access-Control-Allow-Headers",
      normalizeHeaderValue(request.headers["access-control-request-headers"]) ?? defaultAllowedHeaders
    );
    reply.header("Access-Control-Allow-Methods", allowedMethods);
    reply.code(204).send();
  }
}
