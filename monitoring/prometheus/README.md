# PCS Prometheus Setup

## 1) Set metrics token in production API env

On the API host (production), set:

```bash
METRICS_ENABLED=true
METRICS_BEARER_TOKEN=<long-random-token>
```

Suggested token generation:

```bash
openssl rand -hex 48
```

Restart the API after updating environment variables.

## 2) Configure Prometheus scrape for `/api/metrics`

1. Copy config template:

```bash
cp monitoring/prometheus/prometheus.pcs.example.yml /etc/prometheus/prometheus.yml
```

2. Update `targets` from `api.example.org` to production PCS API host.
3. Keep `metrics_path: /api/metrics`.

## Local quick-start (docker compose profile)

1. Prepare local token file:

```bash
cp monitoring/prometheus/secrets/pcs_metrics_bearer_token.example monitoring/prometheus/secrets/pcs_metrics_bearer_token
chmod 600 monitoring/prometheus/secrets/pcs_metrics_bearer_token
```

2. Prepare Grafana admin password secret:

```bash
cp monitoring/grafana/secrets/grafana_admin_password.example monitoring/grafana/secrets/grafana_admin_password
chmod 600 monitoring/grafana/secrets/grafana_admin_password
```

Recommended secure value:

```bash
openssl rand -base64 36 > monitoring/grafana/secrets/grafana_admin_password
chmod 600 monitoring/grafana/secrets/grafana_admin_password
```

3. Start Prometheus and Grafana locally:

```bash
docker compose --profile monitoring up -d prometheus grafana
```

4. Open Prometheus UI: `http://localhost:9090`.
5. Open Grafana UI: `http://localhost:3300` by default (user `admin`, password from `monitoring/grafana/secrets/grafana_admin_password`).
   You can override the host port with `GRAFANA_PORT`.
6. Dashboard is auto-provisioned as `PCS / PCS API Overview`.

## 3) Install bearer token for Prometheus

Write the same `METRICS_BEARER_TOKEN` value in:

`/etc/prometheus/secrets/pcs_metrics_bearer_token`

Recommended permissions:

```bash
chmod 600 /etc/prometheus/secrets/pcs_metrics_bearer_token
chown prometheus:prometheus /etc/prometheus/secrets/pcs_metrics_bearer_token
```

## 4) Install alert rules

```bash
cp monitoring/prometheus/alerts.pcs.yml /etc/prometheus/rules/alerts.pcs.yml
```

Then reload/restart Prometheus.

Reload/restart options:

```bash
# If Prometheus runs in docker compose (local/profile monitoring)
docker compose --profile monitoring restart prometheus

# If you changed Grafana provisioning/dashboard files
docker compose --profile monitoring restart grafana

# If Prometheus runs as systemd service
sudo systemctl reload prometheus || sudo systemctl restart prometheus

# If lifecycle endpoint is enabled
curl -X POST http://127.0.0.1:9090/-/reload
```

## 5) Baseline window (7-14 days)

Alert thresholds are baseline-aware and auto-switch after at least 7 days of samples.
The 7-day cut-over is implemented as `10080` 1-minute samples in `alerts.pcs.yml`.
For current rollout started on 2026-03-04, first stable tuning window is 2026-03-11 to 2026-03-18.

## 6) Dashboard queries (latency filter aligned with alerts)

Use the same route exclusions as alert recording rules (`/api/metrics`, `/api/health`):

```promql
# p95 latency (5m), same filter as alerts.pcs.yml
histogram_quantile(
  0.95,
  sum by (le) (
    rate(pcs_http_request_duration_seconds_bucket{route!="/api/metrics",route!="/api/health"}[5m])
  )
)
```

```promql
# p95 latency by route (top offenders)
histogram_quantile(
  0.95,
  sum by (le, route) (
    rate(pcs_http_request_duration_seconds_bucket{route!="/api/metrics",route!="/api/health"}[5m])
  )
)
```

```promql
# Prefer recording rule for overview panels
pcs:api_latency_seconds:p95_5m
```
