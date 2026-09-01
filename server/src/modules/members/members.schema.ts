import { z } from "zod";

export const memberWorkflowStatuses = ["nou", "validat", "contactat", "activ"] as const;

export const listMembersQuerySchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  status: z.enum(memberWorkflowStatuses).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  offset: z.coerce.number().int().min(0).max(5000).optional().default(0),
});

export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>;
