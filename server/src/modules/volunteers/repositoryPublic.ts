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
    fullName: "Susținător PCS",
    email: `ascuns+${row.id.toString()}@pcs.invalid`,
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
      id: true,
      passwordHash: true,
    },
  });

  return row
    ? {
      id: Number(row.id),
      passwordHash: row.passwordHash,
    }
    : null;
}

export async function insertVolunteerUser(input: {
  fullName: string;
  email: string;
  passwordHash: string;
  runner: QueryRunner;
}): Promise<number> {
  const created = await input.runner.user.create({
    data: {
      fullName: input.fullName,
      email: input.email,
      passwordHash: input.passwordHash,
      role: "SUSTINATOR",
    },
    select: { id: true },
  });
  return Number(created.id);
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

export async function upsertPendingMembership(input: {
  userId: number;
  volunteerId: number;
  fullName: string;
  email: string;
  runner: QueryRunner;
}): Promise<void> {
  const membership = await input.runner.membershipRecord.upsert({
    where: { userId: BigInt(input.userId) },
    create: {
      userId: BigInt(input.userId),
      volunteerId: BigInt(input.volunteerId),
      fullName: input.fullName,
      email: input.email,
      status: "application",
      applicationAt: new Date(),
    },
    update: {
      volunteerId: BigInt(input.volunteerId),
      fullName: input.fullName,
      email: input.email,
      status: "application",
      applicationAt: new Date(),
      updatedAt: new Date(),
    },
    select: { id: true, status: true },
  });
  const existingEvents = await input.runner.membershipEvent.count({
    where: { membershipId: membership.id },
  });
  if (existingEvents === 0) {
    await input.runner.membershipEvent.create({
      data: {
        membershipId: membership.id,
        action: "submit",
        previousStatus: "supporter",
        nextStatus: membership.status,
        reason: "Cerere de aderare înregistrată de solicitant",
      },
    });
  }
}
