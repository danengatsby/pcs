import { Prisma, type TreasuryEntry } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { recordAdminAudit } from "../../lib/adminAudit.js";
import type { AdminAccessContext } from "../../lib/adminAuthorization.js";
import { AppError } from "../../lib/errors.js";
import { conflict, requestHash, userNames } from "../admin/workspaceRecords.js";
import type { TreasuryFields, TreasuryQuery } from "./treasury.schema.js";

function amountCents(amount: string): bigint {
  const [whole, fraction = ""] = amount.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function formatCents(value: bigint): string {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}
function dto(row: TreasuryEntry, names: Map<string, string>, organizations: Map<string, string>) {
  return {
    id: row.id, organizationId: row.organizationId, organizationName: organizations.get(row.organizationId ?? "") ?? null,
    kind: row.kind, category: row.category, amount: formatCents(row.amountCents), currency: row.currency,
    occurredOn: row.occurredOn.toISOString().slice(0, 10), description: row.description, reference: row.reference,
    status: row.status, version: row.version, createdByName: names.get(String(row.createdBy)) ?? "Cont indisponibil",
    postedByName: names.get(String(row.postedBy)) ?? null, postedAt: row.postedAt?.toISOString() ?? null,
    voidedByName: names.get(String(row.voidedBy)) ?? null, voidedAt: row.voidedAt?.toISOString() ?? null,
    voidReason: row.voidReason, updatedAt: row.updatedAt.toISOString(),
  };
}
function fields(input: TreasuryFields) {
  return { organizationId: input.organizationId, kind: input.kind, category: input.category, amountCents: amountCents(input.amount),
    occurredOn: new Date(`${input.occurredOn}T00:00:00Z`), description: input.description, reference: input.reference };
}
async function validateOrganization(input: TreasuryFields, tx: Prisma.TransactionClient) {
  if (input.organizationId && !await tx.organization.findFirst({ where: { id: input.organizationId, status: { in: ["active", "forming"] } }, select: { id: true } })) {
    throw new AppError(400, "ADMIN_RECORD_INVALID", "Selectează o organizație activă sau în formare.");
  }
}
export async function listTreasury(filters: TreasuryQuery) {
  const where: Prisma.TreasuryEntryWhereInput = {
    ...(filters.kind ? { kind: filters.kind } : {}), ...(filters.status ? { status: filters.status } : {}),
    ...(filters.year ? { occurredOn: { gte: new Date(`${filters.year}-01-01T00:00:00Z`), lt: new Date(`${filters.year + 1}-01-01T00:00:00Z`) } } : {}),
    ...(filters.search ? { OR: [{ description: { contains: filters.search, mode: "insensitive" } }, { reference: { contains: filters.search, mode: "insensitive" } }] } : {}),
  };
  const [rows, total, sums] = await prisma.$transaction([
    prisma.treasuryEntry.findMany({ where, orderBy: [{ occurredOn: "desc" }, { id: "desc" }], skip: filters.offset, take: filters.limit }),
    prisma.treasuryEntry.count({ where }),
    prisma.treasuryEntry.groupBy({ by: ["kind"], orderBy: { kind: "asc" }, where: { AND: [where, { status: "posted" }] }, _sum: { amountCents: true } }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  const names = await userNames(rows.flatMap((row) => [row.createdBy, row.postedBy, row.voidedBy]));
  const organizations = await prisma.organization.findMany({ where: { id: { in: rows.flatMap((row) => row.organizationId ? [row.organizationId] : []) } }, select: { id: true, name: true } });
  const income = sums.find((row) => row.kind === "income")?._sum?.amountCents ?? 0n;
  const expense = sums.find((row) => row.kind === "expense")?._sum?.amountCents ?? 0n;
  return { rows: rows.map((row) => dto(row, names, new Map(organizations.map((organization) => [organization.id, organization.name])))), total,
    totals: { income: formatCents(income), expense: formatCents(expense), balance: formatCents(income - expense), currency: "RON" } };
}
export async function createTreasury(input: TreasuryFields & { requestId: string }, access: AdminAccessContext) {
  const hash = requestHash({ ...input, actorId: access.actor.id });
  try {
    return await prisma.$transaction(async (tx) => {
      await validateOrganization(input, tx);
      const row = await tx.treasuryEntry.create({ data: { id: input.requestId, requestHash: hash, ...fields(input), createdBy: BigInt(access.actor.id), updatedBy: BigInt(access.actor.id) } });
      await recordAdminAudit({ actor: { ...access.actor, userId: access.actor.id }, action: "treasury.create", targetType: "treasury_entry", targetId: row.id, details: { ...input, requestId: undefined } }, tx);
      return { id: row.id, version: row.version };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.treasuryEntry.findUnique({ where: { id: input.requestId } });
      if (existing?.requestHash === hash) { return { id: existing.id, version: existing.version }; }
      throw conflict();
    }
    throw error;
  }
}
export async function changeTreasury(id: string, version: number, access: AdminAccessContext, change:
  { action: "update"; fields: TreasuryFields } | { action: "post" } | { action: "void"; reason: string }
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.treasuryEntry.findUnique({ where: { id } });
    if (!current) { throw new AppError(404, "ADMIN_RECORD_NOT_FOUND", "Înregistrarea nu există."); }
    if (current.version !== version || current.status === "voided" || (change.action !== "void" && current.status !== "draft")) { throw conflict(); }
    if (change.action === "update") { await validateOrganization(change.fields, tx); }
    const actorId = BigInt(access.actor.id);
    const data = change.action === "update" ? fields(change.fields) : change.action === "post"
      ? { status: "posted", postedBy: actorId, postedAt: new Date() }
      : { status: "voided", voidedBy: actorId, voidedAt: new Date(), voidReason: change.reason };
    const updated = await tx.treasuryEntry.updateMany({ where: { id, version, status: current.status }, data: { ...data, updatedBy: actorId, updatedAt: new Date(), version: { increment: 1 } } });
    if (updated.count !== 1) { throw conflict(); }
    await recordAdminAudit({ actor: { ...access.actor, userId: access.actor.id }, action: `treasury.${change.action}`, targetType: "treasury_entry", targetId: id,
      details: { fromStatus: current.status, version: version + 1, ...(change.action === "void" ? { reason: change.reason } : change.action === "update" ? { before: { amount: formatCents(current.amountCents), description: current.description, reference: current.reference, occurredOn: current.occurredOn.toISOString().slice(0, 10), kind: current.kind, category: current.category, organizationId: current.organizationId }, after: change.fields } : {}) } }, tx);
    return { id, version: version + 1 };
  });
}
