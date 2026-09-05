import { z } from "zod";

export const governanceJournalTypes = ["mandate", "congress", "arbitration"] as const;

export const governanceJournalQuerySchema = z.object({
  type: z.enum(governanceJournalTypes).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).max(10000).optional().default(0),
}).superRefine((value, context) => {
  if (value.from && value.to && value.from > value.to) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Intervalul de date este invalid." });
  }
});

export type GovernanceJournalQuery = z.infer<typeof governanceJournalQuerySchema>;