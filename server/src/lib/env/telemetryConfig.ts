export function readOtelEnabled(): boolean {
  const value = process.env.OTEL_ENABLED?.toLowerCase();
  return value === "true" || value === "1";
}

export function readOtelExporterUrl(): string {
  return (
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
    "http://localhost:4318/v1/traces"
  );
}
