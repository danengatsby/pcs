import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type { AdminAccessContext } from "../../lib/adminAuthorization.js";
import { executiveScopeCondition } from "./executiveDashboard.repository.js";
import { expiryRecordsSql } from "./expirations.repository.js";
import { interventionKinds, type InterventionQuery } from "./interventions.schema.js";

export type InterventionRow = {
  key: string; kind: (typeof interventionKinds)[number]; title: string; context: string;
  priority: "critical" | "high" | "normal"; dueAt: string | null; targetId: string; parentId: string | null;
};
export type InterventionData = {
  generatedAt: string; rows: Array<InterventionRow & { href: string }>;
  counts: Partial<Record<(typeof interventionKinds)[number], number>>;
  total: number; limit: number; offset: number;
  expiryCoverage: { tracked: number; missing: number; windowDays: number };
};

export async function readExecutiveInterventions(access: AdminAccessContext, filters: InterventionQuery, now = new Date()): Promise<InterventionData> {
  const scope = access.scope;
  const ids = scope.organizationIds.length ? Prisma.join(scope.organizationIds) : Prisma.sql`NULL`;
  const counties = [...new Set([...scope.countyIds, ...scope.localities.map((item) => item.countyId)])];
  const countyIds = counties.length ? Prisma.join(counties) : Prisma.sql`NULL`;
  const actionScope = Prisma.sql`(${scope.national} OR action.organization_id IN (${ids}) OR EXISTS (
    SELECT 1 FROM mobilization_action_counties mac WHERE mac.action_id = action.id AND mac.county_id IN (${countyIds})
  ))`;
  const today = now.toISOString().slice(0, 10);
  const [result] = await prisma.$queryRaw<Array<{ data: {
    rows: InterventionRow[]; counts: InterventionData["counts"]; total: number;
    expiryCoverage: InterventionData["expiryCoverage"];
  } }>>(Prisma.sql`
    WITH expiry_records AS (${expiryRecordsSql(access)}), interventions AS (
      SELECT DISTINCT 'uncontacted:' || v.id AS key, 'uncontacted' AS kind,
        v.full_name AS title, v.county AS context, v.id::text AS target_id, NULL::text AS parent_id,
        CASE WHEN v.created_at < ${now}::timestamptz - INTERVAL '7 days' THEN 'critical' ELSE 'high' END AS priority,
        v.created_at + INTERVAL '48 hours' AS due_at
      FROM volunteers v LEFT JOIN membership_records mr ON mr.volunteer_id = v.id OR LOWER(mr.email) = LOWER(v.email)
      WHERE ${access.capabilities.includes("recruitment.read")} AND ${executiveScopeCondition(scope)}
        AND v.created_at < ${now}::timestamptz - INTERVAL '48 hours'
        AND v.last_contact_at IS NULL AND v.workflow_status NOT IN ('contactat', 'activ')
      UNION ALL
      SELECT 'unled_branches:' || o.id, 'unled_branches', o.name, o.county, o.id, NULL, 'high', NULL::timestamptz
      FROM organizations o WHERE ${access.capabilities.includes("organization.read")}
        AND o.level <> 'national' AND o.status IN ('forming', 'active') AND (${scope.national} OR o.id IN (${ids}))
        AND NOT EXISTS (SELECT 1 FROM organization_leadership_mandates m WHERE m.organization_id = o.id
          AND m.status = 'active' AND m.started_at <= ${today}::date AND (m.ended_at IS NULL OR m.ended_at >= ${today}::date))
      UNION ALL
      SELECT 'overdue_objectives:' || ob.id, 'overdue_objectives', ob.title, o.name, ob.id::text, o.id,
        'high', ob.due_date::timestamp AT TIME ZONE 'UTC'
      FROM organization_objectives ob JOIN organizations o ON o.id = ob.organization_id
      WHERE ${access.capabilities.includes("organization.read")} AND (${scope.national} OR o.id IN (${ids}))
        AND o.status IN ('forming', 'active') AND ob.status IN ('planned', 'in_progress', 'at_risk') AND ob.due_date < ${today}::date
      UNION ALL
      SELECT 'uncoordinated_events:' || action.id, 'uncoordinated_events', action.title, 'Coordonator neatribuit', action.id::text, NULL,
        CASE WHEN action.starts_at <= ${now}::timestamptz + INTERVAL '48 hours' THEN 'critical' ELSE 'high' END, action.starts_at
      FROM mobilization_actions action WHERE ${access.capabilities.includes("mobilization.read")} AND ${actionScope}
        AND action.action_type = 'event' AND action.status IN ('draft', 'open') AND action.coordinator_user_id IS NULL
      UNION ALL
      SELECT 'unreviewed_reports:' || p.id, 'unreviewed_reports', p.full_name || ' · ' || action.title,
        p.hours::text || ' ore raportate', p.id::text, action.id::text,
        CASE WHEN p.reported_at < ${now}::timestamptz - INTERVAL '48 hours' THEN 'high' ELSE 'normal' END,
        COALESCE(p.reported_at, p.updated_at) + INTERVAL '48 hours'
      FROM mobilization_participants p JOIN mobilization_actions action ON action.id = p.action_id
      WHERE ${access.capabilities.includes("mobilization.read")} AND ${actionScope}
        AND p.status = 'reported' AND (p.reviewed_at IS NULL OR p.reported_at > p.reviewed_at)
      UNION ALL
      SELECT 'expiring_records:' || source || ':' || id, 'expiring_records', title,
        CASE WHEN expires_on < ${today}::date THEN 'Termen expirat' ELSE 'Expiră în cel mult 30 de zile' END,
        source || ':' || id, organization_id,
        CASE WHEN expires_on < ${today}::date THEN 'critical' ELSE 'normal' END,
        expires_on::timestamp AT TIME ZONE 'UTC'
      FROM expiry_records WHERE expires_on <= ${today}::date + 30
    ), filtered AS (
      SELECT * FROM interventions WHERE (${filters.kind ?? null}::text IS NULL OR kind = ${filters.kind ?? null})
    )
    SELECT jsonb_build_object(
      'rows', COALESCE((SELECT jsonb_agg(row) FROM (
        SELECT key, kind, title, context, priority, due_at AS "dueAt", target_id AS "targetId", parent_id AS "parentId"
        FROM filtered ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
          due_at ASC NULLS LAST, key ASC LIMIT ${filters.limit} OFFSET ${filters.offset}
      ) row), '[]'::jsonb),
      'total', (SELECT COUNT(*) FROM filtered),
      'counts', COALESCE((SELECT jsonb_object_agg(kind, total) FROM (SELECT kind, COUNT(*) AS total FROM interventions GROUP BY kind) c), '{}'::jsonb),
      'expiryCoverage', (SELECT jsonb_build_object('tracked', COUNT(expires_on), 'missing', COUNT(*) FILTER (WHERE expires_on IS NULL), 'windowDays', 30) FROM expiry_records)
    ) AS data
  `);
  const readCapability = { uncontacted: "recruitment.read", unled_branches: "organization.read", overdue_objectives: "organization.read", uncoordinated_events: "mobilization.read", unreviewed_reports: "mobilization.read", expiring_records: "executive.read" };
  const counts = Object.fromEntries(interventionKinds.filter((kind) => access.capabilities.includes(readCapability[kind] as typeof access.capabilities[number])).map((kind) => [kind, result.data.counts[kind] ?? 0]));
  return { ...result.data, counts, generatedAt: now.toISOString(), limit: filters.limit, offset: filters.offset,
    rows: result.data.rows.map((row) => ({ ...row, href: interventionHref(row) })) };
}

function interventionHref(row: InterventionRow): string {
  const target = encodeURIComponent(row.targetId);
  if (row.kind === "uncontacted") { return `/admin/volunteers?selected=${target}`; }
  if (row.kind === "unled_branches") { return `/admin/organizations?selected=${target}`; }
  if (row.kind === "overdue_objectives") { return `/admin/organizations?selected=${encodeURIComponent(row.parentId!)}#objective-${target}`; }
  if (row.kind === "uncoordinated_events") { return `/admin/mobilization?action=${target}`; }
  if (row.kind === "unreviewed_reports") { return `/admin/mobilization?action=${encodeURIComponent(row.parentId!)}&participant=${target}#participant-${target}`; }
  return `/admin/dashboard?expiry=${target}#executive-expirations`;
}
