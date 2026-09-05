import { z } from "zod";

export const politicalOperationTypes = ["event", "campaign", "volunteer_task"] as const;
export const politicalOperationStatuses = ["draft", "open", "closed", "archived"] as const;
export const politicalOperationVisibilities = ["public", "members", "internal"] as const;
export const participantStatuses = [
  "invited",
  "confirmed",
  "waitlisted",
  "declined",
  "active",
  "in_progress",
  "reported",
  "completed",
  "cancelled",
] as const;
export const attendanceStatuses = ["not_applicable", "pending", "present", "absent", "excused"] as const;

const nullableDateTime = z.union([z.string().datetime({ offset: true }), z.literal(""), z.null()])
  .optional()
  .transform((value) => value || null);

export const politicalOperationsQuerySchema = z.object({
  actionId: z.string().regex(/^[1-9]\d*$/).optional(),
  type: z.enum(politicalOperationTypes).optional(),
  status: z.enum(politicalOperationStatuses).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
}).strict();

export const createPoliticalOperationSchema = z.object({
  type: z.enum(politicalOperationTypes),
  title: z.string().trim().min(3).max(180),
  summary: z.string().trim().min(10).max(360),
  description: z.string().trim().max(5000).optional().default(""),
  objective: z.string().trim().min(5).max(2000),
  status: z.enum(politicalOperationStatuses).optional().default("draft"),
  visibility: z.enum(politicalOperationVisibilities).optional().default("members"),
  organizationId: z.string().trim().min(1).max(80).nullable().optional().default(null),
  coordinatorUserId: z.string().trim().regex(/^[1-9]\d*$/).nullable().optional().default(null),
  countyIds: z.array(z.number().int().positive()).max(42).optional().default([]),
  startsAt: nullableDateTime,
  endsAt: nullableDateTime,
  participationMode: z.string().trim().max(120).optional().default(""),
  commitment: z.string().trim().max(220).optional().default(""),
  capacity: z.number().int().positive().max(1_000_000).nullable().optional().default(null),
  targetMetric: z.string().trim().max(120).optional().default(""),
  targetValue: z.number().finite().min(0).max(1_000_000_000).nullable().optional().default(null),
}).strict().superRefine((value, context) => {
  if (value.type === "event" && !value.startsAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["startsAt"], message: "Data evenimentului este obligatorie." });
  }
  if (value.startsAt && value.endsAt && new Date(value.endsAt) < new Date(value.startsAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "Data de final precedă începutul." });
  }
});

export const politicalOperationIdSchema = z.object({
  id: z.string().regex(/^[1-9]\d*$/),
}).strict();

export const politicalParticipantIdSchema = z.object({
  id: z.string().regex(/^[1-9]\d*$/),
}).strict();

export const updatePoliticalOperationSchema = z.object({
  coordinatorUserId: z.string().regex(/^[1-9]\d*$/).nullable().optional(),
  status: z.enum(politicalOperationStatuses).optional(),
  resultValue: z.number().finite().min(0).max(1_000_000_000).nullable().optional(),
  resultSummary: z.string().trim().max(5000).optional(),
  expectedVersion: z.number().int().positive(),
}).strict().refine(
  (value) => value.status !== undefined || value.resultValue !== undefined || value.resultSummary !== undefined || value.coordinatorUserId !== undefined,
  "Trimite cel puțin un câmp de actualizat.",
);

export const addPoliticalParticipantSchema = z.object({
  email: z.string().trim().email().max(180).transform((value) => value.toLowerCase()),
  dueAt: nullableDateTime,
  notes: z.string().trim().max(1200).optional().default(""),
}).strict();

export const updatePoliticalParticipantSchema = z.object({
  status: z.enum(participantStatuses).optional(),
  attendanceStatus: z.enum(attendanceStatuses).optional(),
  report: z.string().trim().max(5000).optional(),
  result: z.string().trim().max(3000).optional(),
  hours: z.number().finite().min(0).max(10000).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Trimite cel puțin un câmp de actualizat.");

export type PoliticalOperationsQuery = z.output<typeof politicalOperationsQuerySchema>;
export type CreatePoliticalOperationInput = z.output<typeof createPoliticalOperationSchema>;
export type UpdatePoliticalOperationInput = z.output<typeof updatePoliticalOperationSchema>;
export type AddPoliticalParticipantInput = z.output<typeof addPoliticalParticipantSchema>;
export type UpdatePoliticalParticipantInput = z.output<typeof updatePoliticalParticipantSchema>;
export type PoliticalOperationType = (typeof politicalOperationTypes)[number];
