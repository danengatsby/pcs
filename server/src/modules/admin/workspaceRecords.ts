import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";

export const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= "2000-01-01" && value <= "2100-12-31";
}, "Data calendaristică trebuie să fie validă, între 2000 și 2100.");
export const recordIdSchema = z.object({ id: z.string().uuid() });
export const pagination = {
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
};
export const versionSchema = z.number().int().positive();
export const reasonSchema = z.string().trim().min(10).max(2000);
export const requestHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const conflict = () => new AppError(409, "ADMIN_RECORD_CONFLICT", "Înregistrarea a fost modificată sau operația nu este permisă în starea curentă. Reîncarcă registrul.");

export function parseRecord<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) { throw new AppError(400, "ADMIN_RECORD_INVALID", result.error.issues[0]?.message ?? "Date invalide."); }
  return result.data;
}

export async function userNames(ids: Array<bigint | null>): Promise<Map<string, string>> {
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(ids.filter((id): id is bigint => id !== null))] } }, select: { id: true, fullName: true } });
  return new Map(users.map((user) => [user.id.toString(), user.fullName]));
}

export async function recordHistory(targetType: string, id: string) {
  const rows = await prisma.adminAuditLog.findMany({ where: { targetType, targetId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 });
  const names = await userNames(rows.map((row) => row.actorUserId));
  return rows.map((row) => ({ id: row.id.toString(), action: row.action, actorName: names.get(String(row.actorUserId)) ?? (row.actorEmail || "Cont indisponibil"), createdAt: row.createdAt.toISOString(), details: row.details }));
}
