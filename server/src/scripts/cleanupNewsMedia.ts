import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closePool, query } from "../lib/db.js";
import { resolveStoredPath } from "../modules/news/media.js";

type SoftDeletedAssetRow = {
  id: string;
  storagePath: string;
  deletedAt: string;
};

type CleanupSummary = {
  scanned: number;
  deletedFiles: number;
  missingFiles: number;
  failedFiles: number;
};

export async function cleanupSoftDeletedMediaFiles(minAgeHours: number, limit: number): Promise<CleanupSummary> {
  const summary: CleanupSummary = {
    scanned: 0,
    deletedFiles: 0,
    missingFiles: 0,
    failedFiles: 0,
  };

  const result = await query<SoftDeletedAssetRow>(
    `
      SELECT
        id::text AS id,
        storage_path AS "storagePath",
        deleted_at AS "deletedAt"
      FROM news_media_assets
      WHERE deleted_at IS NOT NULL
        AND deleted_at <= NOW() - ($1::int * INTERVAL '1 hour')
        AND NOT EXISTS (
          SELECT 1
          FROM news_media_links links
          WHERE links.asset_id = news_media_assets.id
        )
      ORDER BY deleted_at ASC, id ASC
      LIMIT $2
    `,
    [minAgeHours, limit]
  );

  summary.scanned = result.rows.length;
  for (const row of result.rows) {
    try {
      const absolutePath = resolveStoredPath(row.storagePath);
      await unlink(absolutePath);
      summary.deletedFiles += 1;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "ENOENT") {
        summary.missingFiles += 1;
        continue;
      }

      summary.failedFiles += 1;
      console.error("Nu am putut sterge fisier media soft-delete.", {
        assetId: row.id,
        storagePath: row.storagePath,
        deletedAt: row.deletedAt,
        error,
      });
    }
  }

  return summary;
}

export async function runNewsMediaCleanupEntrypoint(): Promise<void> {
  const minAgeHoursRaw = process.env.NEWS_MEDIA_CLEANUP_MIN_AGE_HOURS?.trim() ?? "24";
  const limitRaw = process.env.NEWS_MEDIA_CLEANUP_LIMIT?.trim() ?? "200";

  const minAgeHours = Number(minAgeHoursRaw);
  const limit = Number(limitRaw);
  if (!Number.isInteger(minAgeHours) || minAgeHours < 0) {
    throw new Error(`NEWS_MEDIA_CLEANUP_MIN_AGE_HOURS invalid: ${minAgeHoursRaw}`);
  }
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(`NEWS_MEDIA_CLEANUP_LIMIT invalid: ${limitRaw}`);
  }

  const summary = await cleanupSoftDeletedMediaFiles(minAgeHours, limit);
  console.log("Cleanup media soft-delete finalizat.", summary);
}

const currentFile = fileURLToPath(import.meta.url);
const executedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (currentFile === executedFile) {
  runNewsMediaCleanupEntrypoint()
    .catch((error) => {
      console.error("Eroare la cleanup media soft-delete:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closePool();
    });
}
