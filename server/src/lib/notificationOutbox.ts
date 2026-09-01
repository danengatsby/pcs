import { sendEmail } from "./email.js";
import { env } from "./env.js";
import { appLogger } from "./logger.js";
import { incrementEmailFailure } from "./metrics.js";
import {
  defaultBaseDelaySeconds,
  defaultBatchSize,
  defaultMaxAttempts,
  defaultMaxDelaySeconds,
  extractErrorMessage,
  normalizeAction,
  normalizePayload,
  normalizePositiveInt,
  parsePayload,
} from "./notificationOutbox.normalize.js";
import {
  claimOutboxRows,
  insertOutboxRow,
  insertOutboxRows,
  markOutboxInvalidPayload,
  markOutboxRetryOrFailed,
  markOutboxSent,
} from "./notificationOutbox.repository.js";
import type {
  EnqueueNotificationEmailInput,
  ProcessNotificationEmailOutboxBatchOptions,
  ProcessNotificationEmailOutboxBatchResult,
} from "./notificationOutbox.types.js";
import { prisma } from "./prisma.js";
import type { PrismaTx } from "./prismaTransaction.js";

export type {
  EnqueueNotificationEmailInput,
  NotificationEmailPayload,
  ProcessNotificationEmailOutboxBatchOptions,
  ProcessNotificationEmailOutboxBatchResult,
} from "./notificationOutbox.types.js";

type NotificationOutboxWriter = PrismaTx | typeof prisma;

export async function enqueueNotificationEmails(
  input: EnqueueNotificationEmailInput[],
  runner: NotificationOutboxWriter = prisma
): Promise<number> {
  if (!env.emailNotificationsEnabled) {
    return 0;
  }

  const rows = input.flatMap((item) => {
    const payload = normalizePayload(item.payload);
    if (!payload) {
      return [];
    }

    return [{
      action: normalizeAction(item.action),
      payload,
      maxAttempts: normalizePositiveInt(item.maxAttempts, defaultMaxAttempts),
      nextAttemptAt: (item.nextAttemptAt ?? new Date()).toISOString(),
    }];
  });

  return insertOutboxRows(rows, runner);
}

export async function enqueueNotificationEmail(
  input: EnqueueNotificationEmailInput,
  runner: NotificationOutboxWriter = prisma
): Promise<void> {
  if (!env.emailNotificationsEnabled) {
    return;
  }

  const payload = normalizePayload(input.payload);
  if (!payload) {
    return;
  }

  const maxAttempts = normalizePositiveInt(input.maxAttempts, defaultMaxAttempts);
  const action = normalizeAction(input.action);
  const nextAttemptAt = (input.nextAttemptAt ?? new Date()).toISOString();

  await insertOutboxRow({
    action,
    payload,
    maxAttempts,
    nextAttemptAt,
  }, runner);
}

export async function processNotificationEmailOutboxBatch(
  options: ProcessNotificationEmailOutboxBatchOptions = {}
): Promise<ProcessNotificationEmailOutboxBatchResult> {
  const batchSize = normalizePositiveInt(options.batchSize, defaultBatchSize);
  const baseDelaySeconds = normalizePositiveInt(options.baseDelaySeconds, defaultBaseDelaySeconds);
  const maxDelaySeconds = normalizePositiveInt(options.maxDelaySeconds, defaultMaxDelaySeconds);
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();

  const result: ProcessNotificationEmailOutboxBatchResult = {
    claimed: 0,
    sent: 0,
    retried: 0,
    failed: 0,
  };

  if (!env.emailNotificationsEnabled && !options.force) {
    return result;
  }

  const deliver = options.deliver ?? sendEmail;
  const rows = await claimOutboxRows(batchSize, nowIso);
  result.claimed = rows.length;

  for (const row of rows) {
    const payload = parsePayload(row.payload);
    if (!payload) {
      incrementEmailFailure(row.action);
      await markOutboxInvalidPayload(row, nowIso);
      result.failed += 1;
      appLogger.warn(
        {
          outboxId: row.id,
          action: row.action,
        },
        "Email outbox payload invalid. Marked as failed."
      );
      continue;
    }

    try {
      await deliver(payload);
      await markOutboxSent(row.id, nowIso);
      result.sent += 1;
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      incrementEmailFailure(row.action);
      const finalStatus = await markOutboxRetryOrFailed(row, now, {
        baseDelaySeconds,
        maxDelaySeconds,
        errorMessage,
      });

      if (finalStatus === "retry") {
        result.retried += 1;
      } else {
        result.failed += 1;
      }

      appLogger.error(
        {
          outboxId: row.id,
          action: row.action,
          err: error,
        },
        "Email outbox delivery failed"
      );
    }
  }

  return result;
}
