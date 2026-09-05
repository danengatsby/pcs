import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import type { RequestHandler } from "express";
import request from "supertest";
import { createFastifyServer } from "../../fastifyServer.js";
import { createExpressChainHandler } from "../../fastify/expressCompat.js";
import { env } from "../../lib/env.js";
import { apiDocsAssetsPath, apiDocsIndexPath, apiDocsJsonPath, apiDocsPath } from "../../lib/swaggerUI.js";

let server: FastifyInstance;

before(async () => {
  server = await createFastifyServer();
  await server.ready();
});

after(async () => {
  await server.close();
});

test("fastify adapter should expose health endpoint parity", async () => {
  const response = await request(server.server)
    .get("/api/health/live")
    .expect(200);

  assert.equal(response.body?.error, null);
  assert.equal(response.body?.data?.status, "live");
  assert.equal(typeof response.body?.meta?.requestId, "string");
  const csp = String(response.headers["content-security-policy"] ?? "");
  for (const directive of ["script-src", "frame-src", "connect-src"]) {
    assert.ok(csp.split(";").some((item) => item.trim() === `${directive} 'self'`));
  }
});

test("fastify adapter should expose auth policy parity", async () => {
  const response = await request(server.server)
    .get("/api/auth/policy")
    .expect(200);

  assert.equal(response.body?.error, null);
  assert.equal(response.body?.data?.tokenPolicy?.accessTokenTtlSeconds, env.authTokenTtlSeconds);
  assert.equal(response.body?.data?.tokenPolicy?.refreshToken?.enabled, env.authRefreshEnabled);
});

test("fastify adapter should expose a browser-compatible permissions policy header", async () => {
  const response = await request(server.server)
    .get("/api/health/live")
    .expect(200);

  const permissionsPolicyHeader = String(response.headers["permissions-policy"] ?? "");
  assert.match(permissionsPolicyHeader, /camera=\(\)/i);
  assert.doesNotMatch(permissionsPolicyHeader, /ambient-light-sensor=\(\)/i);
  assert.doesNotMatch(permissionsPolicyHeader, /battery=\(\)/i);
  assert.doesNotMatch(permissionsPolicyHeader, /document-domain=\(\)/i);
  assert.doesNotMatch(permissionsPolicyHeader, /web-share=\(\)/i);
});

test("fastify adapter should expose shared counties alias route", async () => {
  const response = await request(server.server)
    .get("/api/meta/counties")
    .expect(200);

  assert.ok(Array.isArray(response.body?.data));
  assert.ok(response.body.data.includes("Iași"));
});

test("fastify adapter should expose revoke-all route with auth guard", async () => {
  const response = await request(server.server)
    .post("/api/auth/revoke-all")
    .expect(401);

  assert.equal(response.body?.error?.code, "AUTH_UNAUTHORIZED");
});

test("fastify adapter should expose admin members dashboard route with auth guard", async () => {
  const response = await request(server.server)
    .get("/api/admin/members/dashboard")
    .expect(401);

  assert.equal(response.body?.error?.code, "AUTH_UNAUTHORIZED");
});

test("fastify adapter should pass multipart requests to the shared auth guard", async () => {
  const response = await request(server.server)
    .post("/api/news/media/upload")
    .field("kind", "image")
    .attach("file", Buffer.from("not-a-real-file"), "test.png")
    .expect(401);

  assert.equal(response.body?.error?.code, "AUTH_UNAUTHORIZED");
});

test("fastify adapter should support Express-style streamed responses", async () => {
  const csvServer = Fastify({ logger: false });
  const csvHandler: RequestHandler = (_req, res) => {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.write("name,email\n");
    res.write("Test,test@example.test\n");
    res.end();
  };

  csvServer.get("/csv", {
    handler: createExpressChainHandler([csvHandler]),
  });
  await csvServer.ready();

  try {
    const response = await request(csvServer.server)
      .get("/csv")
      .expect(200);

    assert.match(String(response.headers["content-type"] ?? ""), /text\/csv/i);
    assert.equal(response.text, "name,email\nTest,test@example.test\n");
  } finally {
    await csvServer.close();
  }
});

test("fastify adapter should preserve refresh preflight behavior", async () => {
  const response = await request(server.server)
    .options("/api/auth/refresh")
    .set("Origin", "http://localhost:5173")
    .set("Access-Control-Request-Method", "POST")
    .expect(204);

  assert.equal(String(response.headers["access-control-allow-credentials"] ?? "").toLowerCase(), "true");
});

test("fastify adapter should expose api docs parity", async () => {
  const redirectResponse = await request(server.server)
    .get(apiDocsPath)
    .expect(302);

  assert.equal(redirectResponse.headers.location, apiDocsIndexPath);

  const htmlResponse = await request(server.server)
    .get(apiDocsIndexPath)
    .set("Accept-Encoding", "identity")
    .expect(200);

  assert.match(String(htmlResponse.headers["content-type"] ?? ""), /text\/html/i);
  assert.match(htmlResponse.text, /PCS Platform API Documentation/i);
  assert.match(htmlResponse.text, /\/api-docs\/static\/swagger-ui\.css/);

  const assetResponse = await request(server.server)
    .get(`${apiDocsAssetsPath}/swagger-ui.css`)
    .set("Accept-Encoding", "identity")
    .expect(200);

  assert.match(String(assetResponse.headers["content-type"] ?? ""), /text\/css/i);

  const specResponse = await request(server.server)
    .get(apiDocsJsonPath)
    .set("Accept-Encoding", "identity")
    .expect(200);

  assert.equal(specResponse.body?.openapi, "3.0.0");
});

test("fastify adapter should expose manifest page parity", async () => {
  const response = await request(server.server)
    .get("/manifest_pcs.html")
    .expect(200);

  assert.match(response.text, /Manifestul PCS/i);
  assert.match(String(response.headers["content-security-policy"] ?? ""), /unsafe-inline/i);
});

test("fastify adapter serves new assets but never uses SPA fallback for missing assets or API routes", async () => {
  const clientDistPath = await mkdtemp(path.join(tmpdir(), "pcs-client-dist-"));
  const assetsPath = path.join(clientDistPath, "assets");
  await mkdir(assetsPath);
  await writeFile(
    path.join(clientDistPath, "index.html"),
    '<!doctype html><html><body><div id="root">SPA fallback</div></body></html>',
    "utf8"
  );

  const staticServer = await createFastifyServer({ clientDistPath });
  await staticServer.ready();

  try {
    const lateBundleName = "runtime-bundle.js";
    await writeFile(path.join(assetsPath, lateBundleName), "window.__PCS_READY__ = true;", "utf8");

    const bundleResponse = await request(staticServer.server)
      .get(`/assets/${lateBundleName}`)
      .set("Accept-Encoding", "identity")
      .expect(200);

    assert.match(
      String(bundleResponse.headers["content-type"] ?? ""),
      /^application\/javascript(?:;|$)/i
    );
    assert.equal(bundleResponse.headers["cache-control"], "public, max-age=31536000, immutable");
    assert.equal(bundleResponse.text, "window.__PCS_READY__ = true;");

    const missingResponse = await request(staticServer.server)
      .get("/assets/missing-bundle.js")
      .set("Accept-Encoding", "identity")
      .expect(404);

    assert.doesNotMatch(String(missingResponse.headers["content-type"] ?? ""), /text\/html/i);
    assert.notEqual(missingResponse.headers["cache-control"], "public, max-age=31536000, immutable");
    assert.doesNotMatch(missingResponse.text, /SPA fallback/i);

    for (const apiPath of ["/api", "/api/volunteers", "/api/volunteers/by-county?county=Cluj", "/api/missing-route"]) {
      const apiResponse = await request(staticServer.server).get(apiPath).expect(404);
      assert.equal(apiResponse.body?.data, null);
      assert.equal(apiResponse.body?.error?.code, "API_ROUTE_NOT_FOUND");
      assert.doesNotMatch(apiResponse.text, /SPA fallback/i);
      await request(staticServer.server).head(apiPath).expect(404);
    }
    const clientRoute = await request(staticServer.server).get("/contact").expect(200);
    assert.match(clientRoute.text, /SPA fallback/i);
  } finally {
    await staticServer.close();
    await rm(clientDistPath, { recursive: true, force: true });
  }
});

test("fastify adapter should return parseable JSON for clients that advertise compression", async () => {
  const runtimeServer = await createFastifyServer();
  await runtimeServer.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = runtimeServer.server.address() as AddressInfo | null;
    assert.ok(address && typeof address.port === "number");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/news`, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate, br",
      },
    });

    assert.equal(response.status, 200);
    const payload = await response.json() as {
      data?: unknown;
      error?: unknown;
    };

    assert.equal(payload.error, null);
    assert.ok(Array.isArray(payload.data));
  } finally {
    await runtimeServer.close();
  }
});
