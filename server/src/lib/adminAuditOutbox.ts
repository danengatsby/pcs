import { appLogger } from "./logger.js";
import { recordAdminAuditBatch, type RecordAdminAuditInput } from "./adminAudit.js";
import {
  claimAdminAuditOutboxRows,
  insertAdminAuditOutboxRows,
  markAdminAuditOutboxInvalidPayload,
  markAdminAuditOutboxRetryOrFailed,
  markAdminAuditOutboxRowsSent,
} from "./adminAuditOutbox.repository.js";
import type {
  EnqueueAdminAuditInput,
  ProcessAdminAuditOutboxBatchOptions,
  ProcessAdminAuditOutboxBatchResult,
} from "./adminAuditOutbox.types.js";
import { withPrismaTransaction, type PrismaTx } from "./prismaTransaction.js";

const defaultBatchSize = 50;
const defaultMaxAttempts = 6;
const defaultBaseDelaySeconds = 30;
const defaultMaxDelaySeconds = 3600;
const actionMaxLength = 120;
const targetTypeMaxLength = 80;
const targetIdMaxLength = 120;
const errorMaxLength = 1200;

function normalizePositiveInt(rawValue: unknown, fallback: number): number {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function normalizeAction(rawAction: string): string {
  const normalized = rawAction.trim().toLowerCase();
  if (!normalized) {
    return "unknown";
  }
  return normalized.slice(0, actionMaxLength);
}

function clampDelaySeconds(value: number, maxDelaySeconds: number): number {
  return Math.max(1, Math.min(maxDelaySeconds, Math.floor(value)));
}

function computeRetryDelaySeconds(
  attemptCount: number,
  baseDelaySeconds: number,
  maxDelaySeconds: number
): number {
  const exponent = Math.max(0, attemptCount - 1);
  const exponentialDelay = baseDelaySeconds * (2 ** exponent);
  return clampDelaySeconds(exponentialDelay, maxDelaySeconds);
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof AggregateError) {
    for (const item of error.errors) {
      if (item instanceof Error && item.message.trim()) {
        return item.message.trim().slice(0, errorMaxLength);
      }
    }
  }

  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) {
      return message.slice(0, errorMaxLength);
    }
  }

  if (typeof error === "string") {
    return error.slice(0, errorMaxLength);
  }

  return "Unknown admin audit outbox error.";
}

function normalizeAuditPayload(input: EnqueueAdminAuditInput): RecordAdminAuditInput | null {
  const action = normalizeAction(input.action);
  const targetType = input.targetType.trim().slice(0, targetTypeMaxLength);
  const targetId = input.targetId === undefined ? "" : String(input.targetId).trim().slice(0, targetIdMaxLength);

  if (!action || !targetType) {
    return null;
  }

  return {
    actor: {
      userId: null,
      email: input.actor?.email?.trim() ?? "",
      role: input.actor?.role?.trim() ?? "",
    },
    action,
    targetType,
    targetId,
    details: input.details ?? {},
  };
}

export async function enqueueAdminAuditEntries(
  input: EnqueueAdminAuditInput[],
  runner?: PrismaTx
): Promise<number> {
  const rows = input.flatMap((item) => {
    const payload = normalizeAuditPayload(item);
    if (!payload) {
      return [];
    }

    return [{
      action: payload.action,
      payload,
      maxAttempts: normalizePositiveInt(item.maxAttempts, defaultMaxAttempts),
      nextAttemptAt: (item.nextAttemptAt ?? new Date()).toISOString(),
    }];
  });

  if (runner) {
    return insertAdminAuditOutboxRows(rows, runner);
  }

  return insertAdminAuditOutboxRows(rows);
}

function parseAuditPayload(rawPayload: unknown): RecordAdminAuditInput | null {
  if (!rawPayload || typeof rawPayload !== "object") {
    return null;
  }

  const payloadRecord = rawPayload as Record<string, unknown>;
  const actor = payloadRecord.actor;
  const actorRecord = actor && typeof actor === "object" ? actor as Record<string, unknown> : null;

  return normalizeAuditPayload({
    actor: {
      userId: actorRecord?.userId as string | number | null | undefined,
      email: typeof actorRecord?.email === "string" ? actorRecord.email : "",
      role: typeof actorRecord?.role === "string" ? actorRecord.role : "",
    },
    action: typeof payloadRecord.action === "string" ? payloadRecord.action : "",
    targetType: typeof payloadRecord.targetType === "string" ? payloadRecord.targetType : "",
    targetId: payloadRecord.targetId as string | number | undefined,
    details: payloadRecord.details,
  });
}

export async function processAdminAuditOutboxBatch(
  options: ProcessAdminAuditOutboxBatchOptions = {}
): Promise<ProcessAdminAuditOutboxBatchResult> {
  const batchSize = normalizePositiveInt(options.batchSize, defaultBatchSize);
  const baseDelaySeconds = normalizePositiveInt(options.baseDelaySeconds, defaultBaseDelaySeconds);
  const maxDelaySeconds = normalizePositiveInt(options.maxDelaySeconds, defaultMaxDelaySeconds);
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();

  const result: ProcessAdminAuditOutboxBatchResult = {
    claimed: 0,
    sent: 0,
    retried: 0,
    failed: 0,
  };

  const rows = await claimAdminAuditOutboxRows(batchSize, nowIso);
  result.claimed = rows.length;

  const validRows: Array<{ id: string; payload: RecordAdminAuditInput; rowAttemptCount: number; rowMaxAttempts: number; action: string }> = [];

  for (const row of rows) {
    const payload = parseAuditPayload(row.payload);
    if (!payload) {
      await markAdminAuditOutboxInvalidPayload(row, nowIso);
      result.failed += 1;
      appLogger.warn(
        {
          outboxId: row.id,
          action: row.action,
        },
        "Admin audit outbox payload invalid. Marked as failed."
      );
      continue;
    }

    validRows.push({
      id: row.id,
      payload,
      rowAttemptCount: row.attemptCount,
      rowMaxAttempts: row.maxAttempts,
      action: row.action,
    });
  }

  if (validRows.length === 0) {
    return result;
  }

  try {
    await withPrismaTransaction(async (tx) => {
      await recordAdminAuditBatch(validRows.map((row) => row.payload), tx);
      await markAdminAuditOutboxRowsSent(validRows.map((row) => row.id), nowIso, tx);
    });
    result.sent += validRows.length;
  } catch (error) {
    const errorMessage = extractErrorMessage(error);

    for (const row of validRows) {
      const nextAttemptCount = row.rowAttemptCount + 1;
      const shouldFail = nextAttemptCount >= row.rowMaxAttempts;
      const delaySeconds = computeRetryDelaySeconds(nextAttemptCount, baseDelaySeconds, maxDelaySeconds);
      const nextAttemptAt = new Date(now.getTime() + delaySeconds * 1000).toISOString();
      const finalStatus = await markAdminAuditOutboxRetryOrFailed({
        id: row.id,
        action: row.action,
        payload: row.payload,
        attemptCount: row.rowAttemptCount,
        maxAttempts: row.rowMaxAttempts,
      }, now, {
        nextAttemptAt,
        errorMessage,
        shouldFail,
      });

      if (finalStatus === "retry") {
        result.retried += 1;
      } else {
        result.failed += 1;
      }
    }

    appLogger.error(
      {
        err: error,
        claimed: validRows.length,
      },
      "Admin audit outbox delivery failed"
    );
  }

  return result;
}
