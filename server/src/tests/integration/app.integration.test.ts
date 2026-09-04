import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { apiDocsAssetsPath, apiDocsIndexPath, apiDocsJsonPath, apiDocsPath } from "../../lib/swaggerUI.js";

const app = createApp();

test("health live endpoint should expose runtime/build metadata", async () => {
  const response = await request(app)
    .get("/api/health/live")
    .expect(200);

  const payload = response.body as {
    data: {
      service: string;
      status: string;
      runtime: { uptimeSeconds: number; bootId: string; draining: boolean };
      build: { appVersion: string; appRelease: string };
    };
    error: null;
    meta: { requestId: string; timestamp: string };
  };

  assert.equal(payload.error, null);
  assert.equal(payload.data.status, "live");
  assert.equal(typeof payload.data.service, "string");
  assert.equal(typeof payload.data.runtime.uptimeSeconds, "number");
  assert.equal(typeof payload.data.runtime.bootId, "string");
  assert.equal(typeof payload.data.runtime.draining, "boolean");
  assert.equal(typeof payload.data.build.appVersion, "string");
  assert.equal(typeof payload.data.build.appRelease, "string");
});

test("health ready endpoint should expose readiness/dependencies", async () => {
  const response = await request(app).get("/api/health/ready");

  assert.ok(response.status === 200 || response.status === 503);

  const payload = response.body as {
    data: {
      service: string;
      status: string;
      ready: boolean;
      dependencies: {
        database: {
          status: string;
          latencyMs: number | null;
          message: string;
        };
      };
    };
    error: null;
    meta: { requestId: string; timestamp: string };
  };

  assert.equal(typeof payload.data.service, "string");
  assert.equal(typeof payload.data.status, "string");
  assert.equal(typeof payload.data.ready, "boolean");
  assert.equal(typeof payload.data.dependencies.database.status, "string");
  assert.equal(typeof payload.data.dependencies.database.message, "string");
  assert.equal(typeof payload.meta.requestId, "string");
});

test("unknown API routes should return structured 404 response", async () => {
  const response = await request(app)
    .get("/api/unknown-route")
    .expect(404);

  const payload = response.body as {
    data: null;
    error: { code: string; message: string };
    meta: { requestId: string; timestamp: string };
  };

  assert.equal(payload.data, null);
  assert.equal(payload.error.code, "API_ROUTE_NOT_FOUND");
  assert.equal(typeof payload.meta.requestId, "string");
  assert.equal(typeof payload.meta.timestamp, "string");
});

test("API responses should include CSP directives that allow Turnstile", async () => {
  const response = await request(app)
    .get("/api/unknown-route")
    .expect(404);

  const cspHeader = String(response.headers["content-security-policy"] ?? "");
  assert.match(cspHeader, /script-src/i);
  assert.match(cspHeader, /frame-src/i);
  assert.match(cspHeader, /challenges\.cloudflare\.com/i);
});

test("express adapter should expose a browser-compatible permissions policy header", async () => {
  const response = await request(app)
    .get("/api/health/live")
    .expect(200);

  const permissionsPolicyHeader = String(response.headers["permissions-policy"] ?? "");
  assert.match(permissionsPolicyHeader, /camera=\(\)/i);
  assert.doesNotMatch(permissionsPolicyHeader, /ambient-light-sensor=\(\)/i);
  assert.doesNotMatch(permissionsPolicyHeader, /battery=\(\)/i);
  assert.doesNotMatch(permissionsPolicyHeader, /document-domain=\(\)/i);
  assert.doesNotMatch(permissionsPolicyHeader, /web-share=\(\)/i);
});

test("API preflight should allow credentials for refresh cookie flows", async () => {
  const response = await request(app)
    .options("/api/auth/refresh")
    .set("Origin", "http://localhost:5173")
    .set("Access-Control-Request-Method", "POST")
    .expect(204);

  const allowCredentials = String(response.headers["access-control-allow-credentials"] ?? "");
  assert.equal(allowCredentials.toLowerCase(), "true");
});

test("shared county alias route should be available in express adapter", async () => {
  const response = await request(app)
    .get("/api/meta/counties")
    .expect(200);

  const counties = response.body?.data as string[] | undefined;
  assert.ok(Array.isArray(counties));
  assert.ok(counties.includes("București"));
});

test("api docs should be exposed in express adapter with canonical routing", async () => {
  const redirectResponse = await request(app)
    .get(apiDocsPath)
    .expect(302);

  assert.equal(redirectResponse.headers.location, apiDocsIndexPath);

  const htmlResponse = await request(app)
    .get(apiDocsIndexPath)
    .set("Accept-Encoding", "identity")
    .expect(200);

  assert.match(String(htmlResponse.headers["content-type"] ?? ""), /text\/html/i);
  assert.match(htmlResponse.text, /PCS Platform API Documentation/i);
  assert.match(htmlResponse.text, /\/api-docs\/static\/swagger-ui\.css/);

  const assetResponse = await request(app)
    .get(`${apiDocsAssetsPath}/swagger-ui.css`)
    .set("Accept-Encoding", "identity")
    .expect(200);

  assert.match(String(assetResponse.headers["content-type"] ?? ""), /text\/css/i);

  const specResponse = await request(app)
    .get(apiDocsJsonPath)
    .set("Accept-Encoding", "identity")
    .expect(200);

  assert.equal(specResponse.body?.openapi, "3.0.0");
});

test("manifest page should be exposed in express adapter with manifest-specific CSP", async () => {
  const response = await request(app)
    .get("/manifest_pcs.html")
    .expect(200);

  assert.match(response.text, /Manifestul PCS/i);

  const cspHeader = String(response.headers["content-security-policy"] ?? "");
  assert.match(cspHeader, /unsafe-inline/i);
  assert.match(cspHeader, /fonts\.googleapis\.com/i);
});

test("express adapter should return 404 instead of SPA HTML for missing assets", async () => {
  const response = await request(app)
    .get("/assets/missing-bundle.js")
    .expect(404);

  assert.doesNotMatch(String(response.headers["content-type"] ?? ""), /text\/html/i);
  assert.doesNotMatch(response.text, /<div id="root">/i);
});
