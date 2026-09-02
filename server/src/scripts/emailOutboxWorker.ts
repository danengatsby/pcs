import { closePool } from "../lib/db.js";
import { closePrisma } from "../lib/prisma.js";
import { processNotificationEmailOutboxBatch } from "../lib/notificationOutbox.js";

const intervalMs = 15_000;
let stopping = false;
let running = false;

async function processPass(): Promise<void> {
  if (running || stopping) {
    return;
  }
  running = true;
  try {
    const result = await processNotificationEmailOutboxBatch({ batchSize: 50 });
    if (result.claimed > 0) {
      console.log("Email outbox worker processed.", result);
    }
  } catch (error) {
    console.error("Email outbox worker failed:", error);
  } finally {
    running = false;
  }
}

async function shutdown(): Promise<void> {
  if (stopping) {
    return;
  }
  stopping = true;
  await closePool();
  await closePrisma();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await processPass();
setInterval(() => void processPass(), intervalMs);
