import { CounterMetric, HistogramMetric } from "./primitives.js";
import {
  isAuthFailureCode,
  normalizeMethod,
  normalizeMetricAction,
  normalizeMetricCode,
  normalizeRouteLabel,
  readStatusClass,
} from "./route.js";

const latencyBucketsSeconds = [
  0.01,
  0.025,
  0.05,
  0.1,
  0.25,
  0.5,
  1,
  2.5,
  5,
  10,
] as const;

const httpRequestDurationMetric = new HistogramMetric(
  "pcp_http_request_duration_seconds",
  "HTTP request latency in seconds.",
  latencyBucketsSeconds
);

const authFailuresMetric = new CounterMetric(
  "pcp_auth_failures_total",
  "Total number of authentication failures grouped by code and route."
);

const refreshFailuresMetric = new CounterMetric(
  "pcp_auth_refresh_failures_total",
  "Total number of refresh-token failures grouped by code."
);

const emailFailuresMetric = new CounterMetric(
  "pcp_email_failures_total",
  "Total number of failed outgoing email notification attempts grouped by action."
);

export function observeHttpRequestDuration(input: {
  method: string;
  route: string;
  statusCode: number;
  durationSeconds: number;
}): void {
  httpRequestDurationMetric.observe(
    {
      method: normalizeMethod(input.method),
      route: normalizeRouteLabel(input.route),
      status_class: readStatusClass(input.statusCode),
    },
    input.durationSeconds
  );
}

export function incrementAuthFailure(code: string, route: string): void {
  authFailuresMetric.increment({
    code: normalizeMetricCode(code),
    route: normalizeRouteLabel(route),
  });
}

export function incrementRefreshFailure(code: string): void {
  refreshFailuresMetric.increment({
    code: normalizeMetricCode(code),
  });
}

export function incrementEmailFailure(action: string): void {
  emailFailuresMetric.increment({
    action: normalizeMetricAction(action),
  });
}

export function renderMetrics(): string {
  const sections = [
    httpRequestDurationMetric.render(),
    authFailuresMetric.render(),
    refreshFailuresMetric.render(),
    emailFailuresMetric.render(),
  ];

  return `${sections.join("\n\n")}\n`;
}

export function resetMetricsForTests(): void {
  httpRequestDurationMetric.reset();
  authFailuresMetric.reset();
  refreshFailuresMetric.reset();
  emailFailuresMetric.reset();
}

export { isAuthFailureCode, normalizeRouteLabel };
