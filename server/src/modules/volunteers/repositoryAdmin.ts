import { Prisma } from "@prisma/client";
import { enqueueAdminAuditEntries } from "../../lib/adminAuditOutbox.js";
import { enqueueNotificationEmails } from "../../lib/notificationOutbox.js";
import { prisma } from "../../lib/prisma.js";
import type { PrismaTx } from "../../lib/prismaTransaction.js";
import { normalizeCountyKey } from "./counties.js";
import type {
  VolunteerAdminRow,
  VolunteerContactChannel,
  VolunteerOwnerOption,
  VolunteerPriority,
  VolunteerPublicRole,
  VolunteerListFilters,
  VolunteerWorkflowStatus,
} from "./types.js";

type VolunteerAdminDbRow = {
  id: bigint;
  fullName: string;
  email: string;
  phone: string;
  county: string;
  locality: string;
  skills: string;
  motivation: string;
  workflowStatus: VolunteerWorkflowStatus;
  internalNotes: string;
  createdAt: Date;
  statusUpdatedAt: Date | null;
  statusUpdatedBy: bigint | null;
  statusUpdatedByRef: {
    id: bigint;
    fullName: string;
    email: string;
  } | null;
  ownerUserId: bigint | null;
  ownerUserRef: {
    id: bigint;
    fullName: string;
    email: string;
    role: string;
  } | null;
  followUpAt: Date | null;
  reminderAt: Date | null;
  lastContactAt: Date | null;
  contactChannel: string | null;
  crmPriority: string;
  rejectionReason: string;
  crmTags: unknown;
  skillTags: unknown;
};

type VolunteerAdminListSqlRow = {
  id: bigint | number;
  volunteerId: bigint | number | null;
  fullName: string;
  email: string;
  phone: string;
  county: string;
  locality: string;
  skills: string;
  motivation: string;
  workflowStatus: VolunteerWorkflowStatus;
  internalNotes: string;
  createdAt: Date;
  statusUpdatedAt: Date | null;
  statusUpdatedByUserId: bigint | number | null;
  statusUpdatedByName: string | null;
  statusUpdatedByEmail: string | null;
  ownerUserId: bigint | number | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerRole: string | null;
  followUpAt: Date | null;
  reminderAt: Date | null;
  lastContactAt: Date | null;
  contactChannel: string | null;
  priority: string | null;
  rejectionReason: string | null;
  tags: unknown;
  skillTags: unknown;
  accountRole: string | null;
  recordSource: "volunteer" | "user" | "both";
};

type VolunteerIdSqlRow = {
  volunteerId: bigint | number;
};

type VolunteerBulkWorkflowSqlRow = {
  id: bigint | number;
  fullName: string;
  email: string;
  county: string;
  locality: string;
  skills: string;
  workflowStatus: VolunteerWorkflowStatus;
  internalNotes: string;
};

type VolunteerBulkDeleteSqlRow = {
  id: bigint | number;
  fullName: string;
  email: string;
  county: string;
  locality: string;
  workflowStatus: VolunteerWorkflowStatus;
};

export type BulkAdminVolunteerWorkflowResult = {
  updatedVolunteerIds: number[];
  skippedVolunteerIds: number[];
  missingVolunteerIds: number[];
  enqueuedEmailCount: number;
  enqueuedAuditCount: number;
};

export type BulkDeleteAdminVolunteerResult = {
  deletedVolunteerIds: number[];
  missingVolunteerIds: number[];
  enqueuedAuditCount: number;
};

const adminVolunteerUserRoles = ["ADERENT", "MEMBRU"] as const;
const volunteerOwnerRoles = ["CONSILIER", "SECRETAR", "VICEPRESEDINTE", "PRESEDINTE"] as const;
type SqlRunner = PrismaTx | typeof prisma;

type BulkAdminActor = {
  userId?: string | number | null;
  email?: string;
  role?: string;
};

function normalizeAccountRole(role: string | null | undefined): Exclude<VolunteerPublicRole, "FARA_CONT"> | null {
  const normalizedRole = (role ?? "").trim().toUpperCase();
  if (
    normalizedRole === "SUSTINATOR"
    || normalizedRole === "ADERENT"
    || normalizedRole === "MEMBRU"
    || normalizedRole === "CONSILIER"
    || normalizedRole === "SECRETAR"
    || normalizedRole === "VICEPRESEDINTE"
    || normalizedRole === "PRESEDINTE"
  ) {
    return normalizedRole;
  }

  return null;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim() ?? "";
  return normalizedValue ? normalizedValue : null;
}

function normalizeVolunteerContactChannel(
  value: string | null | undefined
): VolunteerContactChannel | null {
  if (
    value === "telefon"
    || value === "email"
    || value === "whatsapp"
    || value === "telegram"
    || value === "facebook"
    || value === "intalnire"
    || value === "altul"
  ) {
    return value;
  }

  return null;
}

function normalizeVolunteerPriority(value: string | null | undefined): VolunteerPriority | null {
  if (
    value === "scazuta"
    || value === "medie"
    || value === "ridicata"
    || value === "critica"
  ) {
    return value;
  }

  return null;
}

function parseVolunteerTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalizedTags: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const normalizedValue = item.trim().toLowerCase();
    if (!normalizedValue || seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    normalizedTags.push(normalizedValue);
  }

  return normalizedTags;
}

function mapVolunteerAdminRow(row: VolunteerAdminDbRow): VolunteerAdminRow {
  const statusUpdatedByUserId = row.statusUpdatedBy ? row.statusUpdatedBy.toString() : null;
  const statusUpdatedByName = row.statusUpdatedByRef?.fullName?.trim() || null;
  const statusUpdatedByEmail = row.statusUpdatedByRef?.email?.trim().toLowerCase() || null;

  return {
    id: Number(row.id),
    volunteerId: Number(row.id),
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    county: row.county,
    locality: row.locality,
    skills: row.skills,
    motivation: row.motivation,
    workflowStatus: row.workflowStatus,
    internalNotes: row.internalNotes,
    createdAt: row.createdAt.toISOString(),
    statusUpdatedAt: row.statusUpdatedAt ? row.statusUpdatedAt.toISOString() : null,
    statusUpdatedByUserId,
    statusUpdatedByName,
    statusUpdatedByEmail,
    ownerUserId: row.ownerUserId ? row.ownerUserId.toString() : null,
    ownerName: row.ownerUserRef?.fullName?.trim() || null,
    ownerEmail: row.ownerUserRef?.email?.trim().toLowerCase() || null,
    ownerRole: normalizeAccountRole(row.ownerUserRef?.role),
    followUpAt: row.followUpAt ? row.followUpAt.toISOString() : null,
    reminderAt: row.reminderAt ? row.reminderAt.toISOString() : null,
    lastContactAt: row.lastContactAt ? row.lastContactAt.toISOString() : null,
    contactChannel: normalizeVolunteerContactChannel(row.contactChannel),
    priority: normalizeVolunteerPriority(row.crmPriority),
    rejectionReason: normalizeOptionalText(row.rejectionReason),
    tags: parseVolunteerTags(row.crmTags),
    skillTags: parseVolunteerTags(row.skillTags),
    accountRole: null,
    recordSource: "volunteer",
  };
}

function mapVolunteerAdminListRow(row: VolunteerAdminListSqlRow): VolunteerAdminRow {
  return {
    id: Number(row.id),
    volunteerId: row.volunteerId === null ? null : Number(row.volunteerId),
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    county: row.county,
    locality: row.locality,
    skills: row.skills,
    motivation: row.motivation,
    workflowStatus: row.workflowStatus,
    internalNotes: row.internalNotes,
    createdAt: row.createdAt.toISOString(),
    statusUpdatedAt: row.statusUpdatedAt ? row.statusUpdatedAt.toISOString() : null,
    statusUpdatedByUserId: row.statusUpdatedByUserId === null ? null : String(row.statusUpdatedByUserId),
    statusUpdatedByName: row.statusUpdatedByName?.trim() || null,
    statusUpdatedByEmail: row.statusUpdatedByEmail?.trim().toLowerCase() || null,
    ownerUserId: row.ownerUserId === null ? null : String(row.ownerUserId),
    ownerName: row.ownerName?.trim() || null,
    ownerEmail: row.ownerEmail?.trim().toLowerCase() || null,
    ownerRole: normalizeAccountRole(row.ownerRole),
    followUpAt: row.followUpAt ? row.followUpAt.toISOString() : null,
    reminderAt: row.reminderAt ? row.reminderAt.toISOString() : null,
    lastContactAt: row.lastContactAt ? row.lastContactAt.toISOString() : null,
    contactChannel: normalizeVolunteerContactChannel(row.contactChannel),
    priority: normalizeVolunteerPriority(row.priority),
    rejectionReason: normalizeOptionalText(row.rejectionReason),
    tags: parseVolunteerTags(row.tags),
    skillTags: parseVolunteerTags(row.skillTags),
    accountRole: normalizeAccountRole(row.accountRole),
    recordSource: row.recordSource,
  };
}

function buildVolunteerSearchPattern(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return `%${value}%`;
}

function buildVolunteerAdminWhereConditions(filters: VolunteerListFilters): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];

  if (filters.status) {
    conditions.push(Prisma.sql`combined.workflow_status = ${filters.status}`);
  }

  const countyPattern = buildVolunteerSearchPattern(filters.countyValue);
  if (countyPattern) {
    conditions.push(Prisma.sql`combined.county ILIKE ${countyPattern}`);
  }

  const localityPattern = buildVolunteerSearchPattern(filters.localityValue);
  if (localityPattern) {
    conditions.push(Prisma.sql`combined.locality ILIKE ${localityPattern}`);
  }

  const skillsPattern = buildVolunteerSearchPattern(filters.skillsValue);
  if (skillsPattern) {
    conditions.push(
      Prisma.sql`(
        combined.skills ILIKE ${skillsPattern}
        OR COALESCE(combined.skill_tags::text, '') ILIKE ${skillsPattern}
      )`
    );
  }

  const searchPattern = buildVolunteerSearchPattern(filters.searchValue);
  if (searchPattern) {
    conditions.push(
      Prisma.sql`(
        combined.full_name ILIKE ${searchPattern}
        OR combined.email ILIKE ${searchPattern}
        OR combined.county ILIKE ${searchPattern}
        OR combined.locality ILIKE ${searchPattern}
        OR combined.skills ILIKE ${searchPattern}
        OR COALESCE(combined.owner_name, '') ILIKE ${searchPattern}
        OR COALESCE(combined.owner_email, '') ILIKE ${searchPattern}
        OR COALESCE(combined.rejection_reason, '') ILIKE ${searchPattern}
        OR COALESCE(combined.crm_tags::text, '') ILIKE ${searchPattern}
        OR COALESCE(combined.skill_tags::text, '') ILIKE ${searchPattern}
        OR COALESCE(combined.account_role, '') ILIKE ${searchPattern}
      )`
    );
  }

  return conditions;
}

function buildWhereClause(conditions: Prisma.Sql[]): Prisma.Sql {
  if (conditions.length === 0) {
    return Prisma.sql``;
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}

function buildVolunteerAdminCombinedCte(): Prisma.Sql {
  return Prisma.sql`
    WITH user_rows AS (
      SELECT
        u.id,
        u.full_name,
        LOWER(u.email) AS email_key,
        LOWER(u.email) AS email_normalized,
        u.role,
        u.created_at
      FROM users u
      WHERE u.role IN (${Prisma.join([...adminVolunteerUserRoles])})
    ),
    volunteer_rows AS (
      SELECT
        v.id,
        v.full_name,
        LOWER(v.email) AS email_key,
        LOWER(v.email) AS email_normalized,
        v.phone,
        v.county,
        v.locality,
        v.skills,
        v.motivation,
        v.workflow_status,
        v.internal_notes,
        v.owner_user_id,
        owner_user.full_name AS owner_name,
        LOWER(owner_user.email) AS owner_email,
        owner_user.role AS owner_role,
        v.follow_up_at,
        v.reminder_at,
        v.last_contact_at,
        v.contact_channel,
        v.crm_priority,
        v.rejection_reason,
        v.crm_tags,
        v.skill_tags,
        v.created_at,
        v.status_updated_at,
        v.status_updated_by,
        status_user.full_name AS status_updated_by_name,
        LOWER(status_user.email) AS status_updated_by_email
      FROM volunteers v
      LEFT JOIN users owner_user
        ON owner_user.id = v.owner_user_id
      LEFT JOIN users status_user
        ON status_user.id = v.status_updated_by
    ),
    combined AS (
      SELECT
        COALESCE(v.id, -u.id) AS combined_id,
        v.id AS volunteer_id,
        COALESCE(u.full_name, v.full_name, '') AS full_name,
        COALESCE(u.email_normalized, v.email_normalized, '') AS email,
        COALESCE(v.phone, '') AS phone,
        COALESCE(v.county, '') AS county,
        COALESCE(v.locality, '') AS locality,
        COALESCE(v.skills, '') AS skills,
        COALESCE(v.motivation, '') AS motivation,
        COALESCE(
          v.workflow_status,
          CASE
            WHEN u.role = 'MEMBRU' THEN 'activ'
            WHEN u.role = 'ADERENT' THEN 'validat'
            ELSE 'nou'
          END
        ) AS workflow_status,
        COALESCE(v.internal_notes, '') AS internal_notes,
        v.owner_user_id,
        v.owner_name,
        v.owner_email,
        v.owner_role,
        v.follow_up_at,
        v.reminder_at,
        v.last_contact_at,
        v.contact_channel,
        v.crm_priority,
        v.rejection_reason,
        COALESCE(v.crm_tags, '[]'::jsonb) AS crm_tags,
        COALESCE(v.skill_tags, '[]'::jsonb) AS skill_tags,
        COALESCE(GREATEST(u.created_at, v.created_at), u.created_at, v.created_at, TO_TIMESTAMP(0)) AS created_at,
        v.status_updated_at,
        v.status_updated_by AS status_updated_by_user_id,
        v.status_updated_by_name,
        v.status_updated_by_email,
        u.role AS account_role,
        CASE
          WHEN v.id IS NOT NULL AND u.id IS NOT NULL THEN 'both'
          WHEN v.id IS NOT NULL THEN 'volunteer'
          ELSE 'user'
        END AS record_source
      FROM user_rows u
      FULL OUTER JOIN volunteer_rows v
        ON v.email_key = u.email_key
    )
  `;
}

function buildVolunteerAdminListQuery(input: {
  filters: VolunteerListFilters;
  extraConditions?: Prisma.Sql[];
  pagination?: Prisma.Sql;
}): Prisma.Sql {
  const conditions = [
    ...buildVolunteerAdminWhereConditions(input.filters),
    ...(input.extraConditions ?? []),
  ];
  const whereClause = buildWhereClause(conditions);
  const pagination = input.pagination ?? Prisma.sql``;

  return Prisma.sql`
    ${buildVolunteerAdminCombinedCte()}
    SELECT
      combined.combined_id AS id,
      combined.volunteer_id AS "volunteerId",
      combined.full_name AS "fullName",
      combined.email,
      combined.phone,
      combined.county,
      combined.locality,
      combined.skills,
      combined.motivation,
      combined.workflow_status AS "workflowStatus",
      combined.internal_notes AS "internalNotes",
      combined.created_at AS "createdAt",
      combined.status_updated_at AS "statusUpdatedAt",
      combined.status_updated_by_user_id AS "statusUpdatedByUserId",
      combined.status_updated_by_name AS "statusUpdatedByName",
      combined.status_updated_by_email AS "statusUpdatedByEmail",
      combined.owner_user_id AS "ownerUserId",
      combined.owner_name AS "ownerName",
      combined.owner_email AS "ownerEmail",
      combined.owner_role AS "ownerRole",
      combined.follow_up_at AS "followUpAt",
      combined.reminder_at AS "reminderAt",
      combined.last_contact_at AS "lastContactAt",
      combined.contact_channel AS "contactChannel",
      combined.crm_priority AS priority,
      combined.rejection_reason AS "rejectionReason",
      combined.crm_tags AS tags,
      combined.skill_tags AS "skillTags",
      combined.account_role AS "accountRole",
      combined.record_source AS "recordSource"
    FROM combined
    ${whereClause}
    ORDER BY combined.created_at DESC, combined.combined_id DESC
    ${pagination}
  `;
}

export async function listAdminVolunteersKeyset(input: {
  filters: VolunteerListFilters;
  cursorCreatedAt: string;
  cursorId: number;
  limit: number;
}): Promise<VolunteerAdminRow[]> {
  const rows = await prisma.$queryRaw<VolunteerAdminListSqlRow[]>(
    buildVolunteerAdminListQuery({
      filters: input.filters,
      extraConditions: [
        Prisma.sql`(
          combined.created_at < ${new Date(input.cursorCreatedAt)}
          OR (
            combined.created_at = ${new Date(input.cursorCreatedAt)}
            AND combined.combined_id < ${BigInt(input.cursorId)}
          )
        )`,
      ],
      pagination: Prisma.sql`LIMIT ${input.limit}`,
    })
  );

  return rows.map((row) => mapVolunteerAdminListRow(row));
}

export async function listAdminVolunteersForExport(filters: VolunteerListFilters): Promise<VolunteerAdminRow[]> {
  const rows = await prisma.$queryRaw<VolunteerAdminListSqlRow[]>(
    buildVolunteerAdminListQuery({
      filters,
    })
  );

  return rows.map((row) => mapVolunteerAdminListRow(row));
}

export async function listAdminVolunteerOwners(): Promise<VolunteerOwnerOption[]> {
  const rows = await prisma.user.findMany({
    where: {
      role: {
        in: [...volunteerOwnerRoles],
      },
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
    },
  });

  const roleOrder: Record<(typeof volunteerOwnerRoles)[number], number> = {
    PRESEDINTE: 0,
    VICEPRESEDINTE: 1,
    SECRETAR: 2,
    CONSILIER: 3,
  };

  return rows
    .map((row) => ({
      id: row.id.toString(),
      fullName: row.fullName,
      email: row.email.trim().toLowerCase(),
      role: normalizeAccountRole(row.role) ?? "CONSILIER",
    }))
    .sort((left, right) => {
      const leftRoleOrder = roleOrder[left.role as keyof typeof roleOrder] ?? Number.MAX_SAFE_INTEGER;
      const rightRoleOrder = roleOrder[right.role as keyof typeof roleOrder] ?? Number.MAX_SAFE_INTEGER;
      const roleDelta = leftRoleOrder - rightRoleOrder;
      if (roleDelta !== 0) {
        return roleDelta;
      }

      const nameDelta = left.fullName.localeCompare(right.fullName, "ro");
      if (nameDelta !== 0) {
        return nameDelta;
      }

      return left.email.localeCompare(right.email, "ro");
    });
}

export async function listAdminVolunteerIdsForBulkFilters(
  filters: VolunteerListFilters,
  runner: SqlRunner = prisma
): Promise<number[]> {
  const whereClause = buildWhereClause([
    ...buildVolunteerAdminWhereConditions(filters),
    Prisma.sql`combined.volunteer_id IS NOT NULL`,
  ]);
  const rows = await runner.$queryRaw<VolunteerIdSqlRow[]>(
    Prisma.sql`
      ${buildVolunteerAdminCombinedCte()}
      SELECT combined.volunteer_id AS "volunteerId"
      FROM combined
      ${whereClause}
      ORDER BY combined.created_at DESC, combined.combined_id DESC
    `
  );

  return rows.map((row) => Number(row.volunteerId));
}

function dedupeVolunteerIds(volunteerIds: number[]): number[] {
  return [...new Set(volunteerIds.filter((value) => Number.isInteger(value) && value > 0))];
}

export async function bulkUpdateAdminVolunteerWorkflow(input: {
  runner: PrismaTx;
  volunteerIds: number[];
  status: VolunteerWorkflowStatus;
  statusUpdatedBy: number | null;
  updatedByLabel: string;
  actor?: BulkAdminActor;
}): Promise<BulkAdminVolunteerWorkflowResult> {
  const uniqueVolunteerIds = dedupeVolunteerIds(input.volunteerIds);
  if (uniqueVolunteerIds.length === 0) {
    return {
      updatedVolunteerIds: [],
      skippedVolunteerIds: [],
      missingVolunteerIds: [],
      enqueuedEmailCount: 0,
      enqueuedAuditCount: 0,
    };
  }

  const volunteerBigIds = uniqueVolunteerIds.map((id) => BigInt(id));
  const existingRows = await input.runner.$queryRaw<VolunteerBulkWorkflowSqlRow[]>(
    Prisma.sql`
      SELECT
        v.id,
        v.full_name AS "fullName",
        LOWER(v.email) AS email,
        v.county,
        v.locality,
        v.skills,
        v.workflow_status AS "workflowStatus",
        v.internal_notes AS "internalNotes"
      FROM volunteers v
      WHERE v.id IN (${Prisma.join(volunteerBigIds)})
      ORDER BY v.id ASC
      FOR UPDATE
    `
  );

  const existingIdSet = new Set(existingRows.map((row) => Number(row.id)));
  const missingVolunteerIds = uniqueVolunteerIds.filter((id) => !existingIdSet.has(id));
  const skippedRows = existingRows.filter((row) => row.workflowStatus === input.status);
  const updatableRows = existingRows.filter((row) => row.workflowStatus !== input.status);
  const updatableVolunteerIds = updatableRows.map((row) => BigInt(Number(row.id)));
  const now = new Date();

  const updatedRows = updatableVolunteerIds.length > 0
    ? await input.runner.$queryRaw<VolunteerIdSqlRow[]>(
      Prisma.sql`
        UPDATE volunteers
        SET
          workflow_status = ${input.status},
          status_updated_at = ${now},
          status_updated_by = ${input.statusUpdatedBy === null ? null : BigInt(input.statusUpdatedBy)}
        WHERE id IN (${Prisma.join(updatableVolunteerIds)})
        RETURNING id AS "volunteerId"
      `
    )
    : [];

  const updatedVolunteerIdSet = new Set(updatedRows.map((row) => Number(row.volunteerId)));
  const updatedVolunteerIds = uniqueVolunteerIds.filter((id) => updatedVolunteerIdSet.has(id));
  const updatedSourceRows = updatableRows.filter((row) => updatedVolunteerIdSet.has(Number(row.id)));
  const auditActor = input.actor
    ? {
      userId: null,
      email: input.actor.email,
      role: input.actor.role,
    }
    : null;

  const enqueuedEmailCount = await enqueueNotificationEmails(
    updatedSourceRows.map((row) => ({
      action: "volunteer.status_changed_email",
      payload: {
        to: [row.email],
        subject: `Status voluntar actualizat: ${input.status}`,
        text: [
          `Salut, ${row.fullName}!`,
          "",
          "Statusul tau de voluntar in platforma PCS a fost actualizat.",
          `Status anterior: ${row.workflowStatus}`,
          `Status nou: ${input.status}`,
          `Actualizat de: ${input.updatedByLabel}`,
          "",
          "Multumim pentru implicare,",
          "Echipa PCS",
        ].join("\n"),
      },
    })),
    input.runner
  );

  const enqueuedAuditCount = auditActor
    ? await enqueueAdminAuditEntries(
      updatedSourceRows.map((row) => ({
        actor: auditActor,
        action: "volunteer.workflow_bulk_update",
        targetType: "volunteer",
        targetId: Number(row.id),
        details: {
          changedFields: {
            status: true,
            county: false,
            locality: false,
            skills: false,
          },
          previousStatus: row.workflowStatus,
          nextStatus: input.status,
          previousNotesLength: row.internalNotes.length,
          nextNotesLength: row.internalNotes.length,
        },
      })),
      input.runner
    )
    : 0;

  return {
    updatedVolunteerIds,
    skippedVolunteerIds: skippedRows.map((row) => Number(row.id)),
    missingVolunteerIds,
    enqueuedEmailCount,
    enqueuedAuditCount,
  };
}

export async function bulkDeleteAdminVolunteers(input: {
  runner: PrismaTx;
  volunteerIds: number[];
  actor?: BulkAdminActor;
}): Promise<BulkDeleteAdminVolunteerResult> {
  const uniqueVolunteerIds = dedupeVolunteerIds(input.volunteerIds);
  if (uniqueVolunteerIds.length === 0) {
    return {
      deletedVolunteerIds: [],
      missingVolunteerIds: [],
      enqueuedAuditCount: 0,
    };
  }

  const deletedRows = await input.runner.$queryRaw<VolunteerBulkDeleteSqlRow[]>(
    Prisma.sql`
      DELETE FROM volunteers
      WHERE id IN (${Prisma.join(uniqueVolunteerIds.map((id) => BigInt(id)))})
      RETURNING
        id,
        full_name AS "fullName",
        LOWER(email) AS email,
        county,
        locality,
        workflow_status AS "workflowStatus"
    `
  );

  const deletedVolunteerIds = deletedRows.map((row) => Number(row.id));
  const deletedVolunteerIdSet = new Set(deletedVolunteerIds);
  const missingVolunteerIds = uniqueVolunteerIds.filter((id) => !deletedVolunteerIdSet.has(id));
  const auditActor = input.actor
    ? {
      userId: null,
      email: input.actor.email,
      role: input.actor.role,
    }
    : null;
  const enqueuedAuditCount = auditActor
    ? await enqueueAdminAuditEntries(
      deletedRows.map((row) => ({
        actor: auditActor,
        action: "volunteer.delete",
        targetType: "volunteer",
        targetId: Number(row.id),
        details: {
          fullName: row.fullName,
          email: row.email,
          county: row.county,
          locality: row.locality,
          workflowStatus: row.workflowStatus,
        },
      })),
      input.runner
    )
    : 0;

  return {
    deletedVolunteerIds,
    missingVolunteerIds,
    enqueuedAuditCount,
  };
}

export async function readAdminVolunteerById(volunteerId: number): Promise<VolunteerAdminRow | null> {
  const row = await prisma.volunteer.findUnique({
    where: {
      id: BigInt(volunteerId),
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      county: true,
      locality: true,
      skills: true,
      motivation: true,
      workflowStatus: true,
      internalNotes: true,
      createdAt: true,
      statusUpdatedAt: true,
      statusUpdatedBy: true,
      statusUpdatedByRef: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      ownerUserId: true,
      ownerUserRef: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
      followUpAt: true,
      reminderAt: true,
      lastContactAt: true,
      contactChannel: true,
      crmPriority: true,
      rejectionReason: true,
      crmTags: true,
      skillTags: true,
    },
  });

  if (!row) {
    return null;
  }

  return mapVolunteerAdminRow(row as VolunteerAdminDbRow);
}

export async function readAdminVolunteerRecordById(recordId: number): Promise<VolunteerAdminRow | null> {
  const rows = await prisma.$queryRaw<VolunteerAdminListSqlRow[]>(
    buildVolunteerAdminListQuery({
      filters: {
        status: null,
        searchValue: null,
        countyValue: null,
        localityValue: null,
        skillsValue: null,
      },
      extraConditions: [Prisma.sql`combined.combined_id = ${recordId}`],
      pagination: Prisma.sql`LIMIT 1`,
    })
  );

  const row = rows[0];
  return row ? mapVolunteerAdminListRow(row) : null;
}

export async function updateAdminVolunteerWorkflow(input: {
  volunteerId: number;
  status: VolunteerWorkflowStatus;
  internalNotes: string;
  statusUpdatedBy: number | null;
  county?: string;
  locality?: string;
  skills?: string;
  ownerUserId?: number | null;
  followUpAt?: string | null;
  reminderAt?: string | null;
  lastContactAt?: string | null;
  contactChannel?: VolunteerContactChannel | null;
  priority?: VolunteerPriority;
  rejectionReason?: string;
  tags?: string[];
  skillTags?: string[];
}): Promise<VolunteerAdminRow | null> {
  try {
    const data: {
      workflowStatus: VolunteerWorkflowStatus;
      internalNotes: string;
      statusUpdatedAt: Date;
      statusUpdatedBy: bigint | null;
      county?: string;
      countyId?: number | null;
      locality?: string;
      skills?: string;
      ownerUserId?: bigint | null;
      followUpAt?: Date | null;
      reminderAt?: Date | null;
      lastContactAt?: Date | null;
      contactChannel?: VolunteerContactChannel | null;
      crmPriority?: VolunteerPriority;
      rejectionReason?: string;
      crmTags?: string[];
      skillTags?: string[];
    } = {
      workflowStatus: input.status,
      internalNotes: input.internalNotes,
      statusUpdatedAt: new Date(),
      statusUpdatedBy: input.statusUpdatedBy === null ? null : BigInt(input.statusUpdatedBy),
    };

    if (typeof input.county === "string") {
      const countyRow = await prisma.county.findUnique({
        where: {
          normalizedName: normalizeCountyKey(input.county),
        },
        select: { id: true, name: true },
      });

      if (!countyRow) {
        // keep behaviour consistent with public validation
        throw new Error("VOLUNTEER_INVALID_COUNTY");
      }

      data.county = countyRow.name;
      data.countyId = countyRow.id;
    }
    if (typeof input.locality === "string") {
      data.locality = input.locality;
    }
    if (typeof input.skills === "string") {
      data.skills = input.skills;
    }
    if (input.ownerUserId !== undefined) {
      if (input.ownerUserId === null) {
        data.ownerUserId = null;
      } else {
        const ownerRow = await prisma.user.findFirst({
          where: {
            id: BigInt(input.ownerUserId),
            role: {
              in: [...volunteerOwnerRoles],
            },
          },
          select: { id: true },
        });

        if (!ownerRow) {
          throw new Error("VOLUNTEER_OWNER_INVALID");
        }

        data.ownerUserId = ownerRow.id;
      }
    }
    if (input.followUpAt !== undefined) {
      data.followUpAt = input.followUpAt ? new Date(input.followUpAt) : null;
    }
    if (input.reminderAt !== undefined) {
      data.reminderAt = input.reminderAt ? new Date(input.reminderAt) : null;
    }
    if (input.lastContactAt !== undefined) {
      data.lastContactAt = input.lastContactAt ? new Date(input.lastContactAt) : null;
    }
    if (input.contactChannel !== undefined) {
      data.contactChannel = input.contactChannel;
    }
    if (input.priority !== undefined) {
      data.crmPriority = input.priority;
    }
    if (typeof input.rejectionReason === "string") {
      data.rejectionReason = input.rejectionReason;
    }
    if (Array.isArray(input.tags)) {
      data.crmTags = input.tags;
    }
    if (Array.isArray(input.skillTags)) {
      data.skillTags = input.skillTags;
    }

    const row = await prisma.volunteer.update({
      where: {
        id: BigInt(input.volunteerId),
      },
      data,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        county: true,
        locality: true,
        skills: true,
        motivation: true,
        workflowStatus: true,
        internalNotes: true,
        createdAt: true,
        statusUpdatedAt: true,
        statusUpdatedBy: true,
        statusUpdatedByRef: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        ownerUserId: true,
        ownerUserRef: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        followUpAt: true,
        reminderAt: true,
        lastContactAt: true,
        contactChannel: true,
        crmPriority: true,
        rejectionReason: true,
        crmTags: true,
        skillTags: true,
      },
    });

    return mapVolunteerAdminRow(row as VolunteerAdminDbRow);
  } catch (error) {
    if (
      typeof error === "object"
      && error !== null
      && "code" in error
      && (error as { code?: unknown }).code === "P2025"
    ) {
      return null;
    }

    throw error;
  }
}

export async function deleteAdminVolunteer(volunteerId: number): Promise<VolunteerAdminRow | null> {
  try {
    const row = await prisma.volunteer.delete({
      where: {
        id: BigInt(volunteerId),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        county: true,
        locality: true,
        skills: true,
        motivation: true,
        workflowStatus: true,
        internalNotes: true,
        createdAt: true,
        statusUpdatedAt: true,
        statusUpdatedBy: true,
        statusUpdatedByRef: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        ownerUserId: true,
        ownerUserRef: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        followUpAt: true,
        reminderAt: true,
        lastContactAt: true,
        contactChannel: true,
        crmPriority: true,
        rejectionReason: true,
        crmTags: true,
        skillTags: true,
      },
    });

    return mapVolunteerAdminRow(row as VolunteerAdminDbRow);
  } catch (error) {
    if (
      typeof error === "object"
      && error !== null
      && "code" in error
      && (error as { code?: unknown }).code === "P2025"
    ) {
      return null;
    }

    throw error;
  }
}
