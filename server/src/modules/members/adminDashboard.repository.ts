import { Prisma } from "@prisma/client";
import { recordAdminAudit } from "../../lib/adminAudit.js";
import { prisma } from "../../lib/prisma.js";
import type { UserRole } from "../../lib/authToken.js";
import type { AdminTerritoryScope } from "../../lib/adminAuthorization.js";
import type {
  AdminMembersDashboardQuery,
  MembershipAction,
  MembershipStatus,
} from "./adminDashboard.schema.js";

const organizerRoles: UserRole[] = ["CONSILIER", "SECRETAR", "VICEPRESEDINTE", "PRESEDINTE"];

const membershipInclude = Prisma.validator<Prisma.MembershipRecordInclude>()({
  user: {
    select: {
      id: true,
      role: true,
    },
  },
  volunteer: {
    select: {
      id: true,
      countyId: true,
      county: true,
      locality: true,
    },
  },
  organization: {
    select: {
      id: true,
      code: true,
      name: true,
      level: true,
      status: true,
    },
  },
  approvalOrganization: {
    select: {
      id: true,
      code: true,
      name: true,
      level: true,
      status: true,
    },
  },
  events: {
    orderBy: [
      { effectiveAt: "desc" },
      { id: "desc" },
    ],
    take: 5,
    select: {
      id: true,
      action: true,
      previousStatus: true,
      nextStatus: true,
      previousOrganizationId: true,
      nextOrganizationId: true,
      reason: true,
      effectiveAt: true,
      actorUser: {
        select: {
          fullName: true,
          email: true,
        },
      },
    },
  },
});

type MembershipWithRelations = Prisma.MembershipRecordGetPayload<{
  include: typeof membershipInclude;
}>;

export type MembershipEventItem = {
  id: string;
  action: string;
  previousStatus: MembershipStatus | null;
  nextStatus: MembershipStatus;
  previousOrganizationId: string | null;
  nextOrganizationId: string | null;
  reason: string;
  effectiveAt: string;
  actorName: string | null;
};

export type AdminMembershipRow = {
  id: string;
  userId: string | null;
  volunteerId: string | null;
  fullName: string;
  email: string;
  role: UserRole;
  membershipStatus: MembershipStatus;
  memberNumber: string | null;
  organization: {
    id: string;
    code: string;
    name: string;
    level: string;
    status: string;
  } | null;
  approvalOrganization: {
    id: string;
    code: string;
    name: string;
    level: string;
    status: string;
  } | null;
  county: string;
  locality: string;
  applicationAt: string;
  verifiedAt: string | null;
  approvedAt: string | null;
  activatedAt: string | null;
  approvalBody: string;
  suspendedAt: string | null;
  endedAt: string | null;
  statusReason: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  history: MembershipEventItem[];
};

export type MembershipOrganizationOption = {
  id: string;
  code: string;
  name: string;
  level: string;
  status: string;
};

function normalizeStatus(value: string): MembershipStatus {
  if (
    value === "supporter"
    || value === "application"
    || value === "verified"
    || value === "approved"
    || value === "active"
    || value === "suspended"
    || value === "terminated"
  ) {
    return value;
  }
  return "application";
}

function normalizeRole(value: string | null, status: MembershipStatus): UserRole {
  if (
    value === "SUSTINATOR"
    || value === "ADERENT"
    || value === "MEMBRU"
    || value === "CONSILIER"
    || value === "SECRETAR"
    || value === "VICEPRESEDINTE"
    || value === "PRESEDINTE"
  ) {
    return value;
  }

  if (status === "active") {
    return "MEMBRU";
  }
  if (status === "approved") {
    return "ADERENT";
  }
  return "SUSTINATOR";
}

export function mapMembershipRow(row: MembershipWithRelations): AdminMembershipRow {
  const status = normalizeStatus(row.status);
  return {
    id: row.id.toString(),
    userId: row.userId?.toString() ?? null,
    volunteerId: row.volunteerId?.toString() ?? null,
    fullName: row.fullName,
    email: row.email,
    role: normalizeRole(row.user?.role ?? null, status),
    membershipStatus: status,
    memberNumber: row.memberNumber,
    organization: row.organization
      ? {
        id: row.organization.id,
        code: row.organization.code,
        name: row.organization.name,
        level: row.organization.level,
        status: row.organization.status,
      }
      : null,
    approvalOrganization: row.approvalOrganization
      ? {
        id: row.approvalOrganization.id,
        code: row.approvalOrganization.code,
        name: row.approvalOrganization.name,
        level: row.approvalOrganization.level,
        status: row.approvalOrganization.status,
      }
      : null,
    county: row.volunteer?.county ?? "",
    locality: row.volunteer?.locality ?? "",
    applicationAt: row.applicationAt.toISOString(),
    verifiedAt: row.validatedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    activatedAt: row.joinedAt?.toISOString() ?? null,
    approvalBody: row.approvalBody,
    suspendedAt: row.suspendedAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    statusReason: row.statusReason,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    history: row.events.map((event) => ({
      id: event.id.toString(),
      action: event.action,
      previousStatus: event.previousStatus ? normalizeStatus(event.previousStatus) : null,
      nextStatus: normalizeStatus(event.nextStatus),
      previousOrganizationId: event.previousOrganizationId,
      nextOrganizationId: event.nextOrganizationId,
      reason: event.reason,
      effectiveAt: event.effectiveAt.toISOString(),
      actorName: event.actorUser?.fullName || event.actorUser?.email || null,
    })),
  };
}

function buildFilterWhere(filters: AdminMembersDashboardQuery): Prisma.MembershipRecordWhereInput {
  const search = filters.search.trim();
  const where: Prisma.MembershipRecordWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.organizationId === "unassigned") {
    where.organizationId = null;
  } else if (filters.organizationId) {
    where.organizationId = filters.organizationId;
  }
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { volunteer: { county: { contains: search, mode: "insensitive" } } },
      { volunteer: { locality: { contains: search, mode: "insensitive" } } },
      { organization: { name: { contains: search, mode: "insensitive" } } },
      { organization: { code: { contains: search, mode: "insensitive" } } },
    ];
  }

  return where;
}

function buildMembershipScopeWhere(
  scope: AdminTerritoryScope
): Prisma.MembershipRecordWhereInput {
  if (scope.national) {
    return {};
  }

  const geographicConditions: Prisma.VolunteerWhereInput[] = [];
  if (scope.countyIds.length > 0) {
    geographicConditions.push({ countyId: { in: scope.countyIds } });
  }
  for (const countyName of scope.countyNames) {
    geographicConditions.push({ county: { equals: countyName, mode: "insensitive" } });
  }
  for (const territory of scope.localities) {
    geographicConditions.push({
      AND: [
        {
          OR: [
            { countyId: territory.countyId },
            { county: { equals: territory.countyName, mode: "insensitive" } },
          ],
        },
        { locality: { equals: territory.locality, mode: "insensitive" } },
      ],
    });
  }

  const conditions: Prisma.MembershipRecordWhereInput[] = [];
  if (scope.organizationIds.length > 0) {
    conditions.push({ organizationId: { in: scope.organizationIds } });
  }
  if (geographicConditions.length > 0) {
    conditions.push({
      organizationId: null,
      volunteer: { is: { OR: geographicConditions } },
    });
  }

  return conditions.length > 0 ? { OR: conditions } : { id: -1n };
}

function buildWhere(
  filters: AdminMembersDashboardQuery,
  scope: AdminTerritoryScope
): Prisma.MembershipRecordWhereInput {
  return {
    AND: [
      buildFilterWhere(filters),
      buildMembershipScopeWhere(scope),
    ],
  };
}

export async function listAdminMembershipsFromRepository(
  filters: AdminMembersDashboardQuery,
  scope: AdminTerritoryScope
): Promise<{
  rows: AdminMembershipRow[];
  total: number;
  summary: {
    total: number;
    supporters: number;
    applications: number;
    verified: number;
    approved: number;
    active: number;
    suspended: number;
    terminated: number;
    organizers: number;
    unassigned: number;
  };
  organizations: MembershipOrganizationOption[];
}> {
  const where = buildWhere(filters, scope);
  const scopeWhere = buildMembershipScopeWhere(scope);
  const organizationWhere: Prisma.OrganizationWhereInput = {
    status: { in: ["forming", "active"] },
    ...(!scope.national ? { id: { in: scope.organizationIds } } : {}),
  };
  const [rows, total, grouped, organizers, unassigned, organizations] = await prisma.$transaction([
    prisma.membershipRecord.findMany({
      where,
      include: membershipInclude,
      orderBy: [
        { updatedAt: "desc" },
        { id: "desc" },
      ],
      take: filters.limit,
      skip: filters.offset,
    }),
    prisma.membershipRecord.count({ where }),
    prisma.membershipRecord.groupBy({
      by: ["status"],
      where: scopeWhere,
      orderBy: { status: "asc" },
      _count: { status: true },
    }),
    prisma.membershipRecord.count({
      where: {
        AND: [scopeWhere],
        status: "active",
        user: { role: { in: organizerRoles } },
      },
    }),
    prisma.membershipRecord.count({
      where: {
        AND: [scopeWhere],
        organizationId: null,
        status: { in: ["verified", "approved", "active", "suspended"] },
      },
    }),
    prisma.organization.findMany({
      where: organizationWhere,
      orderBy: [
        { level: "asc" },
        { name: "asc" },
      ],
      select: {
        id: true,
        code: true,
        name: true,
        level: true,
        status: true,
      },
    }),
  ]);

  const groupedCounts = grouped.map((item) => ({
    status: item.status,
    count: typeof item._count === "object" && item._count
      ? item._count.status ?? 0
      : 0,
  }));
  const counts = new Map(groupedCounts.map((item) => [item.status, item.count]));
  const allRecords = groupedCounts.reduce((sum, item) => sum + item.count, 0);
  return {
    rows: rows.map(mapMembershipRow),
    total,
    summary: {
      total: allRecords,
      supporters: counts.get("supporter") ?? 0,
      applications: counts.get("application") ?? 0,
      verified: counts.get("verified") ?? 0,
      approved: counts.get("approved") ?? 0,
      active: counts.get("active") ?? 0,
      suspended: counts.get("suspended") ?? 0,
      terminated: counts.get("terminated") ?? 0,
      organizers,
      unassigned,
    },
    organizations,
  };
}

export async function readMembershipForAction(
  id: bigint,
  scope: AdminTerritoryScope
): Promise<MembershipWithRelations | null> {
  return prisma.membershipRecord.findFirst({
    where: {
      id,
      AND: [buildMembershipScopeWhere(scope)],
    },
    include: membershipInclude,
  });
}

export async function readOrganizationForMembership(id: string): Promise<MembershipOrganizationOption | null> {
  return prisma.organization.findFirst({
    where: {
      id,
      status: { in: ["forming", "active"] },
    },
    select: {
      id: true,
      code: true,
      name: true,
      level: true,
      status: true,
    },
  });
}

export async function applyMembershipActionFromRepository(input: {
  membership: MembershipWithRelations;
  action: MembershipAction;
  nextStatus: MembershipStatus;
  nextOrganizationId: string | null;
  shouldChangeOrganization: boolean;
  approvalOrganizationId: string | null;
  approvalBody: string;
  reason: string;
  effectiveAt: Date;
  expectedVersion: number;
  nextRole: "SUSTINATOR" | "ADERENT" | "MEMBRU" | null;
  nextVolunteerWorkflow: "validat" | "activ" | null;
  actor: { id: string; email: string; role: UserRole };
}): Promise<AdminMembershipRow | null> {
  return prisma.$transaction(async (tx) => {
    const data: Prisma.MembershipRecordUncheckedUpdateManyInput = {
      status: input.nextStatus,
      version: { increment: 1 },
      updatedAt: new Date(),
      updatedBy: BigInt(input.actor.id),
    };

    if (input.shouldChangeOrganization) {
      data.organizationId = input.nextOrganizationId;
    }
    if (input.action === "verify") {
      data.validatedAt = input.effectiveAt;
      data.statusReason = "";
    } else if (input.action === "approve") {
      data.approvedAt = input.effectiveAt;
      data.approvalOrganizationId = input.approvalOrganizationId;
      data.approvalBody = input.approvalBody;
      data.statusReason = "";
      if (!input.membership.organizationId && input.approvalOrganizationId) {
        data.organizationId = input.approvalOrganizationId;
      }
    } else if (input.action === "activate") {
      data.joinedAt = input.effectiveAt;
      data.suspendedAt = null;
      data.endedAt = null;
      data.statusReason = "";
      if (!input.membership.memberNumber) {
        const numbers = await tx.$queryRaw<Array<{ memberNumber: string }>>(Prisma.sql`
          SELECT
            'PCS-' || EXTRACT(YEAR FROM ${input.effectiveAt}::timestamptz)::INTEGER::TEXT
            || '-' || LPAD(nextval('membership_number_seq')::TEXT, 6, '0') AS "memberNumber"
        `);
        data.memberNumber = numbers[0]?.memberNumber;
      }
    } else if (input.action === "suspend") {
      data.suspendedAt = input.effectiveAt;
      data.statusReason = input.reason;
    } else if (input.action === "reactivate") {
      data.suspendedAt = null;
      data.endedAt = null;
      data.statusReason = "";
    } else if (input.action === "terminate") {
      data.endedAt = input.effectiveAt;
      data.statusReason = input.reason;
    }

    const updated = await tx.membershipRecord.updateMany({
      where: {
        id: input.membership.id,
        version: input.expectedVersion,
      },
      data,
    });
    if (updated.count !== 1) {
      return null;
    }

    if (input.membership.userId && input.nextRole) {
      await tx.user.update({
        where: { id: input.membership.userId },
        data: { role: input.nextRole },
      });
    }
    if (input.membership.volunteerId && input.nextVolunteerWorkflow) {
      await tx.volunteer.update({
        where: { id: input.membership.volunteerId },
        data: {
          workflowStatus: input.nextVolunteerWorkflow,
          statusUpdatedAt: input.effectiveAt,
          statusUpdatedBy: BigInt(input.actor.id),
        },
      });
    }

    await tx.membershipEvent.create({
      data: {
        membershipId: input.membership.id,
        action: input.action,
        previousStatus: input.membership.status,
        nextStatus: input.nextStatus,
        previousOrganizationId: input.membership.organizationId,
        nextOrganizationId: input.shouldChangeOrganization
          ? input.nextOrganizationId
          : input.membership.organizationId,
        reason: input.reason,
        actorUserId: BigInt(input.actor.id),
        effectiveAt: input.effectiveAt,
      },
    });

    await recordAdminAudit({
      actor: {
        userId: input.actor.id,
        email: input.actor.email,
        role: input.actor.role,
      },
      action: `membership.${input.action}`,
      targetType: "membership",
      targetId: input.membership.id.toString(),
      details: {
        subjectEmail: input.membership.email,
        previousStatus: input.membership.status,
        nextStatus: input.nextStatus,
        previousOrganizationId: input.membership.organizationId,
        nextOrganizationId: input.shouldChangeOrganization
          ? input.nextOrganizationId
          : input.membership.organizationId,
        reason: input.reason,
        effectiveAt: input.effectiveAt.toISOString(),
      },
    }, tx);

    const result = await tx.membershipRecord.findUnique({
      where: { id: input.membership.id },
      include: membershipInclude,
    });
    return result ? mapMembershipRow(result) : null;
  });
}

export { organizerRoles };
