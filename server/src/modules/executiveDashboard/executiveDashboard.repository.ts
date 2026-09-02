import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type { AdminTerritoryScope } from "../../lib/adminAuthorization.js";
import type { ExecutiveTargetKey } from "./executiveDashboard.schema.js";

export type ExecutiveSummarySnapshot = {
  applicationsTotal: number;
  applicationsLast30Days: number;
  contactedTotal: number;
  uncontactedCases: number;
  membersTotal: number;
  overdueCases: number;
  activeOrganizations: number;
  countiesWithoutResponsible: number;
};

export type ExecutiveTrendRow = {
  month: string;
  applications: number;
  contacted: number;
  members: number;
};

export type ExecutiveCountyRow = {
  county: string;
  applications: number;
  contacted: number;
  members: number;
  organizers: number;
  overdue: number;
  hasResponsible: boolean;
};

export type ExecutiveWorkflowRow = {
  status: string;
  count: number;
};

export type ExecutiveTargetRow = {
  key: ExecutiveTargetKey;
  label: string;
  targetValue: number;
  unit: "percent" | "count";
  direction: "at_least" | "at_most";
  updatedAt: string;
};

type SummarySqlRow = {
  applicationsTotal: bigint | number;
  applicationsLast30Days: bigint | number;
  contactedTotal: bigint | number;
  uncontactedCases: bigint | number;
  membersTotal: bigint | number;
  overdueCases: bigint | number;
};

type TrendSqlRow = {
  month: Date;
  applications: bigint | number;
  contacted: bigint | number;
  members: bigint | number;
};

type CountySqlRow = {
  county: string;
  applications: bigint | number;
  contacted: bigint | number;
  members: bigint | number;
  organizers: bigint | number;
  overdue: bigint | number;
};

type CountyResponsibilitySqlRow = {
  county: string;
};

type WorkflowSqlRow = {
  status: string;
  count: bigint | number;
};

function toNumber(value: bigint | number | null | undefined): number {
  return typeof value === "bigint" ? Number(value) : Number(value ?? 0);
}

function memberCondition(): Prisma.Sql {
  return Prisma.sql`mr.status = 'active'`;
}

function contactedCondition(): Prisma.Sql {
  return Prisma.sql`(
    v.workflow_status IN ('contactat', 'activ')
    OR v.last_contact_at IS NOT NULL
  )`;
}

function uncontactedCondition(): Prisma.Sql {
  return Prisma.sql`(
    v.last_contact_at IS NULL
    AND v.workflow_status NOT IN ('contactat', 'activ')
  )`;
}

function overdueCondition(now: Date, untouchedThreshold: Date): Prisma.Sql {
  return Prisma.sql`(
    v.workflow_status <> 'activ'
    AND (
      (v.workflow_status = 'nou' AND v.created_at < ${untouchedThreshold})
      OR (v.follow_up_at IS NOT NULL AND v.follow_up_at < ${now})
      OR (v.reminder_at IS NOT NULL AND v.reminder_at < ${now})
    )
  )`;
}

function executiveScopeCondition(scope: AdminTerritoryScope): Prisma.Sql {
  if (scope.national) {
    return Prisma.sql`TRUE`;
  }
  const organizationCondition = scope.organizationIds.length > 0
    ? Prisma.sql`mr.organization_id IN (${Prisma.join(scope.organizationIds)})`
    : Prisma.sql`FALSE`;
  const geographicConditions: Prisma.Sql[] = [];
  if (scope.countyNames.length > 0) {
    geographicConditions.push(Prisma.sql`LOWER(BTRIM(v.county)) IN (${Prisma.join(
      scope.countyNames.map((county) => county.trim().toLocaleLowerCase("ro-RO"))
    )})`);
  }
  for (const territory of scope.localities) {
    geographicConditions.push(Prisma.sql`(
      LOWER(BTRIM(v.county)) = ${territory.countyName.trim().toLocaleLowerCase("ro-RO")}
      AND LOWER(BTRIM(v.locality)) = ${territory.locality.trim().toLocaleLowerCase("ro-RO")}
    )`);
  }
  const geographicCondition = geographicConditions.length > 0
    ? Prisma.sql`(${Prisma.join(geographicConditions, " OR ")})`
    : Prisma.sql`FALSE`;
  return Prisma.sql`(
    ${organizationCondition}
    OR (mr.organization_id IS NULL AND ${geographicCondition})
  )`;
}

function countyScopeCondition(scope: AdminTerritoryScope): Prisma.Sql {
  if (scope.national) {
    return Prisma.sql`TRUE`;
  }

  const countyIds = [...new Set([
    ...scope.countyIds,
    ...scope.localities.map((territory) => territory.countyId),
  ])];
  if (countyIds.length > 0) {
    return Prisma.sql`c.id IN (${Prisma.join(countyIds)})`;
  }
  if (scope.countyNames.length > 0) {
    return Prisma.sql`LOWER(BTRIM(c.name)) IN (${Prisma.join(
      scope.countyNames.map((county) => county.trim().toLocaleLowerCase("ro-RO"))
    )})`;
  }
  return Prisma.sql`FALSE`;
}

export async function readExecutiveDashboardSnapshot(
  scope: AdminTerritoryScope,
  now = new Date()
): Promise<{
  summary: ExecutiveSummarySnapshot;
  trends: ExecutiveTrendRow[];
  counties: ExecutiveCountyRow[];
  workflow: ExecutiveWorkflowRow[];
  targets: ExecutiveTargetRow[];
  countiesWithoutResponsible: string[];
}> {
  const untouchedThreshold = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const trendStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const contacted = contactedCondition();
  const uncontacted = uncontactedCondition();
  const member = memberCondition();
  const overdue = overdueCondition(now, untouchedThreshold);
  const scoped = executiveScopeCondition(scope);
  const scopedCounties = countyScopeCondition(scope);

  const [summaryRows, trendRows, countyRows, workflowRows, activeOrganizations, targets, countiesWithoutResponsible] = await Promise.all([
    prisma.$queryRaw<SummarySqlRow[]>(Prisma.sql`
      SELECT
        COUNT(*) AS "applicationsTotal",
        COUNT(*) FILTER (WHERE v.created_at >= ${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)}) AS "applicationsLast30Days",
        COUNT(*) FILTER (WHERE ${contacted}) AS "contactedTotal",
        COUNT(*) FILTER (WHERE ${uncontacted}) AS "uncontactedCases",
        COUNT(*) FILTER (WHERE ${member}) AS "membersTotal",
        COUNT(*) FILTER (WHERE ${overdue}) AS "overdueCases"
      FROM volunteers v
      LEFT JOIN membership_records mr
        ON mr.volunteer_id = v.id OR LOWER(mr.email) = LOWER(v.email)
      WHERE ${scoped}
    `),
    prisma.$queryRaw<TrendSqlRow[]>(Prisma.sql`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', ${trendStart}::timestamptz),
          date_trunc('month', ${now}::timestamptz),
          INTERVAL '1 month'
        ) AS month
      )
      SELECT
        months.month,
        COUNT(v.id) FILTER (WHERE ${scoped}) AS applications,
        COUNT(v.id) FILTER (WHERE ${scoped} AND ${contacted}) AS contacted,
        COUNT(v.id) FILTER (WHERE ${scoped} AND ${member}) AS members
      FROM months
      LEFT JOIN volunteers v
        ON v.created_at >= months.month
        AND v.created_at < months.month + INTERVAL '1 month'
      LEFT JOIN membership_records mr
        ON mr.volunteer_id = v.id OR LOWER(mr.email) = LOWER(v.email)
      GROUP BY months.month
      ORDER BY months.month ASC
    `),
    prisma.$queryRaw<CountySqlRow[]>(Prisma.sql`
      SELECT
        v.county,
        COUNT(*) AS applications,
        COUNT(*) FILTER (WHERE ${contacted}) AS contacted,
        COUNT(*) FILTER (WHERE ${member}) AS members,
        COUNT(*) FILTER (
          WHERE ${member}
            AND membership_user.role IN ('CONSILIER', 'SECRETAR', 'VICEPRESEDINTE', 'PRESEDINTE')
        ) AS organizers,
        COUNT(*) FILTER (WHERE ${overdue}) AS overdue
      FROM volunteers v
      LEFT JOIN membership_records mr
        ON mr.volunteer_id = v.id OR LOWER(mr.email) = LOWER(v.email)
      LEFT JOIN users membership_user ON membership_user.id = mr.user_id
      WHERE BTRIM(v.county) <> '' AND ${scoped}
      GROUP BY v.county
      ORDER BY applications DESC, v.county ASC
    `),
    prisma.$queryRaw<WorkflowSqlRow[]>(Prisma.sql`
      SELECT v.workflow_status AS status, COUNT(*) AS count
      FROM volunteers v
      LEFT JOIN membership_records mr
        ON mr.volunteer_id = v.id OR LOWER(mr.email) = LOWER(v.email)
      WHERE ${scoped}
      GROUP BY workflow_status
      ORDER BY workflow_status ASC
    `),
    prisma.organization.count({
      where: {
        status: "active",
        ...(!scope.national ? { id: { in: scope.organizationIds } } : {}),
      },
    }),
    prisma.executiveTarget.findMany({
      orderBy: {
        createdAt: "asc",
      },
      select: {
        key: true,
        label: true,
        targetValue: true,
        unit: true,
        direction: true,
        updatedAt: true,
      },
    }),
    prisma.$queryRaw<CountyResponsibilitySqlRow[]>(Prisma.sql`
      SELECT c.name AS county
      FROM counties c
      WHERE ${scopedCounties}
        AND NOT EXISTS (
          SELECT 1
          FROM organization_territories ot
          JOIN organizations o
            ON o.id = ot.organization_id
           AND o.status IN ('forming', 'active')
          JOIN organization_leadership_mandates olm
            ON olm.organization_id = o.id
           AND olm.status = 'active'
           AND olm.started_at <= ${now}::date
           AND (olm.ended_at IS NULL OR olm.ended_at >= ${now}::date)
          WHERE ot.county_id = c.id
            AND ot.territory_type IN ('county', 'locality')
        )
      ORDER BY c.name ASC
    `),
  ]);

  const summaryRow = summaryRows[0];

  return {
    summary: {
      applicationsTotal: toNumber(summaryRow?.applicationsTotal),
      applicationsLast30Days: toNumber(summaryRow?.applicationsLast30Days),
      contactedTotal: toNumber(summaryRow?.contactedTotal),
      uncontactedCases: toNumber(summaryRow?.uncontactedCases),
      membersTotal: toNumber(summaryRow?.membersTotal),
      overdueCases: toNumber(summaryRow?.overdueCases),
      activeOrganizations,
      countiesWithoutResponsible: countiesWithoutResponsible.length,
    },
    trends: trendRows.map((row) => ({
      month: row.month.toISOString().slice(0, 10),
      applications: toNumber(row.applications),
      contacted: toNumber(row.contacted),
      members: toNumber(row.members),
    })),
    counties: countyRows.map((row) => ({
      county: row.county,
      applications: toNumber(row.applications),
      contacted: toNumber(row.contacted),
      members: toNumber(row.members),
      organizers: toNumber(row.organizers),
      overdue: toNumber(row.overdue),
      hasResponsible: !countiesWithoutResponsible.some((county) => county.county === row.county),
    })),
    workflow: workflowRows.map((row) => ({
      status: row.status,
      count: toNumber(row.count),
    })),
    targets: targets.map((target) => ({
      key: target.key as ExecutiveTargetKey,
      label: target.label,
      targetValue: Number(target.targetValue),
      unit: target.unit as ExecutiveTargetRow["unit"],
      direction: target.direction as ExecutiveTargetRow["direction"],
      updatedAt: target.updatedAt.toISOString(),
    })),
    countiesWithoutResponsible: countiesWithoutResponsible.map((row) => row.county),
  };
}

export async function updateExecutiveTarget(input: {
  key: ExecutiveTargetKey;
  targetValue: number;
  updatedBy: bigint;
}): Promise<{
  previousTargetValue: number;
  target: ExecutiveTargetRow;
} | null> {
  const existing = await prisma.executiveTarget.findUnique({
    where: { key: input.key },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.executiveTarget.update({
    where: { key: input.key },
    data: {
      targetValue: input.targetValue,
      updatedBy: input.updatedBy,
      updatedAt: new Date(),
    },
  });

  return {
    previousTargetValue: Number(existing.targetValue),
    target: {
      key: updated.key as ExecutiveTargetKey,
      label: updated.label,
      targetValue: Number(updated.targetValue),
      unit: updated.unit as ExecutiveTargetRow["unit"],
      direction: updated.direction as ExecutiveTargetRow["direction"],
      updatedAt: updated.updatedAt.toISOString(),
    },
  };
}
