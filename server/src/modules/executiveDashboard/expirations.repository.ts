import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type { AdminAccessContext } from "../../lib/adminAuthorization.js";
import type { ExpiryQuery, ExpirySource } from "./interventions.schema.js";

export function expiryRecordsSql(access: AdminAccessContext): Prisma.Sql {
  const scope = access.scope;
  const ids = scope.organizationIds.length ? Prisma.join(scope.organizationIds) : Prisma.sql`NULL`;
  return Prisma.sql`
    SELECT 'document'::text AS source, d.id::text, d.title, NULL::text AS organization_id, d.expires_on
    FROM member_documents d WHERE ${scope.national} AND d.status = 'published'
    UNION ALL
    SELECT 'mandate_decision', d.id::text, 'Decizia ' || d.decision_number || ' · ' || o.name, o.id, d.expires_on
    FROM organization_mandate_decisions d JOIN organizations o ON o.id = d.organization_id
    WHERE ${access.capabilities.includes("organization.read")} AND (${scope.national} OR o.id IN (${ids}))
    UNION ALL
    SELECT 'congress_decision', d.id::text, 'Congres: ' || c.title || ' · ' || LEFT(d.decision_text, 160), c.organization_id, d.expires_on
    FROM congress_decisions d JOIN congresses c ON c.id = d.congress_id
    WHERE ${access.capabilities.includes("congress.read")} AND c.status <> 'cancelled'
      AND (${scope.national} OR c.organization_id IN (${ids}))
    UNION ALL
    SELECT 'arbitration_decision', d.id::text, 'Decizie în dosarul ' || a.case_number, a.organization_id, d.expires_on
    FROM arbitration_decisions d JOIN arbitration_cases a ON a.id = d.case_id
    WHERE ${access.capabilities.includes("arbitration.read")}
      AND (${scope.national} OR a.organization_id IN (${ids}))
  `;
}

export async function listExpiryRecords(access: AdminAccessContext, filters: ExpiryQuery) {
  const [result] = await prisma.$queryRaw<Array<{ data: {
    rows: Array<{ source: ExpirySource; id: string; title: string; expiresOn: string | null }>;
    total: number;
  } }>>(Prisma.sql`
    WITH records AS (${expiryRecordsSql(access)}), filtered AS (
      SELECT * FROM records WHERE (${filters.record ?? null}::text IS NULL OR source || ':' || id = ${filters.record ?? null})
    )
    SELECT jsonb_build_object('total', (SELECT COUNT(*) FROM filtered), 'rows', COALESCE((
      SELECT jsonb_agg(row) FROM (
        SELECT source, id, title, expires_on::text AS "expiresOn" FROM filtered
        ORDER BY expires_on ASC NULLS FIRST, source, id LIMIT ${filters.limit} OFFSET ${filters.offset}
      ) row
    ), '[]'::jsonb)) AS data
  `);
  return { ...result.data, ...filters };
}

// Identifiers come exclusively from this fixed map, never from a request string.
const expiryTables: Record<ExpirySource, string> = {
  document: "member_documents", mandate_decision: "organization_mandate_decisions",
  congress_decision: "congress_decisions", arbitration_decision: "arbitration_decisions",
};
export async function updateExpiryRecord(source: ExpirySource, id: string, expiresOn: string | null, expectedExpiresOn: string | null) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    UPDATE ${Prisma.raw(expiryTables[source])} SET expires_on = ${expiresOn}::date
    WHERE id = ${id}::bigint AND expires_on IS NOT DISTINCT FROM ${expectedExpiresOn}::date
    RETURNING id::text
  `);
  return rows[0] ?? null;
}
