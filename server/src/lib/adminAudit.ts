import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import type { PrismaTx } from "./prismaTransaction.js";

export type AdminAuditActor = {
  userId?: string | number | null;
  email?: string;
  role?: string;
};

export type RecordAdminAuditInput = {
  actor?: AdminAuditActor;
  action: string;
  targetType: string;
  targetId?: string | number;
  details?: unknown;
};

export type AdminAuditRow = {
  id: string;
  actorUserId: string | null;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details: unknown;
  createdAt: string;
};

export type AdminAuditCursor = {
  createdAt: string;
  id: string;
};

export type ListAdminAuditResult = {
  rows: AdminAuditRow[];
  nextCursor: string | null;
};

function parseActorUserId(value: string | number | null | undefined): bigint | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return BigInt(parsed);
}

function isPositiveIntegerString(value: string): boolean {
  return /^[1-9]\d*$/.test(value);
}

export function parseAdminAuditCursor(raw: unknown): AdminAuditCursor | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }

  try {
    const decoded = Buffer.from(raw.trim(), "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as { createdAt?: unknown; id?: unknown };
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") {
      return null;
    }

    if (!isPositiveIntegerString(parsed.id) || Number.isNaN(Date.parse(parsed.createdAt))) {
      return null;
    }

    return {
      createdAt: parsed.createdAt,
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

function encodeAdminAuditCursor(input: AdminAuditCursor): string {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
}

function normalizeAuditRows(rows: Array<{
  id: bigint;
  actorUserId: bigint | null;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details: unknown;
  createdAt: Date;
}>): AdminAuditRow[] {
  return rows.map((row) => ({
    id: row.id.toString(),
    actorUserId: row.actorUserId ? row.actorUserId.toString() : null,
    actorEmail: row.actorEmail,
    actorRole: row.actorRole,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    details: row.details,
    createdAt: row.createdAt.toISOString(),
  }));
}

type AdminAuditWriter = PrismaTx | typeof prisma;

function buildAdminAuditCreateData(input: RecordAdminAuditInput): Prisma.AdminAuditLogCreateManyInput {
  const actorUserId = parseActorUserId(input.actor?.userId);
  const actorEmail = input.actor?.email?.trim() ?? "";
  const actorRole = input.actor?.role?.trim() ?? "";
  const targetId = input.targetId === undefined ? "" : String(input.targetId);
  const details = input.details ?? {};

  return {
    actorUserId,
    actorEmail,
    actorRole,
    action: input.action,
    targetType: input.targetType,
    targetId,
    details: details as Prisma.InputJsonValue,
  };
}

export async function recordAdminAuditBatch(
  inputs: RecordAdminAuditInput[],
  runner: AdminAuditWriter = prisma
): Promise<void> {
  if (inputs.length === 0) {
    return;
  }

  await runner.adminAuditLog.createMany({
    data: inputs.map((input) => buildAdminAuditCreateData(input)),
  });
}

export async function recordAdminAudit(
  input: RecordAdminAuditInput,
  runner: AdminAuditWriter = prisma
): Promise<void> {
  await recordAdminAuditBatch([input], runner);
}

export async function listAdminAudit(input: {
  limit: number;
  action?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  cursor?: AdminAuditCursor | null;
}): Promise<ListAdminAuditResult> {
  const where: Prisma.AdminAuditLogWhereInput = {
    ...(input.action ? { action: input.action } : {}),
    ...(input.targetType ? { targetType: input.targetType } : {}),
    ...(input.targetId ? { targetId: input.targetId } : {}),
  };

  if (input.cursor) {
    const cursorCreatedAt = new Date(input.cursor.createdAt);
    where.AND = [
      {
        OR: [
          { createdAt: { lt: cursorCreatedAt } },
          {
            createdAt: cursorCreatedAt,
            id: { lt: BigInt(input.cursor.id) },
          },
        ],
      },
    ];
  }

  const rows = await prisma.adminAuditLog.findMany({
    where,
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: input.limit + 1,
    select: {
      id: true,
      actorUserId: true,
      actorEmail: true,
      actorRole: true,
      action: true,
      targetType: true,
      targetId: true,
      details: true,
      createdAt: true,
    },
  });

  const hasMore = rows.length > input.limit;
  const pageRows = hasMore ? rows.slice(0, input.limit) : rows;
  const normalizedRows = normalizeAuditRows(pageRows);
  const lastRow = normalizedRows[normalizedRows.length - 1];

  return {
    rows: normalizedRows,
    nextCursor: hasMore && lastRow
      ? encodeAdminAuditCursor({
        createdAt: lastRow.createdAt,
        id: lastRow.id,
      })
      : null,
  };
}
