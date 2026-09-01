import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { env } from "../../lib/env.js";
import { resetMetricsForTests } from "../../lib/metrics.js";

const app = createApp();

async function readMetricsPayload(): Promise<string> {
  const metricsRequest = request(app).get("/api/metrics");

  if (env.metricsBearerToken) {
    await request(app)
      .get("/api/metrics")
      .expect(401);

    const response = await metricsRequest
      .set("Authorization", `Bearer ${env.metricsBearerToken}`)
      .expect(200);
    return String(response.text ?? "");
  }

  const response = await metricsRequest.expect(200);
  return String(response.text ?? "");
}

test("metrics endpoint should expose latency/auth/refresh/email series", async () => {
  if (!env.metricsEnabled) {
    return;
  }

  resetMetricsForTests();

  await request(app)
    .get("/api/unknown-route")
    .expect(404);

  const refreshExpectedStatus = env.authRefreshEnabled ? 401 : 404;
  await request(app)
    .post("/api/auth/refresh")
    .expect(refreshExpectedStatus);

  const metricsPayload = await readMetricsPayload();

  assert.match(metricsPayload, /# TYPE pcp_http_request_duration_seconds histogram/);
  assert.match(metricsPayload, /# TYPE pcp_auth_failures_total counter/);
  assert.match(metricsPayload, /# TYPE pcp_auth_refresh_failures_total counter/);
  assert.match(metricsPayload, /# TYPE pcp_email_failures_total counter/);

  assert.match(
    metricsPayload,
    /pcp_http_request_duration_seconds_count\{[^}]*route="\/api\/unknown-route"[^}]*\}\s+[1-9]\d*/
  );
  assert.match(
    metricsPayload,
    /pcp_auth_failures_total\{[^}]*route="\/api\/auth\/refresh"[^}]*\}\s+[1-9]\d*/
  );
  assert.match(
    metricsPayload,
    /pcp_auth_refresh_failures_total\{[^}]*\}\s+[1-9]\d*/
  );
});
