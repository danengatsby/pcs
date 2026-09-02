import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type { AdminTerritoryScope } from "../../lib/adminAuthorization.js";
import type { ListMembersQuery } from "./members.schema.js";

type MemberDbRow = {
  id: string;
  fullName: string;
  email: string;
  county: string;
  locality: string;
  workflowStatus: "nou" | "validat" | "contactat" | "activ";
  role: string | null;
  createdAt: string;
};

function buildScopeWhere(scope: AdminTerritoryScope): Prisma.VolunteerWhereInput {
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
        { locality: { equals: territory.locality, mode: "insensitive" } },
        {
          OR: [
            { countyId: territory.countyId },
            { county: { equals: territory.countyName, mode: "insensitive" } },
          ],
        },
      ],
    });
  }

  const conditions: Prisma.VolunteerWhereInput[] = [];
  if (scope.organizationIds.length > 0) {
    conditions.push({
      membershipRecord: { is: { organizationId: { in: scope.organizationIds } } },
    });
  }
  if (geographicConditions.length > 0) {
    conditions.push({
      AND: [
        {
          OR: [
            { membershipRecord: { is: null } },
            { membershipRecord: { is: { organizationId: null } } },
          ],
        },
        { OR: geographicConditions },
      ],
    });
  }

  return conditions.length > 0 ? { OR: conditions } : { id: -1n };
}

function buildWhere(
  filters: ListMembersQuery,
  scope: AdminTerritoryScope
): Prisma.VolunteerWhereInput {
  const search = filters.search.trim();
  const status = filters.status;

  const filterWhere: Prisma.VolunteerWhereInput = {};

  if (status) {
    filterWhere.workflowStatus = status;
  }

  if (search) {
    filterWhere.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { county: { contains: search, mode: "insensitive" } },
      { locality: { contains: search, mode: "insensitive" } },
    ];
  }

  return { AND: [filterWhere, buildScopeWhere(scope)] };
}

export async function listMembersFromRepository(
  filters: ListMembersQuery,
  scope: AdminTerritoryScope
): Promise<{
  rows: MemberDbRow[];
  total: number;
}> {
  const where = buildWhere(filters, scope);

  const [volunteers, total] = await prisma.$transaction([
    prisma.volunteer.findMany({
      where,
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: filters.limit,
      skip: filters.offset,
      select: {
        id: true,
        fullName: true,
        email: true,
        county: true,
        locality: true,
        workflowStatus: true,
        createdAt: true,
      },
    }),
    prisma.volunteer.count({ where }),
  ]);

  const uniqueEmails = Array.from(new Set(volunteers.map((item) => item.email.trim().toLowerCase()).filter(Boolean)));

  const users = uniqueEmails.length > 0
    ? await prisma.user.findMany({
      where: {
        email: {
          in: uniqueEmails,
        },
      },
      orderBy: {
        id: "desc",
      },
      select: {
        email: true,
        role: true,
      },
    })
    : [];

  const roleByEmail = new Map<string, string>();
  for (const user of users) {
    const key = user.email.trim().toLowerCase();
    if (!key || roleByEmail.has(key)) {
      continue;
    }
    roleByEmail.set(key, user.role);
  }

  const rows: MemberDbRow[] = volunteers.map((item) => {
    const emailKey = item.email.trim().toLowerCase();

    return {
      id: item.id.toString(),
      fullName: item.fullName,
      email: item.email,
      county: item.county,
      locality: item.locality,
      workflowStatus: item.workflowStatus as MemberDbRow["workflowStatus"],
      role: roleByEmail.get(emailKey) ?? null,
      createdAt: item.createdAt.toISOString(),
    };
  });

  return {
    rows,
    total,
  };
}

export type { MemberDbRow };
