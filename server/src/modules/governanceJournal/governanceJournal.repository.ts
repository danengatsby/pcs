import { query } from "../../lib/db.js";
import type { GovernanceJournalQuery } from "./governanceJournal.schema.js";

export async function listGovernanceJournal(input: GovernanceJournalQuery) {
  const result = await query<{
    id: string; decision_type: "mandate" | "congress" | "arbitration"; decision: string;
    issuing_body: string; decision_date: string | Date; quorum: number | null;
    result: string; source_path: string; total_count: string;
  }>(`
    SELECT journal.*, COUNT(*) OVER() AS total_count FROM (
      SELECT d.id::text AS id, 'mandate'::text AS decision_type,
        'Mandat: ' || m.position_title AS decision,
        d.issuing_body, d.decision_date, NULL::integer AS quorum,
        m.status AS result, d.minutes_path AS source_path
      FROM organization_mandate_decisions d
      JOIN organization_leadership_mandates m ON m.decision_id = d.id
      UNION ALL
      SELECT d.id::text, 'congress'::text, d.decision_text,
        'Congresul: ' || c.title, d.created_at::date, c.quorum,
        COALESCE(d.evidence->>'result', c.status), ''
      FROM congress_decisions d
      JOIN congresses c ON c.id = d.congress_id
      WHERE c.status = 'validated'
      UNION ALL
      SELECT d.id::text, 'arbitration'::text,
        'Decizie în dosarul ' || a.case_number,
        'Comisia de arbitraj', d.decided_at::date, NULL::integer,
        d.outcome, ''
      FROM arbitration_decisions d
      JOIN arbitration_cases a ON a.id = d.case_id
      WHERE a.status IN ('decided', 'closed')
    ) journal
    WHERE ($1::varchar IS NULL OR decision_type = $1)
      AND ($2::date IS NULL OR decision_date >= $2::date)
      AND ($3::date IS NULL OR decision_date <= $3::date)
    ORDER BY decision_date DESC, id DESC
    LIMIT $4 OFFSET $5
  `, [input.type ?? null, input.from ?? null, input.to ?? null, input.limit, input.offset]);
  return {
    rows: result.rows.map((row) => ({
      id: row.id,
      type: row.decision_type,
      decision: row.decision,
      issuingBody: row.issuing_body,
      date: new Date(row.decision_date).toISOString().slice(0, 10),
      quorum: row.quorum,
      result: row.result,
      sourcePath: row.source_path || null,
    })),
    total: Number(result.rows[0]?.total_count ?? 0),
  };
}