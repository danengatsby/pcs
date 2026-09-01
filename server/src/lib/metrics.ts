export {
  incrementAuthFailure,
  incrementEmailFailure,
  incrementRefreshFailure,
  isAuthFailureCode,
  normalizeRouteLabel,
  observeHttpRequestDuration,
  renderMetrics,
  resetMetricsForTests,
} from "./metricsCore/registry.js";
