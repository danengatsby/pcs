import { appLogger } from "./logger.js";
import { processAdminAuditOutboxBatch } from "./adminAuditOutbox.js";

const outboxWorkerIntervalMs = 15_000;
const outboxWorkerBatchSize = 50;
const outboxWorkerMaxBatchesPerRun = 4;

let workerTimer: ReturnType<typeof setInterval> | null = null;
let runInFlight: Promise<void> | null = null;

async function runOutboxPass(trigger: string): Promise<void> {
  if (runInFlight) {
    return runInFlight;
  }

  runInFlight = (async () => {
    try {
      let claimedTotal = 0;
      let sentTotal = 0;
      let retriedTotal = 0;
      let failedTotal = 0;

      for (let batchIndex = 0; batchIndex < outboxWorkerMaxBatchesPerRun; batchIndex += 1) {
        const batch = await processAdminAuditOutboxBatch({
          batchSize: outboxWorkerBatchSize,
        });

        claimedTotal += batch.claimed;
        sentTotal += batch.sent;
        retriedTotal += batch.retried;
        failedTotal += batch.failed;

        if (batch.claimed < outboxWorkerBatchSize) {
          break;
        }
      }

      if (claimedTotal > 0) {
        appLogger.info(
          {
            trigger,
            claimed: claimedTotal,
            sent: sentTotal,
            retried: retriedTotal,
            failed: failedTotal,
          },
          "Admin audit outbox processed"
        );
      }
    } catch (error) {
      appLogger.error({ err: error, trigger }, "Admin audit outbox worker pass failed");
    } finally {
      runInFlight = null;
    }
  })();

  return runInFlight;
}

export function triggerAdminAuditOutboxWorker(trigger: string): void {
  void runOutboxPass(trigger);
}

export async function flushAdminAuditOutboxWorker(trigger = "manual"): Promise<void> {
  await runOutboxPass(trigger);
}

export function startAdminAuditOutboxWorker(): void {
  if (workerTimer) {
    return;
  }

  workerTimer = setInterval(() => {
    void runOutboxPass("interval");
  }, outboxWorkerIntervalMs);
  workerTimer.unref?.();

  void runOutboxPass("startup");
}

export async function stopAdminAuditOutboxWorker(): Promise<void> {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }

  if (runInFlight) {
    await runInFlight;
  }
}
