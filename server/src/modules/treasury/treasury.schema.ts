import { z } from "zod";
import { calendarDate, pagination, reasonSchema, versionSchema } from "../admin/workspaceRecords.js";

export const treasuryKinds = ["income", "expense"] as const;
export const treasuryCategories = ["membership_fee", "donation", "subsidy", "operations", "event", "other"] as const;
export const treasuryStatuses = ["draft", "posted", "voided"] as const;
export const treasuryFieldsSchema = z.object({
  organizationId: z.string().trim().min(1).max(80).nullable(),
  kind: z.enum(treasuryKinds),
  category: z.enum(treasuryCategories),
  amount: z.string().regex(/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/, "Suma trebuie să fie pozitivă, cu maximum două zecimale.").refine((value) => Number(value) > 0, "Suma trebuie să fie pozitivă."),
  occurredOn: calendarDate,
  description: z.string().trim().min(5).max(500),
  reference: z.string().trim().min(3).max(180),
}).strict();
export const createTreasurySchema = treasuryFieldsSchema.extend({ requestId: z.string().uuid() }).strict();
export const updateTreasurySchema = treasuryFieldsSchema.extend({ version: versionSchema }).strict();
export const postTreasurySchema = z.object({ version: versionSchema, confirmed: z.literal(true) }).strict();
export const voidTreasurySchema = z.object({ version: versionSchema, reason: reasonSchema }).strict();
export const listTreasurySchema = z.object({
  ...pagination, search: z.string().trim().max(120).default(""),
  kind: z.enum(treasuryKinds).optional(), status: z.enum(treasuryStatuses).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});
export type TreasuryFields = z.infer<typeof treasuryFieldsSchema>;
export type TreasuryQuery = z.infer<typeof listTreasurySchema>;
