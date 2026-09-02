import type { AuthenticatedUser } from "../../lib/authMiddleware.js";
import {
  assertOrganizationInScope,
  type AdminAccessContext,
} from "../../lib/adminAuthorization.js";
import { AppError } from "../../lib/errors.js";
import {
  applyMembershipActionFromRepository,
  listAdminMembershipsFromRepository,
  mapMembershipRow,
  readOrganizationForMembership,
  organizerRoles,
  readMembershipForAction,
  type AdminMembershipRow,
} from "./adminDashboard.repository.js";
import type {
  AdminMembersDashboardQuery,
  MembershipAction,
  MembershipActionInput,
  MembershipStatus,
} from "./adminDashboard.schema.js";

const executiveActions = new Set<MembershipAction>([
  "approve",
  "activate",
  "suspend",
  "reactivate",
  "terminate",
]);

const transitionTargets: Record<Exclude<MembershipAction, "transfer">, {
  from: MembershipStatus[];
  to: MembershipStatus;
}> = {
  verify: { from: ["application"], to: "verified" },
  approve: { from: ["verified"], to: "approved" },
  activate: { from: ["approved"], to: "active" },
  suspend: { from: ["active"], to: "suspended" },
  reactivate: { from: ["suspended"], to: "active" },
  terminate: { from: ["verified", "approved", "active", "suspended"], to: "terminated" },
};

function canExecuteAction(role: AuthenticatedUser["role"], action: MembershipAction): boolean {
  if (executiveActions.has(action)) {
    return role === "PRESEDINTE" || role === "VICEPRESEDINTE";
  }
  return (
    role === "SECRETAR"
    || role === "VICEPRESEDINTE"
    || role === "PRESEDINTE"
  ) && (action === "verify" || action === "transfer");
}

function availableActionsForRow(
  row: AdminMembershipRow,
  actorRole: AuthenticatedUser["role"]
): MembershipAction[] {
  const lifecycleActions: MembershipAction[] = row.membershipStatus === "application"
    ? ["verify"]
    : row.membershipStatus === "verified"
      ? ["approve", "transfer", "terminate"]
      : row.membershipStatus === "approved"
        ? ["activate", "transfer", "terminate"]
      : row.membershipStatus === "active"
        ? ["transfer", "suspend", "terminate"]
        : row.membershipStatus === "suspended"
          ? ["transfer", "reactivate", "terminate"]
          : [];

  const organizer = organizerRoles.includes(row.role);
  return lifecycleActions.filter((action) => (
    canExecuteAction(actorRole, action)
    && (!organizer || action === "transfer")
  ));
}

export async function listAdminMembersDashboardService(
  filters: AdminMembersDashboardQuery,
  access: AdminAccessContext
): Promise<{
  generatedAt: string;
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
  rows: Array<AdminMembershipRow & { availableActions: MembershipAction[] }>;
  organizations: Awaited<ReturnType<typeof listAdminMembershipsFromRepository>>["organizations"];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasPrevious: boolean;
    hasNext: boolean;
  };
  filters: {
    search: string;
    status: MembershipStatus | null;
    organizationId: string | null;
  };
}> {
  const result = await listAdminMembershipsFromRepository(filters, access.scope);
  return {
    generatedAt: new Date().toISOString(),
    summary: result.summary,
    rows: result.rows.map((row) => ({
      ...row,
      availableActions: availableActionsForRow(row, access.actor.role),
    })),
    organizations: result.organizations,
    pagination: {
      total: result.total,
      limit: filters.limit,
      offset: filters.offset,
      hasPrevious: filters.offset > 0,
      hasNext: filters.offset + result.rows.length < result.total,
    },
    filters: {
      search: filters.search,
      status: filters.status ?? null,
      organizationId: filters.organizationId ?? null,
    },
  };
}

function parseMembershipId(rawId: string): bigint {
  if (!/^[1-9]\d*$/.test(rawId)) {
    throw new AppError(400, "MEMBERSHIP_ID_INVALID", "ID-ul evidenței de membru este invalid.");
  }
  return BigInt(rawId);
}

function resolveEffectiveAt(input: string | undefined, createdAt: Date): Date {
  const effectiveAt = input ? new Date(input) : new Date();
  if (effectiveAt.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new AppError(400, "MEMBERSHIP_ACTION_INVALID", "Data efectivă nu poate fi în viitor.");
  }
  if (effectiveAt.getTime() < createdAt.getTime()) {
    throw new AppError(400, "MEMBERSHIP_ACTION_INVALID", "Data efectivă precedă înregistrarea persoanei.");
  }
  return effectiveAt;
}

function nextAccountRole(action: MembershipAction): "SUSTINATOR" | "ADERENT" | "MEMBRU" | null {
  if (action === "approve") {
    return "ADERENT";
  }
  if (action === "activate" || action === "reactivate") {
    return "MEMBRU";
  }
  if (action === "suspend" || action === "terminate") {
    return "SUSTINATOR";
  }
  return null;
}

export async function applyMembershipActionService(input: {
  membershipId: string;
  payload: MembershipActionInput;
  access: AdminAccessContext;
}): Promise<AdminMembershipRow & { availableActions: MembershipAction[] }> {
  const membershipId = parseMembershipId(input.membershipId);
  const membership = await readMembershipForAction(membershipId, input.access.scope);
  if (!membership) {
    throw new AppError(404, "MEMBERSHIP_NOT_FOUND", "Evidența de membru nu a fost găsită.");
  }

  const action = input.payload.action;
  if (!canExecuteAction(input.access.actor.role, action)) {
    throw new AppError(403, "AUTH_FORBIDDEN", "Nu ai permisiunea pentru această decizie.");
  }

  if (membership.userId?.toString() === input.access.actor.id && action !== "transfer") {
    throw new AppError(409, "MEMBERSHIP_SELF_ACTION_FORBIDDEN", "Nu îți poți modifica propria calitate de membru.");
  }

  const current = mapMembershipRow(membership);
  if (organizerRoles.includes(current.role) && action !== "transfer") {
    throw new AppError(
      409,
      "MEMBERSHIP_LEADERSHIP_ACTION_FORBIDDEN",
      "Calitatea unui titular de funcție se modifică numai după încheierea mandatului său."
    );
  }

  let nextStatus = current.membershipStatus;
  let nextOrganizationId = membership.organizationId;
  let shouldChangeOrganization = false;

  if (action === "transfer") {
    if (!["verified", "approved", "active", "suspended"].includes(current.membershipStatus)) {
      throw new AppError(409, "MEMBERSHIP_TRANSITION_INVALID", "Persoana nu poate fi transferată în starea curentă.");
    }
    const destinationId = input.payload.organizationId as string;
    assertOrganizationInScope(input.access.scope, destinationId);
    if (destinationId === membership.organizationId) {
      throw new AppError(409, "MEMBERSHIP_TRANSFER_SAME_ORGANIZATION", "Persoana aparține deja organizației selectate.");
    }
    if (!await readOrganizationForMembership(destinationId)) {
      throw new AppError(400, "MEMBERSHIP_ORGANIZATION_INVALID", "Organizația destinație nu este activă sau în formare.");
    }
    nextOrganizationId = destinationId;
    shouldChangeOrganization = true;
  } else {
    const transition = transitionTargets[action];
    if (!transition.from.includes(current.membershipStatus)) {
      throw new AppError(409, "MEMBERSHIP_TRANSITION_INVALID", "Tranziția nu este permisă din starea curentă.");
    }
    nextStatus = transition.to;
  }

  let approvalOrganizationId: string | null = null;
  let approvalBody = "";
  if (action === "approve") {
    approvalOrganizationId = input.payload.approvalOrganizationId as string;
    assertOrganizationInScope(input.access.scope, approvalOrganizationId);
    const approvalOrganization = await readOrganizationForMembership(approvalOrganizationId);
    if (!approvalOrganization) {
      throw new AppError(400, "MEMBERSHIP_APPROVAL_ORGANIZATION_INVALID", "Organul aprobator nu este activ sau în formare.");
    }
    approvalBody = approvalOrganization.name;
  }

  const effectiveAt = resolveEffectiveAt(input.payload.effectiveAt, membership.createdAt);
  const updated = await applyMembershipActionFromRepository({
    membership,
    action,
    nextStatus,
    nextOrganizationId,
    shouldChangeOrganization,
    approvalOrganizationId,
    approvalBody,
    reason: input.payload.reason,
    effectiveAt,
    expectedVersion: input.payload.expectedVersion,
    nextRole: nextAccountRole(action),
    nextVolunteerWorkflow: action === "verify" ? "validat" : action === "activate" ? "activ" : null,
    actor: input.access.actor,
  });

  if (!updated) {
    throw new AppError(
      409,
      "MEMBERSHIP_VERSION_CONFLICT",
      "Evidența a fost modificată între timp. Reîncarcă lista înainte de a continua."
    );
  }

  return {
    ...updated,
    availableActions: availableActionsForRow(updated, input.access.actor.role),
  };
}

export { executiveActions };
