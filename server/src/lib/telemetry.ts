import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { FastifyInstrumentation } from "@opentelemetry/instrumentation-fastify";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { RedisInstrumentation } from "@opentelemetry/instrumentation-redis";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import type { Span } from "@opentelemetry/api";
import { env } from "./env.js";
import { appLogger } from "./logger.js";

let initialized = false;
let sdkInstance: NodeSDK | null = null;

type TelemetryRequestInfo = {
  request?: {
    url?: string | null;
  };
};

export function initTelemetry(): void {
  if (initialized) {
    return;
  }

  initialized = true;

  const isTracingEnabled = env.otelEnabled === true || String(env.otelEnabled) === "true";
  const otelExporterUrl =
    env.otelExporterUrl || "http://localhost:4318/v1/traces";

  if (!isTracingEnabled) {
    appLogger.info("OpenTelemetry tracing disabled");
    return;
  }

  appLogger.info(`Initializing OpenTelemetry with exporter: ${otelExporterUrl}`);

  const resource = Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: "pcs-server",
      [SemanticResourceAttributes.SERVICE_VERSION]: "2.0.0",
      environment: env.nodeEnv,
    })
  );

  const otlpExporter = new OTLPTraceExporter({
    url: otelExporterUrl,
  });

  sdkInstance = new NodeSDK({
    resource,
    traceExporter: otlpExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-express": {
          enabled: true,
          requestHook: (_span: Span, requestInfo: unknown) => {
            const url = readTelemetryRequestUrl(requestInfo);
            if (url?.includes("/health")) {
              return false;
            }
          },
        },
        "@opentelemetry/instrumentation-fastify": {
          enabled: true,
        },
        "@opentelemetry/instrumentation-http": {
          enabled: true,
        },
        "@opentelemetry/instrumentation-pg": {
          enabled: true,
          // Note: dbStatementSerializer not available in this version
          // Queries are automatically sanitized by OpenTelemetry
        },
        "@opentelemetry/instrumentation-redis": {
          enabled: true,
          responseHook: (span: Span, _cmdArgs: unknown, response: unknown) => {
            if (response && typeof response === "string" && response.length > 100) {
              span.addEvent("Redis response truncated", {
                "response.length": response.length,
              });
            }
          },
        },
      }),
      new ExpressInstrumentation(),
      new FastifyInstrumentation(),
      new HttpInstrumentation(),
      new PgInstrumentation(),
      new RedisInstrumentation(),
    ],
  });

  // Start SDK
  try {
    sdkInstance.start();
    appLogger.info("OpenTelemetry SDK started");

    // Graceful shutdown
    process.on("SIGTERM", () => {
      if (sdkInstance) {
        sdkInstance
          .shutdown()
          .then(() => appLogger.info("OpenTelemetry SDK shutdown"))
          .catch((err) =>
            appLogger.error({ err }, "Failed to shutdown OpenTelemetry SDK")
          );
      }
    });
  } catch (error) {
    appLogger.error({ error }, "Failed to start OpenTelemetry SDK");
  }
}

function readTelemetryRequestUrl(requestInfo: unknown): string | null {
  if (!requestInfo || typeof requestInfo !== "object") {
    return null;
  }

  const telemetryRequestInfo = requestInfo as TelemetryRequestInfo;
  const url = telemetryRequestInfo.request?.url;
  return typeof url === "string" ? url : null;
}
