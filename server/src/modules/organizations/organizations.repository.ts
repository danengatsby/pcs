import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type { AdminTerritoryScope } from "../../lib/adminAuthorization.js";
import type {
  CreateOrganizationInput,
  CreateOrganizationMandateInput,
  CreateOrganizationObjectiveInput,
  ListAdminOrganizationsQuery,
  ListOrganizationsQuery,
  OrganizationRecord,
  OrganizationTerritoryInput,
  UpdateOrganizationInput,
  UpdateOrganizationMandateInput,
  UpdateOrganizationObjectiveInput,
} from "./organizations.schema.js";

const territorySelect = {
  id: true,
  territoryType: true,
  countyId: true,
  locality: true,
  countyRef: { select: { name: true } },
} satisfies Prisma.OrganizationTerritorySelect;

const organizationListSelect = {
  id: true,
  code: true,
  level: true,
  name: true,
  county: true,
  membersCount: true,
  officialEmail: true,
  phone: true,
  headquarters: true,
  status: true,
  isDemo: true,
  publicApprovedAt: true,
  publicApprovedBy: true,
  foundedAt: true,
  createdAt: true,
  parent: { select: { id: true, code: true, name: true } },
  territories: { select: territorySelect, orderBy: { id: "asc" } },
  mandates: {
    where: {
      status: "active",
      isDemo: false,
      publicApprovedAt: { not: null },
      publicApprovedBy: { not: null },
    },
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    select: { fullName: true, positionTitle: true },
  },
  _count: { select: { children: true, mandates: true, objectives: true } },
} satisfies Prisma.OrganizationSelect;

const organizationDetailSelect = {
  ...organizationListSelect,
  officialEmail: true,
  phone: true,
  headquarters: true,
  updatedAt: true,
  children: {
    orderBy: [{ level: "asc" }, { name: "asc" }],
    select: { id: true, code: true, level: true, name: true, status: true },
  },
  mandates: {
    orderBy: [{ status: "asc" }, { startedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      userId: true,
      fullName: true,
      positionTitle: true,
      startedAt: true,
      endedAt: true,
      status: true,
      isDemo: true,
      publicApprovedAt: true,
      publicApprovedBy: true,
      createdAt: true,
      updatedAt: true,
      decision: {
        select: {
          id: true,
          decisionNumber: true,
          decisionDate: true,
          issuingBody: true,
          minutesPath: true,
        },
      },
      user: { select: { email: true, role: true } },
    },
  },
  objectives: {
    orderBy: [{ dueDate: "asc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      metricName: true,
      targetValue: true,
      currentValue: true,
      unit: true,
      dueDate: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.OrganizationSelect;

type OrganizationListDbRow = Prisma.OrganizationGetPayload<{ select: typeof organizationListSelect }>;
type OrganizationDetailDbRow = Prisma.OrganizationGetPayload<{ select: typeof organizationDetailSelect }>;

function toDateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function territoryLabel(territory: OrganizationListDbRow["territories"][number]): string {
  if (territory.territoryType === "national") {
    return "România";
  }
  if (territory.territoryType === "county") {
    return territory.countyRef?.name ?? "Județ nespecificat";
  }
  return [territory.locality, territory.countyRef?.name].filter(Boolean).join(", ");
}

function mapTerritory(territory: OrganizationDetailDbRow["territories"][number]) {
  return {
    id: territory.id.toString(),
    type: territory.territoryType,
    countyId: territory.countyId,
    county: territory.countyRef?.name ?? null,
    locality: territory.locality,
    label: territoryLabel(territory),
  };
}

function mapOrganizationListRow(row: OrganizationListDbRow) {
  return {
    id: row.id,
    code: row.code,
    level: row.level,
    name: row.name,
    county: row.county,
    membersCount: row.membersCount,
    status: row.status,
    isDemo: row.isDemo,
    publicApprovedAt: row.publicApprovedAt?.toISOString() ?? null,
    publicApprovedBy: row.publicApprovedBy?.toString() ?? null,
    foundedAt: toDateOnly(row.foundedAt),
    createdAt: row.createdAt.toISOString(),
    parent: row.parent,
    territories: row.territories.map(mapTerritory),
    counts: {
      children: row._count.children,
      mandates: row._count.mandates,
      objectives: row._count.objectives,
    },
  };
}

function mapOrganizationDetail(row: OrganizationDetailDbRow) {
  return {
    ...mapOrganizationListRow(row),
    officialEmail: row.officialEmail,
    phone: row.phone,
    headquarters: row.headquarters,
    updatedAt: row.updatedAt.toISOString(),
    children: row.children,
    mandates: row.mandates.map((mandate) => ({
      id: mandate.id.toString(),
      userId: mandate.userId?.toString() ?? null,
      fullName: mandate.fullName,
      positionTitle: mandate.positionTitle,
      startedAt: toDateOnly(mandate.startedAt),
      endedAt: toDateOnly(mandate.endedAt),
      status: mandate.status,
      isDemo: mandate.isDemo,
      publicApprovedAt: mandate.publicApprovedAt?.toISOString() ?? null,
      publicApprovedBy: mandate.publicApprovedBy?.toString() ?? null,
      accountEmail: mandate.user?.email ?? null,
      accountRole: mandate.user?.role ?? null,
      createdAt: mandate.createdAt.toISOString(),
      updatedAt: mandate.updatedAt.toISOString(),
      decision: mandate.decision ? {
        id: mandate.decision.id.toString(),
        decisionNumber: mandate.decision.decisionNumber,
        decisionDate: toDateOnly(mandate.decision.decisionDate),
        issuingBody: mandate.decision.issuingBody,
        minutesPath: mandate.decision.minutesPath,
      } : null,
    })),
    objectives: row.objectives.map((objective) => ({
      id: objective.id.toString(),
      title: objective.title,
      description: objective.description,
      metricName: objective.metricName,
      targetValue: Number(objective.targetValue),
      currentValue: Number(objective.currentValue),
      unit: objective.unit,
      dueDate: toDateOnly(objective.dueDate),
      status: objective.status,
      createdAt: objective.createdAt.toISOString(),
      updatedAt: objective.updatedAt.toISOString(),
    })),
  };
}

function buildOrganizationWhere(filters: ListAdminOrganizationsQuery): Prisma.OrganizationWhereInput {
  const search = filters.search.trim();
  return {
    ...(filters.level ? { level: filters.level } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(search
      ? {
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
          { county: { contains: search, mode: "insensitive" } },
          { territories: { some: { locality: { contains: search, mode: "insensitive" } } } },
          { territories: { some: { countyRef: { name: { contains: search, mode: "insensitive" } } } } },
        ],
      }
      : {}),
  };
}

export async function listOrganizationsRepository(filters: ListOrganizationsQuery): Promise<{
  rows: OrganizationRecord[];
  total: number;
}> {
  const where: Prisma.OrganizationWhereInput = {
    ...buildOrganizationWhere({ ...filters, status: "active" }),
    status: "active",
    isDemo: false,
    publicApprovedAt: { not: null },
    publicApprovedBy: { not: null },
  };
  const [records, total] = await prisma.$transaction([
    prisma.organization.findMany({
      where,
      orderBy: [{ level: "asc" }, { name: "asc" }],
      skip: filters.offset,
      take: filters.limit,
      select: organizationListSelect,
    }),
    prisma.organization.count({ where }),
  ]);

  return {
    rows: records.map((row) => ({
      id: row.id,
      code: row.code,
      level: row.level as OrganizationRecord["level"],
      name: row.name,
      county: row.county,
      foundedAt: toDateOnly(row.foundedAt),
      territories: row.territories.map(territoryLabel),
      officialEmail: row.officialEmail,
      phone: row.phone,
      headquarters: row.headquarters,
      leaders: row.mandates.map((mandate) => ({
        fullName: mandate.fullName,
        positionTitle: mandate.positionTitle,
      })),
    })),
    total,
  };
}

export async function listAdminOrganizationsRepository(
  filters: ListAdminOrganizationsQuery,
  scope: AdminTerritoryScope
) {
  const scopeWhere: Prisma.OrganizationWhereInput = scope.national
    ? {}
    : { id: { in: scope.organizationIds } };
  const where: Prisma.OrganizationWhereInput = {
    AND: [buildOrganizationWhere(filters), scopeWhere],
  };
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const countyIds = [...new Set([
    ...scope.countyIds,
    ...scope.localities.map((item) => item.countyId),
  ])];
  const countyScopeWhere: Prisma.CountyWhereInput = scope.national
    ? {}
    : { id: { in: countyIds } };
  const countyCoverageScope = scope.national || scope.organizationIds.length === 0
    ? Prisma.sql``
    : Prisma.sql`AND t.organization_id IN (${Prisma.join(scope.organizationIds)})`;

  const [records, total, organizations, active, forming, countyCoverageRows, activeMandates, objectivesAtRisk, counties] = await Promise.all([
    prisma.organization.findMany({
      where,
      orderBy: [{ level: "asc" }, { name: "asc" }],
      skip: filters.offset,
      take: filters.limit,
      select: organizationListSelect,
    }),
    prisma.organization.count({ where }),
    prisma.organization.count({ where: scopeWhere }),
    prisma.organization.count({ where: { AND: [scopeWhere], status: "active" } }),
    prisma.organization.count({ where: { AND: [scopeWhere], status: "forming" } }),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(DISTINCT t.county_id) AS count
      FROM organization_territories t
      JOIN organizations o ON o.id = t.organization_id
      WHERE o.status = 'active' AND t.county_id IS NOT NULL
      ${countyCoverageScope}
    `),
    prisma.organizationLeadershipMandate.count({
      where: {
        status: "active",
        organization: scopeWhere,
      },
    }),
    prisma.organizationObjective.count({
      where: {
        organization: scopeWhere,
        AND: [
          {
            OR: [
              { status: "at_risk" },
              { status: { in: ["planned", "in_progress"] }, dueDate: { lt: today } },
            ],
          },
        ],
      },
    }),
    prisma.county.findMany({
      where: countyScopeWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return {
    rows: records.map(mapOrganizationListRow),
    total,
    summary: {
      organizations,
      active,
      forming,
      countiesCovered: Number(countyCoverageRows[0]?.count ?? 0),
      activeMandates,
      objectivesAtRisk,
    },
    counties,
  };
}

export async function getOrganizationDetailRepository(id: string) {
  const row = await prisma.organization.findUnique({
    where: { id },
    select: organizationDetailSelect,
  });
  return row ? mapOrganizationDetail(row) : null;
}

export async function getOrganizationValidationRecord(id: string) {
  return prisma.organization.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      level: true,
      status: true,
      parentId: true,
      territories: { select: { territoryType: true, countyId: true, locality: true } },
    },
  });
}

export async function findOrganizationByCode(code: string, exceptId?: string) {
  return prisma.organization.findFirst({
    where: {
      code: { equals: code, mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
}

export async function countOtherNationalOrganizations(exceptId?: string): Promise<number> {
  return prisma.organization.count({
    where: {
      level: "national",
      status: { not: "dissolved" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
  });
}

export async function findCountyNames(countyIds: number[]): Promise<Map<number, string>> {
  const uniqueIds = [...new Set(countyIds)];
  if (uniqueIds.length === 0) {
    return new Map();
  }
  const rows = await prisma.county.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((row) => [row.id, row.name]));
}

function buildTerritoryWrites(territories: OrganizationTerritoryInput[]) {
  return territories.map((territory) => ({
    territoryType: territory.type,
    countyId: territory.countyId ?? null,
    locality: territory.locality ?? "",
  }));
}

export async function createOrganizationRepository(input: CreateOrganizationInput & {
  actorId: bigint;
  primaryCounty: string;
}) {
  const id = randomUUID();
  await prisma.organization.create({
    data: {
      id,
      code: input.code,
      name: input.name,
      level: input.level,
      status: input.status,
      parentId: input.parentId ?? null,
      county: input.primaryCounty,
      membersCount: input.membersCount,
      officialEmail: input.officialEmail,
      phone: input.phone,
      headquarters: input.headquarters,
      foundedAt: toDate(input.foundedAt),
      createdBy: input.actorId,
      updatedBy: input.actorId,
      isDemo: false,
      publicApprovedAt: input.status === "active" ? new Date() : null,
      publicApprovedBy: input.status === "active" ? input.actorId : null,
      territories: { create: buildTerritoryWrites(input.territories) },
    },
  });
  return getOrganizationDetailRepository(id);
}

export async function updateOrganizationRepository(id: string, input: UpdateOrganizationInput & {
  actorId: bigint;
  primaryCounty?: string;
}) {
  await prisma.organization.update({
    where: { id },
    data: {
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.level !== undefined ? { level: input.level } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.membersCount !== undefined ? { membersCount: input.membersCount } : {}),
      ...(input.officialEmail !== undefined ? { officialEmail: input.officialEmail } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.headquarters !== undefined ? { headquarters: input.headquarters } : {}),
      ...(input.foundedAt !== undefined ? { foundedAt: toDate(input.foundedAt) } : {}),
      ...(input.primaryCounty !== undefined ? { county: input.primaryCounty } : {}),
      ...(input.territories
        ? {
          territories: {
            deleteMany: {},
            create: buildTerritoryWrites(input.territories),
          },
        }
        : {}),
      isDemo: false,
      publicApprovedAt: input.status === "active" ? new Date() : null,
      publicApprovedBy: input.status === "active" ? input.actorId : null,
      updatedBy: input.actorId,
      updatedAt: new Date(),
    },
  });
  return getOrganizationDetailRepository(id);
}

export async function userExists(userId: number): Promise<boolean> {
  return (await prisma.user.count({ where: { id: BigInt(userId) } })) > 0;
}

export async function createOrganizationMandateRepository(
  organizationId: string,
  input: CreateOrganizationMandateInput & { actorId: bigint }
) {
  const row = await prisma.$transaction(async (tx) => {
    const decision = await tx.organizationMandateDecision.create({
      data: {
        organizationId,
        decisionNumber: input.decision.decisionNumber,
        decisionDate: toDate(input.decision.decisionDate) as Date,
        issuingBody: input.decision.issuingBody,
        minutesPath: input.decision.minutesPath,
        createdBy: input.actorId,
      },
      select: { id: true },
    });
    return tx.organizationLeadershipMandate.create({
      data: {
        organizationId,
        userId: input.userId ? BigInt(input.userId) : null,
        fullName: input.fullName,
        positionTitle: input.positionTitle,
        startedAt: toDate(input.startedAt) as Date,
        endedAt: toDate(input.endedAt),
        status: input.status,
        isDemo: false,
        publicApprovedAt: input.status === "active" ? new Date() : null,
        publicApprovedBy: input.status === "active" ? input.actorId : null,
        decisionId: decision.id,
      },
      select: { id: true },
    });
  });
  return { id: row.id.toString() };
}

export async function updateOrganizationMandateRepository(
  organizationId: string,
  mandateId: number,
  input: UpdateOrganizationMandateInput & { actorId: bigint }
) {
  const existing = await prisma.organizationLeadershipMandate.findFirst({
    where: { id: BigInt(mandateId), organizationId },
    select: { id: true, decisionId: true },
  });
  if (!existing) {
    return null;
  }
  await prisma.organizationLeadershipMandate.update({
    where: { id: existing.id },
    data: {
      ...(input.userId !== undefined
        ? {
          user: input.userId
            ? { connect: { id: BigInt(input.userId) } }
            : { disconnect: true },
        }
        : {}),
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.positionTitle !== undefined ? { positionTitle: input.positionTitle } : {}),
      ...(input.startedAt !== undefined ? { startedAt: toDate(input.startedAt) as Date } : {}),
      ...(input.endedAt !== undefined ? { endedAt: toDate(input.endedAt) } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.decision ? {
        decision: existing.decisionId
          ? {
            update: {
              decisionNumber: input.decision.decisionNumber,
              decisionDate: toDate(input.decision.decisionDate) as Date,
              issuingBody: input.decision.issuingBody,
              minutesPath: input.decision.minutesPath,
            },
          }
          : {
            create: {
              organizationId,
              decisionNumber: input.decision.decisionNumber,
              decisionDate: toDate(input.decision.decisionDate) as Date,
              issuingBody: input.decision.issuingBody,
              minutesPath: input.decision.minutesPath,
              createdBy: input.actorId,
            },
          },
      } : {}),
      isDemo: false,
      publicApprovedAt: input.status === "active" ? new Date() : null,
      publicApprovedBy: input.status === "active" ? input.actorId : null,
      updatedAt: new Date(),
    },
  });
  return { id: existing.id.toString() };
}

export async function createOrganizationObjectiveRepository(
  organizationId: string,
  input: CreateOrganizationObjectiveInput
) {
  const row = await prisma.organizationObjective.create({
    data: {
      organizationId,
      title: input.title,
      description: input.description,
      metricName: input.metricName,
      targetValue: input.targetValue,
      currentValue: input.currentValue,
      unit: input.unit,
      dueDate: toDate(input.dueDate) as Date,
      status: input.status,
    },
    select: { id: true },
  });
  return { id: row.id.toString() };
}

export async function updateOrganizationObjectiveRepository(
  organizationId: string,
  objectiveId: number,
  input: UpdateOrganizationObjectiveInput
) {
  const existing = await prisma.organizationObjective.findFirst({
    where: { id: BigInt(objectiveId), organizationId },
    select: { id: true },
  });
  if (!existing) {
    return null;
  }
  await prisma.organizationObjective.update({
    where: { id: existing.id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.metricName !== undefined ? { metricName: input.metricName } : {}),
      ...(input.targetValue !== undefined ? { targetValue: input.targetValue } : {}),
      ...(input.currentValue !== undefined ? { currentValue: input.currentValue } : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.dueDate !== undefined ? { dueDate: toDate(input.dueDate) as Date } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date(),
    },
  });
  return { id: existing.id.toString() };
}
