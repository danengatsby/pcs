import { z } from "zod";

export const financeRecordTypes = ["income", "expense"] as const;

export const listFinanceQuerySchema = z.object({
  type: z.enum(financeRecordTypes).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).max(10000).optional().default(0),
});

export type ListFinanceQuery = z.infer<typeof listFinanceQuerySchema>;

export type FinanceRecord = {
  id: string;
  type: (typeof financeRecordTypes)[number];
  source: string;
  amount: number;
  currency: "RON";
  year: number;
  createdAt: string;
};
