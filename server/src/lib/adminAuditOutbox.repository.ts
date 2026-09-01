import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { withPrismaTransaction, type PrismaTx } from "./prismaTransaction.js";
import type {
  AdminAuditOutboxRow,
  AdminAuditOutboxRowState,
  AdminAuditOutboxStatus,
  EnqueueAdminAuditInput,
} from "./adminAuditOutbox.types.js";

const claimableStatuses: AdminAuditOutboxStatus[] = ["pending", "retry"];
const outboxLockLeaseMs = 5 * 60 * 1000;

type AdminAuditOutboxWriter = PrismaTx | typeof prisma;

function mapClaimedRow(row: {
  id: bigint;
  action: string;
  payload: unknown;
  attemptCount: number;
  maxAttempts: number;
}): AdminAuditOutboxRow {
  return {
    id: row.id.toString(),
    action: row.action,
    payload: row.payload,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
  };
}

export async function claimAdminAuditOutboxRows(
  batchSize: number,
  nowIso: string
): Promise<AdminAuditOutboxRow[]> {
  const now = new Date(nowIso);
  const staleLockBefore = new Date(now.getTime() - outboxLockLeaseMs);

  return withPrismaTransaction(async (tx) => {
    const candidates = await tx.adminAuditOutbox.findMany({
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

    const claimedRows: AdminAuditOutboxRow[] = [];
    const lockTimestamp = new Date();

    for (const row of candidates) {
      if (claimedRows.length >= batchSize) {
        break;
      }

      if (row.attemptCount >= row.maxAttempts) {
        continue;
      }

      const updated = await tx.adminAuditOutbox.updateMany({
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

async function updateAdminAuditOutboxRowState(
  id: string,
  nowIso: string,
  input: {
    status: AdminAuditOutboxStatus;
    attemptCountIncrement: number;
    nextAttemptAt: string;
    lastError: string;
    sentAt: string | null;
  }
): Promise<AdminAuditOutboxRowState | null> {
  const parsedId = BigInt(id);
  const now = new Date(nowIso);
  const nextAttemptAt = new Date(input.nextAttemptAt);
  const sentAt = input.sentAt ? new Date(input.sentAt) : null;

  const updated = await prisma.adminAuditOutbox.updateMany({
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

  const row = await prisma.adminAuditOutbox.findUnique({
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
    status: row.status as AdminAuditOutboxStatus,
    attemptCount: row.attemptCount,
  };
}

export async function insertAdminAuditOutboxRows(
  input: Array<{
    action: string;
    payload: EnqueueAdminAuditInput;
    maxAttempts: number;
    nextAttemptAt: string;
  }>,
  runner: AdminAuditOutboxWriter = prisma
): Promise<number> {
  if (input.length === 0) {
    return 0;
  }

  const created = await runner.adminAuditOutbox.createMany({
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

export async function markAdminAuditOutboxRowsSent(
  ids: string[],
  nowIso: string,
  runner: AdminAuditOutboxWriter = prisma
): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }

  const now = new Date(nowIso);
  const parsedIds = ids.map((id) => BigInt(id));
  const updated = await runner.adminAuditOutbox.updateMany({
    where: {
      id: {
        in: parsedIds,
      },
    },
    data: {
      status: "sent",
      attemptCount: {
        increment: 1,
      },
      nextAttemptAt: now,
      lastError: "",
      sentAt: now,
      lockedAt: null,
      updatedAt: now,
    },
  });

  return updated.count;
}

export async function markAdminAuditOutboxRetryOrFailed(
  row: AdminAuditOutboxRow,
  now: Date,
  input: {
    nextAttemptAt: string;
    errorMessage: string;
    shouldFail: boolean;
  }
): Promise<"retry" | "failed"> {
  const nowIso = now.toISOString();

  if (input.shouldFail) {
    await updateAdminAuditOutboxRowState(row.id, nowIso, {
      status: "failed",
      attemptCountIncrement: 1,
      nextAttemptAt: nowIso,
      lastError: input.errorMessage,
      sentAt: null,
    });
    return "failed";
  }

  await updateAdminAuditOutboxRowState(row.id, nowIso, {
    status: "retry",
    attemptCountIncrement: 1,
    nextAttemptAt: input.nextAttemptAt,
    lastError: input.errorMessage,
    sentAt: null,
  });

  return "retry";
}

export async function markAdminAuditOutboxInvalidPayload(
  row: AdminAuditOutboxRow,
  nowIso: string
): Promise<void> {
  await updateAdminAuditOutboxRowState(row.id, nowIso, {
    status: "failed",
    attemptCountIncrement: Math.max(1, row.maxAttempts - row.attemptCount),
    nextAttemptAt: nowIso,
    lastError: "Invalid queued admin audit payload.",
    sentAt: null,
  });
}
