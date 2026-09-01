import { readBooleanFlag } from "./shared.js";

export function readMetricsEnabled(nodeEnv: string): boolean {
  return readBooleanFlag(process.env.METRICS_ENABLED, nodeEnv !== "production");
}

export function readMetricsBearerToken(): string {
  return process.env.METRICS_BEARER_TOKEN?.trim() ?? "";
}

export function validateMetricsPolicy(config: {
  nodeEnv: string;
  metricsEnabled: boolean;
  metricsBearerToken: string;
}): void {
  if (config.nodeEnv !== "production") {
    return;
  }

  if (!config.metricsEnabled) {
    return;
  }

  if (!config.metricsBearerToken) {
    throw new Error(
      "Configuratie metrics invalida: METRICS_BEARER_TOKEN este obligatoriu in productie cand METRICS_ENABLED este true."
    );
  }
}
