import { z } from "zod";

export type AuditRow = {
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

export const emailTestSchema = z.object({
  to: z.string().trim().email().max(180).optional(),
  subject: z.string().trim().min(3).max(180).optional(),
  message: z.string().trim().min(5).max(5000).optional(),
}).strict();

export function parsePositiveInt(raw: unknown, fallback: number, min = 1, max = 500): number {
  const parsed = Number(raw ?? fallback);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.floor(parsed)));
}
