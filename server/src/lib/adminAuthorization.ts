import type { Response } from "express";
import type { AuthenticatedUser } from "./authMiddleware.js";
import { AppError } from "./errors.js";
import { prisma } from "./prisma.js";

import { adminCapabilities, defaultAdminCapabilities, profileCapabilities, type AdminCapability, type AdminProfile } from "./adminAccessProfiles.js";
import { isAdminRole } from "./adminMfa.js";
export { adminCapabilities };
export type { AdminCapability };

export type AdminTerritoryScope = {
  national: boolean;
  mandateOrganizationIds: string[];
  organizationIds: string[];
  countyIds: number[];
  countyNames: string[];
  localities: Array<{
    countyId: number;
    countyName: string;
    locality: string;
  }>;
};

export type AdminAccessContext = {
  actor: AuthenticatedUser;
  capability: AdminCapability;
  capabilities: AdminCapability[];
  profile?: AdminProfile | null;
  scope: AdminTerritoryScope;
};

type AdminLocals = {
  adminAccess?: AdminAccessContext;
};

const nationalCapabilities = new Set<AdminCapability>([
  "content.read",
  "content.write",
  "audit.read",
  "notifications.test",
  "executive.targets",
  "organization.create",
  "organization.mandate",
  "communication.dispatch",
  "finance.read",
  "finance.manage",
  "parliamentary.read",
  "parliamentary.manage",
]);

function normalizeTerritoryText(value: string): string {
  return value.trim().toLocaleLowerCase("ro-RO");
}

function nationalScope(): AdminTerritoryScope {
  return {
    national: true,
    mandateOrganizationIds: [],
    organizationIds: [],
    countyIds: [],
    countyNames: [],
    localities: [],
  };
}

export async function resolveAdminTerritoryScope(
  actor: AuthenticatedUser
): Promise<AdminTerritoryScope> {
  if (actor.role === "PRESEDINTE") {
    return nationalScope();
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const mandates = await prisma.organizationLeadershipMandate.findMany({
    where: {
      userId: BigInt(actor.id),
      status: "active",
      startedAt: { lte: today },
      OR: [
        { endedAt: null },
        { endedAt: { gte: today } },
      ],
      organization: {
        status: { in: ["forming", "active"] },
      },
    },
    select: {
      organizationId: true,
    },
  });

  const mandateOrganizationIds = [...new Set(mandates.map((item) => item.organizationId))];
  if (mandateOrganizationIds.length === 0) {
    return {
      ...nationalScope(),
      national: false,
    };
  }

  const organizations = await prisma.organization.findMany({
    where: {
      status: { in: ["forming", "active"] },
    },
    select: {
      id: true,
      parentId: true,
      territories: {
        select: {
          territoryType: true,
          countyId: true,
          locality: true,
          countyRef: {
            select: { name: true },
          },
        },
      },
    },
  });

  const accessibleIds = new Set(mandateOrganizationIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const organization of organizations) {
      if (
        organization.parentId
        && accessibleIds.has(organization.parentId)
        && !accessibleIds.has(organization.id)
      ) {
        accessibleIds.add(organization.id);
        changed = true;
      }
    }
  }

  const accessibleOrganizations = organizations.filter((item) => accessibleIds.has(item.id));
  if (accessibleOrganizations.some((organization) => (
    organization.territories.some((territory) => territory.territoryType === "national")
  ))) {
    return {
      ...nationalScope(),
      mandateOrganizationIds,
    };
  }

  const countyIds = new Set<number>();
  const countyNames = new Set<string>();
  const localities = new Map<string, AdminTerritoryScope["localities"][number]>();

  for (const organization of accessibleOrganizations) {
    for (const territory of organization.territories) {
      const countyId = territory.countyId;
      const countyName = territory.countyRef?.name ?? "";
      if (territory.territoryType === "county" && countyId && countyName) {
        countyIds.add(countyId);
        countyNames.add(countyName);
      }
      if (territory.territoryType === "locality" && countyId && countyName && territory.locality) {
        const key = `${countyId}:${normalizeTerritoryText(territory.locality)}`;
        localities.set(key, {
          countyId,
          countyName,
          locality: territory.locality,
        });
      }
    }
  }

  return {
    national: false,
    mandateOrganizationIds,
    organizationIds: [...accessibleIds],
    countyIds: [...countyIds],
    countyNames: [...countyNames],
    localities: [...localities.values()],
  };
}

export async function buildAdminAccessContext(
  actor: AuthenticatedUser,
  capability: AdminCapability
): Promise<AdminAccessContext> {
  if (!isAdminRole(actor.role)) {
    throw new AppError(403, "ADMIN_PERMISSION_REQUIRED", "Contul tău nu are acces administrativ.");
  }
  const assigned = await prisma.adminAccessProfile.findUnique({ where: { userId: BigInt(actor.id) } });
  const profile = assigned?.profile as AdminProfile | undefined;
  const available = profile ? (profileCapabilities[profile] ?? []) : defaultAdminCapabilities(actor.role);
  if (!available.includes(capability)) {
    throw new AppError(403, "ADMIN_PERMISSION_REQUIRED", "Atribuțiile contului nu permit această operație administrativă.");
  }
  const scope = await resolveAdminTerritoryScope(actor);
  if (!scope.national && scope.mandateOrganizationIds.length === 0) {
    throw new AppError(403, "ADMIN_TERRITORY_REQUIRED", "Nu ai un mandat teritorial activ asociat contului.");
  }
  if (!scope.national && nationalCapabilities.has(capability)) {
    throw new AppError(403, "ADMIN_NATIONAL_SCOPE_REQUIRED", "Operația necesită un mandat cu acoperire națională.");
  }
  return {
    actor, capability, profile: profile ?? null,
    capabilities: available.filter((item) => scope.national || !nationalCapabilities.has(item)),
    scope,
  };
}

export function setAdminAccess(res: Response, access: AdminAccessContext): void {
  (res.locals as AdminLocals).adminAccess = access;
}

export function readAdminAccess(res: Response): AdminAccessContext | null {
  return (res.locals as AdminLocals).adminAccess ?? null;
}

export function requireAdminAccess(res: Response): AdminAccessContext {
  const access = readAdminAccess(res);
  if (!access) {
    throw new AppError(403, "ADMIN_PERMISSION_REQUIRED", "Accesul administrativ nu a fost autorizat.");
  }
  return access;
}

export function assertOrganizationInScope(
  scope: AdminTerritoryScope,
  organizationId: string
): void {
  if (!scope.national && !scope.organizationIds.includes(organizationId)) {
    throw new AppError(
      403,
      "ADMIN_TERRITORY_FORBIDDEN",
      "Organizația se află în afara teritoriului mandatului tău."
    );
  }
}

export function isGeographyInScope(
  scope: AdminTerritoryScope,
  county: string,
  locality: string
): boolean {
  if (scope.national) {
    return true;
  }
  const normalizedCounty = normalizeTerritoryText(county);
  if (scope.countyNames.some((item) => normalizeTerritoryText(item) === normalizedCounty)) {
    return true;
  }
  const normalizedLocality = normalizeTerritoryText(locality);
  return scope.localities.some((item) => (
    normalizeTerritoryText(item.countyName) === normalizedCounty
    && normalizeTerritoryText(item.locality) === normalizedLocality
  ));
}

export function territoryScopeLabel(scope: AdminTerritoryScope): string {
  if (scope.national) {
    return "Național";
  }
  if (scope.countyNames.length > 0) {
    return scope.countyNames.join(", ");
  }
  if (scope.localities.length > 0) {
    return scope.localities.map((item) => `${item.locality}, ${item.countyName}`).join(", ");
  }
  return `${scope.organizationIds.length} organizații`;
}
