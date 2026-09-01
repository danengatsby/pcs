import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { withPrismaTransaction, type PrismaTx } from "./prismaTransaction.js";
import { computeRetryDelaySeconds } from "./notificationOutbox.normalize.js";
import type {
  NotificationEmailPayload,
  NotificationOutboxRow,
  OutboxRowState,
  OutboxStatus,
} from "./notificationOutbox.types.js";

const claimableStatuses: OutboxStatus[] = ["pending", "retry"];
const outboxLockLeaseMs = 5 * 60 * 1000;

type NotificationOutboxWriter = PrismaTx | typeof prisma;

function mapClaimedRow(row: {
  id: bigint;
  action: string;
  payload: unknown;
  attemptCount: number;
  maxAttempts: number;
}): NotificationOutboxRow {
  return {
    id: row.id.toString(),
    action: row.action,
    payload: row.payload,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
  };
}

export async function claimOutboxRows(batchSize: number, nowIso: string): Promise<NotificationOutboxRow[]> {
  const now = new Date(nowIso);
  const staleLockBefore = new Date(now.getTime() - outboxLockLeaseMs);

  return withPrismaTransaction(async (tx) => {
    const candidates = await tx.notificationEmailOutbox.findMany({
      where: {
        nextAttemptAt: {
          lte: now,
        },
        OR: [
          {
            status: {
              in: claimableStatuses,
            },
            lockedAt: null,
          },
          {
            status: "processing",
            lockedAt: {
              lte: staleLockBefore,
            },
          },
        ],
      },
      orderBy: [
        { status: "asc" },
        { nextAttemptAt: "asc" },
        { id: "asc" },
      ],
      take: Math.max(batchSize * 4, batchSize),
      select: {
        id: true,
        action: true,
        payload: true,
        attemptCount: true,
        maxAttempts: true,
      },
    });

    const claimedRows: NotificationOutboxRow[] = [];
    const lockTimestamp = new Date();

    for (const row of candidates) {
      if (claimedRows.length >= batchSize) {
        break;
      }

      if (row.attemptCount >= row.maxAttempts) {
        continue;
      }

      const updated = await tx.notificationEmailOutbox.updateMany({
        where: {
          id: row.id,
          nextAttemptAt: {
            lte: now,
          },
          OR: [
            {
              status: {
                in: claimableStatuses,
              },
              lockedAt: null,
            },
            {
              status: "processing",
              lockedAt: {
                lte: staleLockBefore,
              },
            },
          ],
          attemptCount: row.attemptCount,
          maxAttempts: row.maxAttempts,
        },
        data: {
          status: "processing",
          lockedAt: lockTimestamp,
          updatedAt: now,
        },
      });

      if (updated.count !== 1) {
        continue;
      }

      claimedRows.push(mapClaimedRow(row));
    }

    return claimedRows;
  });
}

async function updateOutboxRowState(
  id: string,
  nowIso: string,
  input: {
    status: OutboxStatus;
    attemptCountIncrement: number;
    nextAttemptAt: string;
    lastError: string;
    sentAt: string | null;
  }
): Promise<OutboxRowState | null> {
  const parsedId = BigInt(id);
  const now = new Date(nowIso);
  const nextAttemptAt = new Date(input.nextAttemptAt);
  const sentAt = input.sentAt ? new Date(input.sentAt) : null;

  const updated = await prisma.notificationEmailOutbox.updateMany({
    where: {
      id: parsedId,
    },
    data: {
      status: input.status,
      attemptCount: {
        increment: input.attemptCountIncrement,
      },
      nextAttemptAt,
      lastError: input.lastError,
      sentAt,
      lockedAt: null,
      updatedAt: now,
    },
  });

  if (updated.count === 0) {
    return null;
  }

  const row = await prisma.notificationEmailOutbox.findUnique({
    where: {
      id: parsedId,
    },
    select: {
      id: true,
      status: true,
      attemptCount: true,
    },
  });

  if (!row) {
    return null;
  }

  return {
    id: row.id.toString(),
    status: row.status as OutboxStatus,
    attemptCount: row.attemptCount,
  };
}

export async function insertOutboxRow(input: {
  action: string;
  payload: NotificationEmailPayload;
  maxAttempts: number;
  nextAttemptAt: string;
}, runner: NotificationOutboxWriter = prisma): Promise<void> {
  await insertOutboxRows([input], runner);
}

export async function insertOutboxRows(input: Array<{
  action: string;
  payload: NotificationEmailPayload;
  maxAttempts: number;
  nextAttemptAt: string;
}>, runner: NotificationOutboxWriter = prisma): Promise<number> {
  if (input.length === 0) {
    return 0;
  }

  const created = await runner.notificationEmailOutbox.createMany({
    data: input.map((item) => ({
      action: item.action,
      payload: item.payload as Prisma.InputJsonValue,
      status: "pending",
      attemptCount: 0,
      maxAttempts: item.maxAttempts,
      nextAttemptAt: new Date(item.nextAttemptAt),
      lastError: "",
    })),
  });

  return created.count;
}

export async function markOutboxSent(id: string, nowIso: string): Promise<void> {
  await updateOutboxRowState(id, nowIso, {
    status: "sent",
    attemptCountIncrement: 1,
    nextAttemptAt: nowIso,
    lastError: "",
    sentAt: nowIso,
  });
}

export async function markOutboxRetryOrFailed(
  row: NotificationOutboxRow,
  now: Date,
  options: {
    baseDelaySeconds: number;
    maxDelaySeconds: number;
    errorMessage: string;
  }
): Promise<"retry" | "failed"> {
  const nowIso = now.toISOString();
  const nextAttemptCount = row.attemptCount + 1;
  const shouldFail = nextAttemptCount >= row.maxAttempts;

  if (shouldFail) {
    await updateOutboxRowState(row.id, nowIso, {
      status: "failed",
      attemptCountIncrement: 1,
      nextAttemptAt: nowIso,
      lastError: options.errorMessage,
      sentAt: null,
    });
    return "failed";
  }

  const delaySeconds = computeRetryDelaySeconds(
    nextAttemptCount,
    options.baseDelaySeconds,
    options.maxDelaySeconds
  );
  const nextAttemptAt = new Date(now.getTime() + delaySeconds * 1000).toISOString();

  await updateOutboxRowState(row.id, nowIso, {
    status: "retry",
    attemptCountIncrement: 1,
    nextAttemptAt,
    lastError: options.errorMessage,
    sentAt: null,
  });

  return "retry";
}

export async function markOutboxInvalidPayload(row: NotificationOutboxRow, nowIso: string): Promise<void> {
  await updateOutboxRowState(row.id, nowIso, {
    status: "failed",
    attemptCountIncrement: Math.max(1, row.maxAttempts - row.attemptCount),
    nextAttemptAt: nowIso,
    lastError: "Invalid queued email payload.",
    sentAt: null,
  });
}
