import { z } from "zod";

export const interventionKinds = ["uncontacted", "unled_branches", "overdue_objectives", "uncoordinated_events", "unreviewed_reports", "expiring_records"] as const;
export const expirySources = ["document", "mandate_decision", "congress_decision", "arbitration_decision"] as const;
export const interventionQuerySchema = z.object({
  kind: z.enum(interventionKinds).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
}).strict();
export const expiryQuerySchema = z.object({
  record: z.string().regex(/^(document|mandate_decision|congress_decision|arbitration_decision):[1-9]\d*$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
}).strict();
export const expiryParamsSchema = z.object({ source: z.enum(expirySources), id: z.string().regex(/^[1-9]\d*$/) });
export const expiryUpdateSchema = z.object({
  expiresOn: z.string().date().nullable(),
  expectedExpiresOn: z.string().date().nullable(),
}).strict();
export type InterventionQuery = z.infer<typeof interventionQuerySchema>;
export type ExpiryQuery = z.infer<typeof expiryQuerySchema>;
export type ExpirySource = (typeof expirySources)[number];
