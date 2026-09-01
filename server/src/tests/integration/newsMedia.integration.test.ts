import assert from "node:assert/strict";
import { constants as fsConstants } from "node:fs";
import { access, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { query } from "../../lib/db.js";
import { resolveStoredPath } from "../../modules/news/media.js";
import { cleanupSoftDeletedMediaFiles } from "../../scripts/cleanupNewsMedia.js";
import { buildTestEmail, deleteUserByEmail } from "../helpers/dbTestUtils.js";

const app = createApp();

type SigninResponse = {
  data?: {
    token?: string;
  };
};

type UploadResponse = {
  data?: {
    asset?: {
      id?: string;
      publicUrl?: string;
    };
  };
};

type AssetStorageRow = {
  storagePath: string;
  deletedAt: string | null;
};

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6p3ioAAAAASUVORK5CYII=",
  "base64"
);

function createTempUploadPath(): string {
  return path.join(os.tmpdir(), `pcs-media-test-${Date.now()}-${Math.random().toString(16).slice(2)}.png`);
}

async function readAdminToken(email: string, password: string): Promise<string> {
  await request(app)
    .post("/api/auth/signup")
    .send({
      fullName: "Admin Media Test",
      email,
      password,
    })
    .expect(201);

  await query(
    `
      UPDATE users
      SET role = 'PRESEDINTE'
      WHERE LOWER(email) = LOWER($1)
    `,
    [email]
  );

  const signinResponse = await request(app)
    .post("/api/auth/signin")
    .send({
      email,
      password,
    })
    .expect(200);

  const token = (signinResponse.body as SigninResponse).data?.token ?? "";
  assert.ok(token.length > 20);
  return token;
}

async function readAssetStorageRow(assetId: number): Promise<AssetStorageRow | null> {
  const result = await query<AssetStorageRow>(
    `
      SELECT
        storage_path AS "storagePath",
        deleted_at AS "deletedAt"
      FROM news_media_assets
      WHERE id = $1
      LIMIT 1
    `,
    [assetId]
  );

  return result.rows[0] ?? null;
}

test("admin media upload should store file, soft delete and cleanup stale file", async () => {
  const adminEmail = buildTestEmail("news-media-admin");
  const password = "ParolaFoarteBuna#2026";
  const tempFilePath = createTempUploadPath();
  let assetId = 0;
  let absoluteStoredPath = "";

  try {
    await writeFile(tempFilePath, onePixelPng);
    const token = await readAdminToken(adminEmail, password);

    const uploadResponse = await request(app)
      .post("/api/news/media/upload")
      .set("Authorization", `Bearer ${token}`)
      .field("kind", "image")
      .field("title", "Pixel test")
      .field("alt", "Pixel alb")
      .attach("file", tempFilePath)
      .expect(201);

    const uploadPayload = uploadResponse.body as UploadResponse;
    assetId = Number(uploadPayload.data?.asset?.id ?? "0");
    assert.ok(Number.isInteger(assetId) && assetId > 0);
    assert.match(uploadPayload.data?.asset?.publicUrl ?? "", /^\/uploads\/news\//);

    const storedAsset = await readAssetStorageRow(assetId);
    assert.ok(storedAsset);
    assert.equal(storedAsset?.deletedAt, null);
    absoluteStoredPath = resolveStoredPath(storedAsset?.storagePath ?? "");
    await access(absoluteStoredPath, fsConstants.F_OK);

    await request(app)
      .delete(`/api/news/media/library/${assetId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const softDeletedAsset = await readAssetStorageRow(assetId);
    assert.ok(softDeletedAsset?.deletedAt);

    const cleanupResult = await cleanupSoftDeletedMediaFiles(0, 100000);
    assert.ok(cleanupResult.deletedFiles + cleanupResult.missingFiles >= 1);

    await assert.rejects(async () => {
      await access(absoluteStoredPath, fsConstants.F_OK);
    });
  } finally {
    if (assetId > 0) {
      await query(
        `
          DELETE FROM news_media_assets
          WHERE id = $1
        `,
        [assetId]
      );
    }

    await rm(tempFilePath, { force: true }).catch(() => {
      // Ignore temp file cleanup errors.
    });

    if (absoluteStoredPath) {
      await rm(absoluteStoredPath, { force: true }).catch(() => {
        // Ignore already cleaned files.
      });
    }

    await deleteUserByEmail(adminEmail);
  }
});
