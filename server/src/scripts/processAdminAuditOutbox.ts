import { closePool } from "../lib/db.js";
import { processAdminAuditOutboxBatch } from "../lib/adminAuditOutbox.js";

type OutboxAggregateResult = {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
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

async function processBatches(input: {
  batchLimit: number;
  maxBatches: number;
  baseDelaySeconds: number;
  maxDelaySeconds: number;
}): Promise<OutboxAggregateResult> {
  const totals: OutboxAggregateResult = {
    claimed: 0,
    sent: 0,
    retried: 0,
    failed: 0,
    batches: 0,
  };

  for (let batchIndex = 0; batchIndex < input.maxBatches; batchIndex += 1) {
    const batchResult = await processAdminAuditOutboxBatch({
      batchSize: input.batchLimit,
      baseDelaySeconds: input.baseDelaySeconds,
      maxDelaySeconds: input.maxDelaySeconds,
    });

    totals.claimed += batchResult.claimed;
    totals.sent += batchResult.sent;
    totals.retried += batchResult.retried;
    totals.failed += batchResult.failed;
    totals.batches += 1;

    if (batchResult.claimed < input.batchLimit) {
      break;
    }
  }

  return totals;
}

async function main(): Promise<void> {
  const batchLimit = readPositiveIntEnv("ADMIN_AUDIT_OUTBOX_BATCH_LIMIT", 100);
  const maxBatches = readPositiveIntEnv("ADMIN_AUDIT_OUTBOX_MAX_BATCHES", 20);
  const baseDelaySeconds = readPositiveIntEnv("ADMIN_AUDIT_OUTBOX_BASE_DELAY_SECONDS", 30);
  const maxDelaySeconds = readPositiveIntEnv("ADMIN_AUDIT_OUTBOX_MAX_DELAY_SECONDS", 3600);

  const totals = await processBatches({
    batchLimit,
    maxBatches,
    baseDelaySeconds,
    maxDelaySeconds,
  });

  console.log("Procesare admin audit outbox finalizata.", {
    batchLimit,
    maxBatches,
    baseDelaySeconds,
    maxDelaySeconds,
    batchesRun: totals.batches,
    claimed: totals.claimed,
    sent: totals.sent,
    retried: totals.retried,
    failed: totals.failed,
  });
}

main()
  .catch((error) => {
    console.error("Eroare la procesarea admin audit outbox:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
