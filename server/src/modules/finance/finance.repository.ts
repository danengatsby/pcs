import { query } from "../../lib/db.js";
import type { FinanceRecord, ListFinanceQuery } from "./finance.schema.js";

export async function listFinanceRepository(filters: ListFinanceQuery): Promise<{ rows: FinanceRecord[]; total: number }> {
  const result = await query<{
    id: string; record_type: FinanceRecord["type"]; source: string; amount: string;
    currency: "RON"; record_year: number; created_at: Date; total_count: string;
  }>(`
    SELECT id, record_type, source, amount, currency, record_year, created_at,
      COUNT(*) OVER() AS total_count
    FROM financial_transparency_records
    WHERE publication_status = 'published'
      AND ($1::varchar IS NULL OR record_type = $1)
      AND ($2::integer IS NULL OR record_year = $2)
    ORDER BY occurred_at DESC NULLS LAST, created_at DESC
    LIMIT $3 OFFSET $4
  `, [filters.type ?? null, filters.year ?? null, filters.limit, filters.offset]);
  return {
    rows: result.rows.map((row) => ({
      id: row.id.toString(), type: row.record_type, source: row.source,
      amount: Number(row.amount), currency: row.currency, year: row.record_year,
      createdAt: row.created_at.toISOString(),
    })),
    total: Number(result.rows[0]?.total_count ?? 0),
  };
}
