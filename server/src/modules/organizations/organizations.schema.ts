import { z } from "zod";

export const organizationLevels = ["national", "county", "local"] as const;

export const listOrganizationsQuerySchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  level: z.enum(organizationLevels).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).max(10000).optional().default(0),
});

export type ListOrganizationsQuery = z.infer<typeof listOrganizationsQuerySchema>;

export type OrganizationRecord = {
  id: string;
  level: (typeof organizationLevels)[number];
  name: string;
  county: string;
  membersCount: number;
  createdAt: string;
};
