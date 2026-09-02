import { randomUUID } from "node:crypto";
import { recordAdminAudit } from "../../lib/adminAudit.js";
import {
  assertOrganizationInScope,
  type AdminAccessContext,
  type AdminTerritoryScope,
} from "../../lib/adminAuthorization.js";
import { AppError } from "../../lib/errors.js";
import { sendPoliticalOperationInvitationEmail } from "../../lib/notificationEmails.js";
import {
  addPoliticalParticipantFromRepository,
  createPoliticalOperationFromRepository,
  listPoliticalOperationsFromRepository,
  readCoordinatorInScope,
  readExistingPoliticalOperationCountyIds,
  readParticipantSubjectInScope,
  readPoliticalOperationInScope,
  readPoliticalParticipantInScope,
  updatePoliticalOperationFromRepository,
  updatePoliticalParticipantFromRepository,
} from "./politicalOperations.repository.js";
import type {
  AddPoliticalParticipantInput,
  CreatePoliticalOperationInput,
  PoliticalOperationsQuery,
  UpdatePoliticalOperationInput,
  UpdatePoliticalParticipantInput,
} from "./politicalOperations.schema.js";

function parseId(raw: string, code: "POLITICAL_OPERATION_INVALID" | "POLITICAL_PARTICIPANT_INVALID"): bigint {
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new AppError(400, code, "Identificatorul primit este invalid.");
  }
  return BigInt(raw);
}

function toSlug(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 88) || "actiune";
  return `${base}-${randomUUID().replaceAll("-", "").slice(0, 10)}`;
}

function scopeCountyIds(scope: AdminTerritoryScope): Set<number> {
  return new Set([
    ...scope.countyIds,
    ...scope.localities.map((item) => item.countyId),
  ]);
}

function assertActionTerritories(payload: CreatePoliticalOperationInput, scope: AdminTerritoryScope): void {
  if (payload.organizationId) {
    assertOrganizationInScope(scope, payload.organizationId);
  }
  if (scope.national) {return;}
  if (!payload.organizationId && payload.countyIds.length === 0) {
    throw new AppError(403, "ADMIN_NATIONAL_SCOPE_REQUIRED", "O acțiune națională poate fi creată numai de conducerea națională.");
  }
  const allowed = scopeCountyIds(scope);
  if (payload.countyIds.some((countyId) => !allowed.has(countyId))) {
    throw new AppError(403, "ADMIN_TERRITORY_FORBIDDEN", "Acțiunea include un județ din afara mandatului tău.");
  }
}

export async function listPoliticalOperationsService(filters: PoliticalOperationsQuery, access: AdminAccessContext) {
  return {
    ...await listPoliticalOperationsFromRepository(filters, access.scope),
    access: {
      scope: access.scope.national ? "Național" : access.scope.countyNames.join(", ") || "Mandat local",
      national: access.scope.national,
      capabilities: access.capabilities,
    },
  };
}

export async function createPoliticalOperationService(input: {
  payload: CreatePoliticalOperationInput;
  access: AdminAccessContext;
}) {
  assertActionTerritories(input.payload, input.access.scope);
  const existingCountyIds = new Set(await readExistingPoliticalOperationCountyIds(input.payload.countyIds));
  if (input.payload.countyIds.some((countyId) => !existingCountyIds.has(countyId))) {
    throw new AppError(400, "POLITICAL_OPERATION_INVALID", "Acțiunea include un județ inexistent.");
  }
  if (input.payload.coordinatorUserId) {
    const coordinator = await readCoordinatorInScope(BigInt(input.payload.coordinatorUserId), input.access.scope);
    if (!coordinator) {
      throw new AppError(400, "POLITICAL_OPERATION_INVALID", "Coordonatorul nu aparține ariei autorizate sau nu are un rol de organizare.");
    }
  }

  const created = await createPoliticalOperationFromRepository({
    payload: input.payload,
    slug: toSlug(input.payload.title),
    actorId: BigInt(input.access.actor.id),
  });
  if (!created) {
    throw new AppError(500, "INTERNAL_ERROR", "Acțiunea nu a putut fi creată.");
  }
  await recordAdminAudit({
    actor: {
      userId: input.access.actor.id,
      email: input.access.actor.email,
      role: input.access.actor.role,
    },
    action: "political_operation.create",
    targetType: "mobilization_action",
    targetId: created.id,
    details: {
      type: input.payload.type,
      title: input.payload.title,
      organizationId: input.payload.organizationId,
      countyIds: input.payload.countyIds,
      visibility: input.payload.visibility,
    },
  });
  return created;
}

export async function updatePoliticalOperationService(input: {
  operationId: string;
  payload: UpdatePoliticalOperationInput;
  access: AdminAccessContext;
}) {
  const id = parseId(input.operationId, "POLITICAL_OPERATION_INVALID");
  const existing = await readPoliticalOperationInScope(id, input.access.scope);
  if (!existing) {
    throw new AppError(404, "POLITICAL_OPERATION_NOT_FOUND", "Acțiunea nu există în aria ta autorizată.");
  }
  const updated = await updatePoliticalOperationFromRepository({ id, payload: input.payload });
  if (!updated) {
    throw new AppError(409, "POLITICAL_OPERATION_VERSION_CONFLICT", "Acțiunea a fost modificată între timp. Reîncarcă pagina.");
  }
  await recordAdminAudit({
    actor: { userId: input.access.actor.id, email: input.access.actor.email, role: input.access.actor.role },
    action: "political_operation.update",
    targetType: "mobilization_action",
    targetId: input.operationId,
    details: { ...input.payload, nextVersion: updated.version },
  });
  return updated;
}

export async function addPoliticalParticipantService(input: {
  operationId: string;
  payload: AddPoliticalParticipantInput;
  access: AdminAccessContext;
}) {
  const actionId = parseId(input.operationId, "POLITICAL_OPERATION_INVALID");
  const [action, subject] = await Promise.all([
    readPoliticalOperationInScope(actionId, input.access.scope),
    readParticipantSubjectInScope(input.payload.email, input.access.scope),
  ]);
  if (!action) {
    throw new AppError(404, "POLITICAL_OPERATION_NOT_FOUND", "Acțiunea nu există în aria ta autorizată.");
  }
  if (!subject) {
    throw new AppError(400, "POLITICAL_PARTICIPANT_INVALID", "Persoana nu există în evidența autorizată sau calitatea sa este încetată.");
  }
  const participant = await addPoliticalParticipantFromRepository({
    actionId,
    actionType: action.action_type,
    payload: input.payload,
    subject,
    actorId: BigInt(input.access.actor.id),
  });
  if (!participant) {
    throw new AppError(500, "INTERNAL_ERROR", "Participantul nu a putut fi adăugat.");
  }
  await recordAdminAudit({
    actor: { userId: input.access.actor.id, email: input.access.actor.email, role: input.access.actor.role },
    action: "political_operation.participant_assign",
    targetType: "mobilization_participant",
    targetId: participant.id,
    details: { actionId: input.operationId, subjectEmail: subject.email, actionType: action.action_type },
  });
  if (subject.email_consent) {
    await sendPoliticalOperationInvitationEmail({
      fullName: subject.full_name,
      email: subject.email,
      actionTitle: action.title,
      actionType: action.action_type,
      startsAt: action.starts_at?.toISOString() ?? null,
      dueAt: input.payload.dueAt,
    });
  }
  return {
    participant,
    notification: subject.email_consent ? "queued" : "portal_only_no_email_consent",
  };
}

export async function updatePoliticalParticipantService(input: {
  participantId: string;
  payload: UpdatePoliticalParticipantInput;
  access: AdminAccessContext;
}) {
  const id = parseId(input.participantId, "POLITICAL_PARTICIPANT_INVALID");
  const existing = await readPoliticalParticipantInScope(id, input.access.scope);
  if (!existing) {
    throw new AppError(404, "POLITICAL_PARTICIPANT_NOT_FOUND", "Participantul nu există în aria ta autorizată.");
  }
  if (input.payload.attendanceStatus && existing.action_type !== "event") {
    throw new AppError(400, "POLITICAL_PARTICIPANT_INVALID", "Prezența poate fi înregistrată numai pentru evenimente.");
  }
  if ((input.payload.report !== undefined || input.payload.hours !== undefined) && existing.action_type === "event") {
    throw new AppError(400, "POLITICAL_PARTICIPANT_INVALID", "Raportarea activității se aplică sarcinilor și campaniilor.");
  }
  const updated = await updatePoliticalParticipantFromRepository({ id, payload: input.payload });
  if (!updated) {
    throw new AppError(404, "POLITICAL_PARTICIPANT_NOT_FOUND", "Participantul nu a mai putut fi găsit.");
  }
  await recordAdminAudit({
    actor: { userId: input.access.actor.id, email: input.access.actor.email, role: input.access.actor.role },
    action: "political_operation.participant_update",
    targetType: "mobilization_participant",
    targetId: input.participantId,
    details: { actionId: existing.action_id, actionType: existing.action_type, ...input.payload },
  });
  return updated;
}
