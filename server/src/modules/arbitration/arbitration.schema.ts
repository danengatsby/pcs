import { z } from "zod";

export const caseTypes = ["disciplinary", "member_dispute", "competence", "election", "other"] as const;
export const partyRoles = ["claimant", "respondent", "witness"] as const;
export const decisionOutcomes = ["upheld", "rejected", "partially_upheld", "dismissed"] as const;

const dateTime = z.string().datetime({ offset: true });
const numericId = z.coerce.number().int().positive();

export const caseIdSchema = z.object({ id: numericId });
export const createCaseSchema = z.object({
  organizationId: z.string().trim().min(1).max(80).nullable().optional(),
  caseType: z.enum(caseTypes),
  subject: z.string().trim().min(5).max(180),
  facts: z.string().trim().min(20).max(20_000),
  legalBasis: z.string().trim().max(5000).optional().default(""),
  responseDueAt: dateTime.nullable().optional(),
}).strict();

export const partySchema = z.object({ userId: numericId.nullable().optional(), fullName: z.string().trim().min(3).max(160), partyRole: z.enum(partyRoles) }).strict();
export const evidenceSchema = z.object({ title: z.string().trim().min(3).max(180), documentPath: z.string().trim().min(1).max(320), description: z.string().trim().max(5000).optional().default("") }).strict();
export const conflictSchema = z.object({ arbitratorUserId: numericId, reason: z.string().trim().min(10).max(5000) }).strict();
export const decisionSchema = z.object({ outcome: z.enum(decisionOutcomes), reasoning: z.string().trim().min(20).max(20_000) }).strict();
export const appealSchema = z.object({ grounds: z.string().trim().min(20).max(20_000), dueAt: dateTime.nullable().optional() }).strict();

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type PartyInput = z.infer<typeof partySchema>;
export type EvidenceInput = z.infer<typeof evidenceSchema>;
export type ConflictInput = z.infer<typeof conflictSchema>;
export type DecisionInput = z.infer<typeof decisionSchema>;
export type AppealInput = z.infer<typeof appealSchema>;