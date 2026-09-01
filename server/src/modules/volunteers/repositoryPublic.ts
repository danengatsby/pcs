import { prisma } from "../../lib/prisma.js";
import type {
  ExistingUserAuthRow,
  ExistingVolunteerRow,
  QueryRunner,
  VolunteerCountyCountRow,
  VolunteerPublicRole,
  VolunteerPublicRow,
  VolunteerWorkflowStatus,
} from "./types.js";
import { volunteerStatusValues } from "./types.js";

function toVolunteerPublicRole(value: string | null | undefined): VolunteerPublicRole {
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

  return "FARA_CONT";
}

function toVolunteerWorkflowStatus(value: string): VolunteerWorkflowStatus {
  if (volunteerStatusValues.includes(value as VolunteerWorkflowStatus)) {
    return value as VolunteerWorkflowStatus;
  }

  return "nou";
}

export async function listPublicVolunteers(limit: number): Promise<VolunteerPublicRow[]> {
  const volunteers = await prisma.volunteer.findMany({
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: limit,
    select: {
      id: true,
      email: true,
      workflowStatus: true,
    },
  });

  const uniqueEmails = [...new Set(volunteers.map((row) => row.email.toLowerCase()))];
  const usersByEmail = uniqueEmails.length > 0
    ? await prisma.user.findMany({
      where: {
        email: {
          in: uniqueEmails,
        },
      },
      select: {
        email: true,
        role: true,
      },
    })
    : [];

  const roleMap = new Map<string, VolunteerPublicRole>();
  for (const user of usersByEmail) {
    roleMap.set(user.email.toLowerCase(), toVolunteerPublicRole(user.role));
  }

  return volunteers.map((row) => ({
    id: `v-${row.id.toString()}`,
    fullName: "Aderent PCP",
    email: `ascuns+${row.id.toString()}@pcp.invalid`,
    password: "protejata",
    status: toVolunteerWorkflowStatus(row.workflowStatus),
    role: roleMap.get(row.email.toLowerCase()) ?? "FARA_CONT",
  }));
}

export async function listVolunteerCountsByCounty(): Promise<VolunteerCountyCountRow[]> {
  const rows = await prisma.county.findMany({
    orderBy: {
      name: "asc",
    },
    select: {
      name: true,
      _count: {
        select: {
          volunteers: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    county: row.name,
    count: row._count.volunteers,
  }));
}

export async function findVolunteerByEmail(
  email: string,
  runner: QueryRunner
): Promise<ExistingVolunteerRow | null> {
  const row = await runner.volunteer.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
  };
}

export async function findUserAuthByEmail(
  email: string,
  runner: QueryRunner
): Promise<ExistingUserAuthRow | null> {
  const row = await runner.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: {
      passwordHash: true,
    },
  });

  return row ?? null;
}

export async function insertVolunteerUser(input: {
  fullName: string;
  email: string;
  passwordHash: string;
  runner: QueryRunner;
}): Promise<void> {
  await input.runner.user.create({
    data: {
      fullName: input.fullName,
      email: input.email,
      passwordHash: input.passwordHash,
      role: "ADERENT",
    },
  });
}

export async function insertVolunteer(input: {
  fullName: string;
  email: string;
  phone: string;
  county: string;
  countyId: number | null;
  locality: string;
  skills: string;
  motivation: string;
  runner: QueryRunner;
}): Promise<number> {
  const created = await input.runner.volunteer.create({
    data: {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      county: input.county,
      countyId: input.countyId,
      locality: input.locality,
      skills: input.skills,
      motivation: input.motivation,
      workflowStatus: "nou",
      internalNotes: "",
    },
    select: {
      id: true,
    },
  });

  return Number(created.id);
}
