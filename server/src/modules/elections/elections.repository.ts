import { query } from "../../lib/db.js";
import type { ElectionRecord, ListElectionsQuery } from "./elections.schema.js";

export async function listElectionsRepository(filters: ListElectionsQuery): Promise<{
  rows: ElectionRecord[];
  total: number;
}> {
  const result = await query<{
    id: string; election_type: ElectionRecord["type"]; election_year: number;
    scope: string; candidates_count: number; created_at: Date; total_count: string;
  }>(`
    SELECT id, election_type, election_year, scope, candidates_count, created_at,
      COUNT(*) OVER() AS total_count
    FROM electoral_operations
    WHERE status = 'published'
      AND ($1::varchar IS NULL OR election_type = $1)
      AND ($2::integer IS NULL OR election_year = $2)
    ORDER BY election_year DESC, created_at DESC
    LIMIT $3 OFFSET $4
  `, [filters.type ?? null, filters.year ?? null, filters.limit, filters.offset]);
  return {
    rows: result.rows.map((row) => ({
      id: row.id.toString(), type: row.election_type, year: row.election_year,
      scope: row.scope, candidatesCount: row.candidates_count,
      createdAt: row.created_at.toISOString(),
    })),
    total: Number(result.rows[0]?.total_count ?? 0),
  };
}
