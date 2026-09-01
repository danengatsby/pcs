import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
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

function buildWhere(filters: ListMembersQuery): Prisma.VolunteerWhereInput {
  const search = filters.search.trim();
  const status = filters.status;

  const where: Prisma.VolunteerWhereInput = {};

  if (status) {
    where.workflowStatus = status;
  }

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { county: { contains: search, mode: "insensitive" } },
      { locality: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function listMembersFromRepository(filters: ListMembersQuery): Promise<{
  rows: MemberDbRow[];
  total: number;
}> {
  const where = buildWhere(filters);

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
