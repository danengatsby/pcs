import { cleanupExpiredRefreshTokenSessions } from "../lib/authRefreshToken.js";
import { cleanupExpiredRevokedTokens } from "../lib/authTokenRevocation.js";
import { closePool } from "../lib/db.js";

type BatchCleanupResult = {
  deletedRows: number;
  batches: number;
};

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} invalid: ${raw}`);
  }

  return parsed;
}

async function runBatchedCleanup(
  cleanupStep: (limit: number) => Promise<number>,
  batchLimit: number,
  maxBatches: number
): Promise<BatchCleanupResult> {
  let deletedRows = 0;
  let batches = 0;

  for (let batch = 0; batch < maxBatches; batch += 1) {
    const deleted = await cleanupStep(batchLimit);
    batches += 1;
    deletedRows += deleted;

    if (deleted < batchLimit) {
      break;
    }
  }

  return {
    deletedRows,
    batches,
  };
}

async function main(): Promise<void> {
  const batchLimit = readPositiveIntEnv("AUTH_TOKEN_CLEANUP_BATCH_LIMIT", 5000);
  const maxBatches = readPositiveIntEnv("AUTH_TOKEN_CLEANUP_MAX_BATCHES", 20);

  const [refreshCleanup, revokedCleanup] = await Promise.all([
    runBatchedCleanup(cleanupExpiredRefreshTokenSessions, batchLimit, maxBatches),
    runBatchedCleanup(cleanupExpiredRevokedTokens, batchLimit, maxBatches),
  ]);

  console.log("Cleanup token-uri auth finalizat.", {
    batchLimit,
    maxBatches,
    refreshTokensDeleted: refreshCleanup.deletedRows,
    refreshBatches: refreshCleanup.batches,
    revokedTokensDeleted: revokedCleanup.deletedRows,
    revokedBatches: revokedCleanup.batches,
  });
}

main()
  .catch((error) => {
    console.error("Eroare la cleanup token-uri auth:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
