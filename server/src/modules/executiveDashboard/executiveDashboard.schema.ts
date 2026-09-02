import { z } from "zod";

export const executiveTargetKeys = [
  "contact_rate",
  "member_conversion_rate",
  "overdue_cases",
  "active_organizations",
] as const;

export const executiveTargetKeySchema = z.enum(executiveTargetKeys);

export const updateExecutiveTargetSchema = z.object({
  targetValue: z.coerce.number().finite().min(0).max(100000),
}).strict();

export type ExecutiveTargetKey = (typeof executiveTargetKeys)[number];
export type UpdateExecutiveTargetInput = z.infer<typeof updateExecutiveTargetSchema>;
