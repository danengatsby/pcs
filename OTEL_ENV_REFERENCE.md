# OpenTelemetry / Jaeger Configuration
# Enable OpenTelemetry tracing
OTEL_ENABLED=false

# OpenTelemetry exporter endpoint (OTLP HTTP)
# Default: http://localhost:4318/v1/traces
# For production: export to your centralized tracing backend
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
