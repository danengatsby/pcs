import { Prisma, type ParliamentaryItem } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { recordAdminAudit } from "../../lib/adminAudit.js";
import { buildAdminAccessContext, type AdminAccessContext } from "../../lib/adminAuthorization.js";
import type { UserRole } from "../../lib/authToken.js";
import { AppError } from "../../lib/errors.js";
import { conflict, requestHash, userNames } from "../admin/workspaceRecords.js";
import { parliamentaryTransitions, type ParliamentaryFields, type ParliamentaryQuery, type ParliamentaryStatus } from "./parliamentary.schema.js";

export const openParliamentaryStatuses = ["draft", "submitted", "committee", "scheduled"];
export function pendingParliamentaryWhere(): Prisma.ParliamentaryItemWhereInput {
  return { status: { in: openParliamentaryStatuses }, OR: [{ assignedTo: null }, { dueOn: { lt: new Date(new Date().toISOString().slice(0, 10)) } }] };
}
async function validateAssignee(id: string | null) {
  if (!id) { return; }
  const user = await prisma.user.findUnique({ where: { id: BigInt(id) }, select: { id: true, email: true, fullName: true, role: true } });
  if (!user) { throw new AppError(400, "ADMIN_RECORD_INVALID", "Responsabilul selectat nu mai este disponibil."); }
  try { await buildAdminAccessContext({ ...user, id: user.id.toString(), role: user.role as UserRole }, "parliamentary.manage"); }
  catch (error) {
    if (error instanceof AppError && error.status === 403) { throw new AppError(400, "ADMIN_RECORD_INVALID", "Responsabilul trebuie să aibă atribuții parlamentare și mandat național activ."); }
    throw error;
  }
}
export async function parliamentaryAssignees() {
  const profiles = await prisma.adminAccessProfile.findMany({ where: { profile: "parliamentary" }, select: { userId: true } });
  const users = await prisma.user.findMany({ where: { id: { in: profiles.map((profile) => profile.userId) } }, select: { id: true, fullName: true }, orderBy: [{ fullName: "asc" }, { id: "asc" }] });
  const available = [];
  for (const user of users) {
    try { await validateAssignee(user.id.toString()); available.push({ id: user.id.toString(), fullName: user.fullName }); }
    catch (error) { if (!(error instanceof AppError && error.status === 400)) { throw error; } }
  }
  return available;
}
function dto(row: ParliamentaryItem, names: Map<string, string>) {
  return { id: row.id, title: row.title, kind: row.kind, chamber: row.chamber, reference: row.reference, sourceUrl: row.sourceUrl,
    description: row.description, assignedTo: row.assignedTo?.toString() ?? null, assignedToName: names.get(String(row.assignedTo)) ?? null,
    dueOn: row.dueOn?.toISOString().slice(0, 10) ?? null, status: row.status, version: row.version,
    createdByName: names.get(String(row.createdBy)) ?? "Cont indisponibil", updatedAt: row.updatedAt.toISOString(),
    nextStatuses: parliamentaryTransitions[row.status as ParliamentaryStatus],
  };
}
function fields(input: ParliamentaryFields) {
  return { title: input.title, kind: input.kind, chamber: input.chamber, reference: input.reference, sourceUrl: input.sourceUrl,
    description: input.description, assignedTo: input.assignedTo ? BigInt(input.assignedTo) : null,
    dueOn: input.dueOn ? new Date(`${input.dueOn}T00:00:00Z`) : null };
}
export async function listParliamentary(filters: ParliamentaryQuery) {
  const where: Prisma.ParliamentaryItemWhereInput = {
    ...(filters.status ? { status: filters.status } : {}), ...(filters.chamber ? { chamber: filters.chamber } : {}),
    AND: [filters.pending === "true" ? pendingParliamentaryWhere() : {}, filters.search ? { OR: [
      { title: { contains: filters.search, mode: "insensitive" } }, { reference: { contains: filters.search, mode: "insensitive" } },
    ] } : {}],
  };
  const [rows, total] = await prisma.$transaction([
    prisma.parliamentaryItem.findMany({ where, orderBy: [{ dueOn: { sort: "asc", nulls: "last" } }, { id: "asc" }], skip: filters.offset, take: filters.limit }),
    prisma.parliamentaryItem.count({ where }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  const names = await userNames(rows.flatMap((row) => [row.assignedTo, row.createdBy]));
  return { rows: rows.map((row) => dto(row, names)), total };
}
export async function createParliamentary(input: ParliamentaryFields & { requestId: string }, access: AdminAccessContext) {
  await validateAssignee(input.assignedTo);
  const hash = requestHash({ ...input, actorId: access.actor.id });
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.parliamentaryItem.create({ data: { id: input.requestId, requestHash: hash, ...fields(input), createdBy: BigInt(access.actor.id), updatedBy: BigInt(access.actor.id) } });
      await recordAdminAudit({ actor: { ...access.actor, userId: access.actor.id }, action: "parliamentary.create", targetType: "parliamentary_item", targetId: row.id,
        details: { title: input.title, kind: input.kind, chamber: input.chamber, assignedTo: input.assignedTo, dueOn: input.dueOn } }, tx);
      return { id: row.id, version: row.version };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.parliamentaryItem.findUnique({ where: { id: input.requestId } });
      if (existing?.requestHash === hash) { return { id: existing.id, version: existing.version }; }
      throw conflict();
    }
    throw error;
  }
}
export async function changeParliamentary(id: string, version: number, access: AdminAccessContext, change:
  { action: "update"; fields: ParliamentaryFields } | { action: "status"; status: ParliamentaryStatus; reason: string }
) {
  if (change.action === "update") { await validateAssignee(change.fields.assignedTo); }
  return prisma.$transaction(async (tx) => {
    const current = await tx.parliamentaryItem.findUnique({ where: { id } });
    if (!current) { throw new AppError(404, "ADMIN_RECORD_NOT_FOUND", "Inițiativa nu există."); }
    if (current.version !== version || !openParliamentaryStatuses.includes(current.status)) { throw conflict(); }
    if (change.action === "status" && !parliamentaryTransitions[current.status as ParliamentaryStatus].includes(change.status)) { throw conflict(); }
    if (change.action === "status" && change.status === "submitted" && (!current.assignedTo || !current.reference.trim())) {
      throw new AppError(400, "ADMIN_RECORD_INVALID", "Înainte de înregistrarea depunerii, completează responsabilul și referința documentului.");
    }
    const data = change.action === "update" ? fields(change.fields) : { status: change.status };
    const updated = await tx.parliamentaryItem.updateMany({ where: { id, version, status: current.status }, data: { ...data, version: { increment: 1 }, updatedBy: BigInt(access.actor.id), updatedAt: new Date() } });
    if (updated.count !== 1) { throw conflict(); }
    await recordAdminAudit({ actor: { ...access.actor, userId: access.actor.id }, action: `parliamentary.${change.action}`, targetType: "parliamentary_item", targetId: id,
      details: { version: version + 1, ...(change.action === "status" ? { fromStatus: current.status, toStatus: change.status, reason: change.reason } : {
        before: { title: current.title, kind: current.kind, chamber: current.chamber, reference: current.reference, sourceUrl: current.sourceUrl, description: current.description, assignedTo: current.assignedTo?.toString() ?? null, dueOn: current.dueOn?.toISOString().slice(0, 10) ?? null }, after: change.fields,
      }) } }, tx);
    return { id, version: version + 1 };
  });
}
