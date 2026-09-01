import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type { UserRole } from "../../lib/authToken.js";
import type { AdminMembersDashboardQuery } from "./adminDashboard.schema.js";

export type AdminMembersDashboardGroupKey = "aderenti" | "membri" | "organizatori";

export type AdminMembersDashboardUserRow = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: string;
};

type AdminMembersDashboardSqlRow = {
  groupKey: AdminMembersDashboardGroupKey;
  groupCount: bigint | number;
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: Date;
};

function buildSearchWhereClause(
  search: string,
  fullNameColumn: Prisma.Sql,
  emailColumn: Prisma.Sql
): Prisma.Sql {
  const trimmedSearch = search.trim();
  if (!trimmedSearch) {
    return Prisma.sql``;
  }

  const pattern = `%${trimmedSearch}%`;
  return Prisma.sql`
    WHERE (
      ${fullNameColumn} ILIKE ${pattern}
      OR ${emailColumn} ILIKE ${pattern}
    )
  `;
}

function mapDashboardRow(row: AdminMembersDashboardSqlRow): AdminMembersDashboardUserRow {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
  };
}

function buildAdminMembersDashboardQuery(filters: AdminMembersDashboardQuery): Prisma.Sql {
  const userSearchWhere = buildSearchWhereClause(
    filters.search,
    Prisma.raw("u.full_name"),
    Prisma.raw("u.email")
  );
  const volunteerSearchWhere = buildSearchWhereClause(
    filters.search,
    Prisma.raw("v.full_name"),
    Prisma.raw("v.email")
  );

  return Prisma.sql`
    WITH user_rows AS (
      SELECT
        u.id,
        u.full_name,
        LOWER(u.email) AS email_key,
        LOWER(u.email) AS email_normalized,
        u.role AS normalized_role,
        u.created_at
      FROM users u
      ${userSearchWhere}
    ),
    volunteer_rows AS (
      SELECT
        v.id,
        v.full_name,
        LOWER(v.email) AS email_key,
        LOWER(v.email) AS email_normalized,
        v.workflow_status,
        v.created_at
      FROM volunteers v
      ${volunteerSearchWhere}
    ),
    combined AS (
      SELECT
        COALESCE(u.id::text, 'volunteer:' || v.id::text) AS entry_id,
        COALESCE(u.full_name, v.full_name, '') AS full_name,
        COALESCE(u.email_normalized, v.email_normalized, '') AS email,
        COALESCE(GREATEST(u.created_at, v.created_at), u.created_at, v.created_at, TO_TIMESTAMP(0)) AS created_at,
        CASE
          WHEN u.normalized_role IN (
            'SUSTINATOR',
            'ADERENT',
            'MEMBRU',
            'CONSILIER',
            'SECRETAR',
            'VICEPRESEDINTE',
            'PRESEDINTE'
          ) THEN u.normalized_role
          WHEN v.workflow_status = 'activ' THEN 'MEMBRU'
          WHEN v.workflow_status IN ('contactat', 'validat') THEN 'ADERENT'
          ELSE 'SUSTINATOR'
        END AS resolved_role
      FROM user_rows u
      FULL OUTER JOIN volunteer_rows v
        ON v.email_key = u.email_key
    ),
    grouped AS (
      SELECT
        CASE
          WHEN combined.resolved_role = 'ADERENT' THEN 'aderenti'
          WHEN combined.resolved_role = 'MEMBRU' THEN 'membri'
          WHEN combined.resolved_role IN ('CONSILIER', 'SECRETAR', 'VICEPRESEDINTE', 'PRESEDINTE') THEN 'organizatori'
          ELSE NULL
        END AS group_key,
        combined.entry_id AS id,
        combined.full_name AS full_name,
        combined.email,
        combined.resolved_role AS role,
        combined.created_at
      FROM combined
    ),
    ranked_groups AS (
      SELECT
        grouped.group_key,
        grouped.id,
        grouped.full_name,
        grouped.email,
        grouped.role,
        grouped.created_at,
        COUNT(*) OVER (PARTITION BY grouped.group_key) AS group_count,
        ROW_NUMBER() OVER (
          PARTITION BY grouped.group_key
          ORDER BY grouped.created_at DESC, grouped.id DESC
        ) AS row_num
      FROM grouped
      WHERE grouped.group_key IS NOT NULL
    )
    SELECT
      ranked_groups.group_key AS "groupKey",
      ranked_groups.group_count AS "groupCount",
      ranked_groups.id,
      ranked_groups.full_name AS "fullName",
      ranked_groups.email,
      ranked_groups.role,
      ranked_groups.created_at AS "createdAt"
    FROM ranked_groups
    WHERE ranked_groups.row_num <= ${filters.limit}
    ORDER BY ranked_groups.group_key ASC, ranked_groups.created_at DESC, ranked_groups.id DESC
  `;
}

export async function listAdminMembersDashboardFromRepository(filters: AdminMembersDashboardQuery): Promise<{
  aderenti: {
    count: number;
    rows: AdminMembersDashboardUserRow[];
  };
  membri: {
    count: number;
    rows: AdminMembersDashboardUserRow[];
  };
  organizatori: {
    count: number;
    rows: AdminMembersDashboardUserRow[];
  };
}> {
  const rows = await prisma.$queryRaw<AdminMembersDashboardSqlRow[]>(
    buildAdminMembersDashboardQuery(filters)
  );

  const groupedRows: Record<AdminMembersDashboardGroupKey, { count: number; rows: AdminMembersDashboardUserRow[] }> = {
    aderenti: { count: 0, rows: [] },
    membri: { count: 0, rows: [] },
    organizatori: { count: 0, rows: [] },
  };

  for (const row of rows) {
    const group = groupedRows[row.groupKey];
    group.count = Number(row.groupCount);
    group.rows.push(mapDashboardRow(row));
  }

  return {
    aderenti: groupedRows.aderenti,
    membri: groupedRows.membri,
    organizatori: groupedRows.organizatori,
  };
}
