import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import request from "supertest";
import { createRuntimeTestServer, type RuntimeTestServer } from "../helpers/runtimeTestServer.js";

let runtimeServer: RuntimeTestServer | undefined;

before(async () => {
  runtimeServer = await createRuntimeTestServer();
});

after(async () => {
  if (runtimeServer) {
    await runtimeServer.close();
  }
});

test("post-build smoke should serve the JavaScript entry referenced by the frontend HTML", async () => {
  const htmlResponse = await request(runtimeServer!.target)
    .get("/")
    .set("Accept-Encoding", "identity")
    .expect(200);

  assert.match(String(htmlResponse.headers["content-type"] ?? ""), /text\/html/i);

  const entryAsset = htmlResponse.text.match(/src="(\/assets\/[^"]+\.js)"/i)?.[1];
  assert.ok(entryAsset, "index.html trebuie să indice bundle-ul JavaScript principal.");

  const assetResponse = await request(runtimeServer!.target)
    .get(entryAsset)
    .set("Accept-Encoding", "identity")
    .expect(200);

  assert.match(
    String(assetResponse.headers["content-type"] ?? ""),
    /^application\/javascript(?:;|$)/i
  );
});
