import { WebTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-web";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { XMLHttpRequestInstrumentation } from "@opentelemetry/instrumentation-xml-http-request";
import { UserInteractionInstrumentation } from "@opentelemetry/instrumentation-user-interaction";
import type { Span } from "@opentelemetry/api";
import { trace } from "@opentelemetry/api";

let initialized = false;

type TelemetryAttributeValue = string | number | boolean;
type TelemetryAttributes = Record<string, TelemetryAttributeValue>;

export function initClientTelemetry(): void {
  if (initialized) {
    return;
  }

  initialized = true;

  const otelEnabled = import.meta.env.VITE_OTEL_ENABLED === "true";
  const otelExporterUrl =
    import.meta.env.VITE_OTEL_EXPORTER_URL ||
    "http://localhost:4318/v1/traces";

  if (!otelEnabled) {
    console.debug("OpenTelemetry client tracing disabled");
    return;
  }

  console.debug(`Initializing OpenTelemetry client with exporter: ${otelExporterUrl}`);

  // Create the resource
  const resource = Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: "pcs-client",
      [SemanticResourceAttributes.SERVICE_VERSION]: "2.0.0",
      "client.type": "web",
    })
  );

  // Create the tracer provider
  const tracerProvider = new WebTracerProvider({
    resource,
  });

  // Add OTLP HTTP exporter
  const otlpExporter = new OTLPTraceExporter({
    url: otelExporterUrl,
  });

  tracerProvider.addSpanProcessor(new BatchSpanProcessor(otlpExporter));

  // Register global tracer provider
  tracerProvider.register();

  // Register automatic instrumentation
  registerInstrumentations({
    instrumentations: [
      new FetchInstrumentation({
        // Note: requestHook and responseHook not available in this version
        // Queries and responses are automatically captured
      }),
      new XMLHttpRequestInstrumentation({
        // Note: requestHook not available in this version
        // Automatically tracks XHR requests
      }),
      new UserInteractionInstrumentation(),
    ],
  });

  console.debug("OpenTelemetry client initialized");
}

/**
 * Get a tracer for the client
 */
export function getClientTracer(name: string = "pcs-client") {
  return trace.getTracer(name, "2.0.0");
}

/**
 * Track page navigation
 */
export function trackPageNavigation(pageName: string, path: string): void {
  const tracer = getClientTracer();
  tracer.startActiveSpan(`page_view_${pageName}`, (span: Span) => {
    span.setAttributes({
      "page.name": pageName,
      "page.path": path,
      "page.url": window.location.href,
    });
    span.end();
  });
}

/**
 * Track user actions (clicks, form submissions, etc.)
 */
export function trackUserAction(actionName: string, details?: Record<string, unknown>): void {
  const tracer = getClientTracer();
  tracer.startActiveSpan(`user_action_${actionName}`, (span: Span) => {
    span.setAttribute("action.name", actionName);
    setPrimitiveAttributes(span, "action", details);
    span.end();
  });
}

/**
 * Track React component renders
 */
export function trackComponentRender(componentName: string, props?: Record<string, unknown>): void {
  const tracer = getClientTracer();
  tracer.startActiveSpan(`component_render_${componentName}`, (span: Span) => {
    span.setAttribute("component.name", componentName);
    if (props) {
      span.setAttribute("component.has_props", Object.keys(props).length > 0);
    }
    span.end();
  });
}

function setPrimitiveAttributes(
  span: Span,
  prefix: string,
  values?: Record<string, unknown>,
): void {
  if (!values) {
    return;
  }

  const attributes: TelemetryAttributes = {};

  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      attributes[`${prefix}.${key}`] = value;
    }
  }

  span.setAttributes(attributes);
}
