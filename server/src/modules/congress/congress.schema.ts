import { z } from "zod";

export const congressPurposes = ["ordinary", "extraordinary", "founding"] as const;
export const congressStatuses = ["draft", "open", "closed", "validated", "cancelled"] as const;
export const voteChoices = ["yes", "no", "abstain"] as const;

const dateTime = z.string().datetime({ offset: true });
const id = z.coerce.number().int().positive();

export const congressIdSchema = z.object({ id });
export const createCongressSchema = z.object({
  organizationId: z.string().trim().min(1).max(80),
  title: z.string().trim().min(5).max(180),
  purpose: z.enum(congressPurposes),
  startsAt: dateTime,
  endsAt: dateTime,
  quorum: z.coerce.number().int().positive(),
}).strict().superRefine((value, context) => {
  if (Date.parse(value.endsAt) <= Date.parse(value.startsAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Închiderea trebuie să fie după deschidere." });
  }
});

export const delegateSchema = z.object({
  userId: id.nullable().optional(),
  fullName: z.string().trim().min(3).max(160),
  organizationId: z.string().trim().min(1).max(80),
  selectedBy: z.string().trim().max(180).optional().default(""),
}).strict();

export const candidacySchema = z.object({
  candidateUserId: id.nullable().optional(),
  candidateName: z.string().trim().min(3).max(160),
  office: z.string().trim().min(2).max(120),
}).strict();

export const castVoteSchema = z.object({
  candidacyId: id,
  choice: z.enum(voteChoices),
}).strict();

export type CreateCongressInput = z.infer<typeof createCongressSchema>;
export type DelegateInput = z.infer<typeof delegateSchema>;
export type CandidacyInput = z.infer<typeof candidacySchema>;
export type CastVoteInput = z.infer<typeof castVoteSchema>;