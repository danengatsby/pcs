import { z } from "zod";

export const electionTypes = ["parlamentare", "locale", "prezidentiale", "europarlamentare"] as const;

export const listElectionsQuerySchema = z.object({
  type: z.enum(electionTypes).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).max(10000).optional().default(0),
});

export type ListElectionsQuery = z.infer<typeof listElectionsQuerySchema>;

export type ElectionRecord = {
  id: string;
  type: (typeof electionTypes)[number];
  year: number;
  scope: string;
  candidatesCount: number;
  createdAt: string;
};
