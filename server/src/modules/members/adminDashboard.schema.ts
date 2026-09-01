import { z } from "zod";

export const adminMembersDashboardQuerySchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
});

export type AdminMembersDashboardQuery = z.infer<typeof adminMembersDashboardQuerySchema>;
