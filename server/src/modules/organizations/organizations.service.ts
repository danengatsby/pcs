import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import type { AdminTerritoryScope } from "../../lib/adminAuthorization.js";
import {
  countOtherNationalOrganizations,
  createOrganizationMandateRepository,
  createOrganizationObjectiveRepository,
  createOrganizationRepository,
  findCountyNames,
  findOrganizationByCode,
  getOrganizationDetailRepository,
  getOrganizationValidationRecord,
  listAdminOrganizationsRepository,
  listOrganizationsRepository,
  updateOrganizationMandateRepository,
  updateOrganizationObjectiveRepository,
  updateOrganizationRepository,
  userExists,
} from "./organizations.repository.js";
import type {
  CreateOrganizationInput,
  CreateOrganizationMandateInput,
  CreateOrganizationObjectiveInput,
  ListAdminOrganizationsQuery,
  ListOrganizationsQuery,
  OrganizationTerritoryInput,
  UpdateOrganizationInput,
  UpdateOrganizationMandateInput,
  UpdateOrganizationObjectiveInput,
} from "./organizations.schema.js";

type OrganizationLevel = CreateOrganizationInput["level"];

function organizationError(error: unknown): never {
  if (error instanceof AppError) {
    throw error;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      if (error.meta?.target === "organization_mandates_no_overlap") {
        throw new AppError(409, "ORGANIZATION_MANDATE_CONFLICT", "Mandatul se suprapune cu aceeași funcție sau cu un mandat activ al titularului.");
      }
      throw new AppError(409, "ORGANIZATION_CONFLICT", "Codul organizației este deja folosit.");
    }
    if (error.code === "P2003" || error.code === "P2004") {
      throw new AppError(400, "ORGANIZATION_VALIDATION_FAILED", "Relațiile, datele sau teritoriile organizației sunt invalide.");
    }
  }
  throw error;
}

function expectedTerritoryType(level: OrganizationLevel): OrganizationTerritoryInput["type"] {
  if (level === "national") {
    return "national";
  }
  if (level === "county") {
    return "county";
  }
  return "locality";
}

async function validateOrganizationStructure(input: {
  id?: string;
  level: OrganizationLevel;
  parentId: string | null;
  territories: OrganizationTerritoryInput[];
}): Promise<{ primaryCounty: string }> {
  const expectedType = expectedTerritoryType(input.level);
  if (input.territories.some((territory) => territory.type !== expectedType)) {
    throw new AppError(
      400,
      "ORGANIZATION_VALIDATION_FAILED",
      `Nivelul organizației necesită exclusiv teritorii de tip ${expectedType}.`
    );
  }

  const territoryKeys = input.territories.map((territory) => (
    `${territory.type}:${territory.countyId ?? ""}:${(territory.locality ?? "").toLocaleLowerCase("ro-RO")}`
  ));
  if (new Set(territoryKeys).size !== territoryKeys.length) {
    throw new AppError(409, "ORGANIZATION_CONFLICT", "Același teritoriu a fost introdus de mai multe ori.");
  }

  if (input.level === "national") {
    if (input.parentId) {
      throw new AppError(400, "ORGANIZATION_VALIDATION_FAILED", "Organizația națională nu poate avea organizație părinte.");
    }
    if (input.territories.length !== 1) {
      throw new AppError(400, "ORGANIZATION_VALIDATION_FAILED", "Organizația națională trebuie să aibă un singur teritoriu național.");
    }
    if ((await countOtherNationalOrganizations(input.id)) > 0) {
      throw new AppError(409, "ORGANIZATION_CONFLICT", "Există deja o organizație națională nedizolvată.");
    }
    return { primaryCounty: "" };
  }

  if (!input.parentId || input.parentId === input.id) {
    throw new AppError(400, "ORGANIZATION_VALIDATION_FAILED", "Filiala trebuie legată de o organizație părinte validă.");
  }

  const parent = await getOrganizationValidationRecord(input.parentId);
  if (!parent || parent.status === "dissolved") {
    throw new AppError(400, "ORGANIZATION_VALIDATION_FAILED", "Organizația părinte nu există sau este dizolvată.");
  }
  const expectedParentLevel = input.level === "county" ? "national" : "county";
  if (parent.level !== expectedParentLevel) {
    throw new AppError(
      400,
      "ORGANIZATION_VALIDATION_FAILED",
      `O organizație ${input.level === "county" ? "județeană" : input.level === "municipal" ? "municipală" : "locală"} trebuie legată de nivelul ${expectedParentLevel}.`
    );
  }

  if (input.level === "local" || input.level === "municipal") {
    const parentCountyIds = new Set(parent.territories
      .map((territory) => territory.countyId)
      .filter((countyId): countyId is number => typeof countyId === "number"));
    if (input.territories.some((territory) => !territory.countyId || !parentCountyIds.has(territory.countyId))) {
      throw new AppError(
        400,
        "ORGANIZATION_VALIDATION_FAILED",
        "Teritoriul unei organizații locale trebuie să aparțină județului organizației părinte."
      );
    }
  }

  if (input.id) {
    let ancestorId: string | null = parent.parentId;
    const visited = new Set([input.parentId]);
    while (ancestorId) {
      if (ancestorId === input.id || visited.has(ancestorId)) {
        throw new AppError(409, "ORGANIZATION_CONFLICT", "Ierarhia ar crea un ciclu organizațional.");
      }
      visited.add(ancestorId);
      const ancestor = await getOrganizationValidationRecord(ancestorId);
      ancestorId = ancestor?.parentId ?? null;
    }
  }

  const countyIds = input.territories
    .map((territory) => territory.countyId)
    .filter((countyId): countyId is number => typeof countyId === "number");
  const countyNames = await findCountyNames(countyIds);
  if (countyNames.size !== new Set(countyIds).size) {
    throw new AppError(400, "ORGANIZATION_VALIDATION_FAILED", "Unul dintre județele selectate nu există.");
  }

  return { primaryCounty: countyNames.get(countyIds[0]) ?? "" };
}

export async function listOrganizationsService(filters: ListOrganizationsQuery) {
  return listOrganizationsRepository(filters);
}

export async function listAdminOrganizationsService(
  filters: ListAdminOrganizationsQuery,
  scope: AdminTerritoryScope
) {
  return listAdminOrganizationsRepository(filters, scope);
}

export async function getOrganizationDetailService(id: string) {
  const organization = await getOrganizationDetailRepository(id);
  if (!organization) {
    throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organizația nu a fost găsită.");
  }
  return organization;
}

export async function createOrganizationService(input: CreateOrganizationInput, actorId: bigint) {
  if (await findOrganizationByCode(input.code)) {
    throw new AppError(409, "ORGANIZATION_CONFLICT", "Codul organizației este deja folosit.");
  }
  const structure = await validateOrganizationStructure({
    level: input.level,
    parentId: input.parentId ?? null,
    territories: input.territories,
  });
  try {
    return await createOrganizationRepository({ ...input, actorId, ...structure });
  } catch (error) {
    return organizationError(error);
  }
}

export async function updateOrganizationService(id: string, input: UpdateOrganizationInput, actorId: bigint) {
  const current = await getOrganizationValidationRecord(id);
  if (!current) {
    throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organizația nu a fost găsită.");
  }
  if (input.code && await findOrganizationByCode(input.code, id)) {
    throw new AppError(409, "ORGANIZATION_CONFLICT", "Codul organizației este deja folosit.");
  }

  const level = input.level ?? (current.level as OrganizationLevel);
  const parentId = input.parentId !== undefined ? input.parentId : current.parentId;
  const territories = input.territories ?? current.territories.map((territory) => ({
    type: territory.territoryType as OrganizationTerritoryInput["type"],
    countyId: territory.countyId,
    locality: territory.locality,
  }));
  const structure = await validateOrganizationStructure({ id, level, parentId, territories });

  try {
    return await updateOrganizationRepository(id, {
      ...input,
      actorId,
      ...(input.territories ? structure : {}),
    });
  } catch (error) {
    return organizationError(error);
  }
}

async function assertOrganizationAndUser(organizationId: string, userId?: number | null): Promise<void> {
  if (!await getOrganizationValidationRecord(organizationId)) {
    throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organizația nu a fost găsită.");
  }
  if (userId && !await userExists(userId)) {
    throw new AppError(400, "ORGANIZATION_VALIDATION_FAILED", "Contul asociat mandatului nu există.");
  }
}

export async function createOrganizationMandateService(
  organizationId: string,
  input: CreateOrganizationMandateInput,
  actorId: bigint
) {
  await assertOrganizationAndUser(organizationId, input.userId);
  try {
    await createOrganizationMandateRepository(organizationId, { ...input, actorId });
    return getOrganizationDetailService(organizationId);
  } catch (error) {
    return organizationError(error);
  }
}

export async function updateOrganizationMandateService(
  organizationId: string,
  mandateId: number,
  input: UpdateOrganizationMandateInput,
  actorId: bigint
) {
  await assertOrganizationAndUser(organizationId, input.userId);
  try {
    const updated = await updateOrganizationMandateRepository(organizationId, mandateId, { ...input, actorId });
    if (!updated) {
      throw new AppError(404, "ORGANIZATION_MANDATE_NOT_FOUND", "Mandatul nu a fost găsit.");
    }
    return getOrganizationDetailService(organizationId);
  } catch (error) {
    return organizationError(error);
  }
}

export async function createOrganizationObjectiveService(
  organizationId: string,
  input: CreateOrganizationObjectiveInput
) {
  await assertOrganizationAndUser(organizationId);
  try {
    await createOrganizationObjectiveRepository(organizationId, input);
    return getOrganizationDetailService(organizationId);
  } catch (error) {
    return organizationError(error);
  }
}

export async function updateOrganizationObjectiveService(
  organizationId: string,
  objectiveId: number,
  input: UpdateOrganizationObjectiveInput
) {
  await assertOrganizationAndUser(organizationId);
  try {
    const updated = await updateOrganizationObjectiveRepository(organizationId, objectiveId, input);
    if (!updated) {
      throw new AppError(404, "ORGANIZATION_OBJECTIVE_NOT_FOUND", "Obiectivul nu a fost găsit.");
    }
    return getOrganizationDetailService(organizationId);
  } catch (error) {
    return organizationError(error);
  }
}
