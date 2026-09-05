import type {
  ExistingUserAuthRow,
  ExistingVolunteerRow,
  QueryRunner,
} from "./types.js";

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
