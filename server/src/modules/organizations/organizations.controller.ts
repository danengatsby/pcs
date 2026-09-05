import type { RequestHandler, Response } from "express";
import { z, type ZodTypeAny } from "zod";
import { recordAdminAudit } from "../../lib/adminAudit.js";
import {
  assertOrganizationInScope,
  requireAdminAccess,
  territoryScopeLabel,
} from "../../lib/adminAuthorization.js";
import { readAuthUser, type AuthenticatedUser } from "../../lib/authMiddleware.js";
import { AppError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/http.js";
import {
  createOrganizationMandateSchema,
  createOrganizationObjectiveSchema,
  createOrganizationSchema,
  listAdminOrganizationsQuerySchema,
  listOrganizationsQuerySchema,
  organizationChildIdParamSchema,
  organizationIdParamSchema,
  updateOrganizationMandateSchema,
  updateOrganizationObjectiveSchema,
  updateOrganizationSchema,
} from "./organizations.schema.js";
import {
  createOrganizationMandateService,
  createOrganizationObjectiveService,
  createOrganizationService,
  getOrganizationDetailService,
  listAdminOrganizationsService,
  listOrganizationsService,
  updateOrganizationMandateService,
  updateOrganizationObjectiveService,
  updateOrganizationService,
} from "./organizations.service.js";

function parseOrThrow<TSchema extends ZodTypeAny>(schema: TSchema, value: unknown): z.output<TSchema> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AppError(
      400,
      "ORGANIZATION_VALIDATION_FAILED",
      parsed.error.issues[0]?.message ?? "Date organizaționale invalide."
    );
  }
  return parsed.data;
}

function requireActor(res: Response): AuthenticatedUser {
  const actor = readAuthUser(res);
  if (!actor) {
    throw new AppError(401, "AUTH_UNAUTHORIZED", "Autentificare necesară.");
  }
  return actor;
}

async function auditOrganizationMutation(input: {
  actor: AuthenticatedUser;
  action: string;
  organizationId: string;
  details: Record<string, unknown>;
}): Promise<void> {
  await recordAdminAudit({
    actor: {
      userId: input.actor.id,
      email: input.actor.email,
      role: input.actor.role,
    },
    action: input.action,
    targetType: "organization",
    targetId: input.organizationId,
    details: input.details,
  });
}

export const listOrganizationsController: RequestHandler = async (req, res, next) => {
  try {
    const filters = parseOrThrow(listOrganizationsQuerySchema, req.query);
    const payload = await listOrganizationsService(filters);
    sendSuccess(res, payload.rows, {
      meta: {
        total: payload.total,
        count: payload.rows.length,
        limit: filters.limit,
        offset: filters.offset,
        level: filters.level ?? null,
        search: filters.search,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const listAdminOrganizationsController: RequestHandler = async (req, res, next) => {
  try {
    const filters = parseOrThrow(listAdminOrganizationsQuerySchema, req.query);
    const access = requireAdminAccess(res);
    const payload = await listAdminOrganizationsService(filters, access.scope);
    sendSuccess(res, {
      ...payload,
      access: {
        capabilities: access.capabilities,
        scope: territoryScopeLabel(access.scope),
        national: access.scope.national,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminOrganizationController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = parseOrThrow(organizationIdParamSchema, req.params);
    assertOrganizationInScope(requireAdminAccess(res).scope, id);
    sendSuccess(res, await getOrganizationDetailService(id));
  } catch (error) {
    next(error);
  }
};

export const createAdminOrganizationController: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireActor(res);
    const payload = parseOrThrow(createOrganizationSchema, req.body);
    const organization = await createOrganizationService(payload, BigInt(actor.id));
    if (!organization) {
      throw new AppError(500, "INTERNAL_ERROR", "Organizația nu a putut fi recitită după creare.");
    }
    await auditOrganizationMutation({
      actor,
      action: "organization.create",
      organizationId: organization.id,
      details: { code: organization.code, level: organization.level, status: organization.status },
    });
    sendSuccess(res, organization, { status: 201 });
  } catch (error) {
    next(error);
  }
};

export const updateAdminOrganizationController: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireActor(res);
    const access = requireAdminAccess(res);
    const { id } = parseOrThrow(organizationIdParamSchema, req.params);
    assertOrganizationInScope(access.scope, id);
    const payload = parseOrThrow(updateOrganizationSchema, req.body);
    if (actor.role !== "PRESEDINTE") {
      const structuralFields = ["code", "level", "status", "parentId", "territories", "membersCount"];
      if (structuralFields.some((field) => field in payload)) {
        throw new AppError(
          403,
          "ADMIN_PERMISSION_REQUIRED",
          "Vicepreședintele poate actualiza datele de contact ale organizațiilor din teritoriu, nu structura sau statutul lor."
        );
      }
    }
    const organization = await updateOrganizationService(id, payload, BigInt(actor.id));
    if (!organization) {
      throw new AppError(500, "INTERNAL_ERROR", "Organizația nu a putut fi recitită după actualizare.");
    }
    await auditOrganizationMutation({
      actor,
      action: "organization.update",
      organizationId: id,
      details: { changedFields: Object.keys(payload), status: organization.status },
    });
    sendSuccess(res, organization);
  } catch (error) {
    next(error);
  }
};

export const createAdminOrganizationMandateController: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireActor(res);
    const { id } = parseOrThrow(organizationIdParamSchema, req.params);
    assertOrganizationInScope(requireAdminAccess(res).scope, id);
    const payload = parseOrThrow(createOrganizationMandateSchema, req.body);
    const organization = await createOrganizationMandateService(id, payload, BigInt(actor.id));
    await auditOrganizationMutation({
      actor,
      action: "organization.mandate.create",
      organizationId: id,
      details: { fullName: payload.fullName, positionTitle: payload.positionTitle, status: payload.status },
    });
    sendSuccess(res, organization, { status: 201 });
  } catch (error) {
    next(error);
  }
};

export const updateAdminOrganizationMandateController: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireActor(res);
    const { id, childId } = parseOrThrow(organizationChildIdParamSchema, req.params);
    assertOrganizationInScope(requireAdminAccess(res).scope, id);
    const payload = parseOrThrow(updateOrganizationMandateSchema, req.body);
    const organization = await updateOrganizationMandateService(id, childId, payload, BigInt(actor.id));
    await auditOrganizationMutation({
      actor,
      action: "organization.mandate.update",
      organizationId: id,
      details: { mandateId: childId, changedFields: Object.keys(payload) },
    });
    sendSuccess(res, organization);
  } catch (error) {
    next(error);
  }
};

export const createAdminOrganizationObjectiveController: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireActor(res);
    const { id } = parseOrThrow(organizationIdParamSchema, req.params);
    assertOrganizationInScope(requireAdminAccess(res).scope, id);
    const payload = parseOrThrow(createOrganizationObjectiveSchema, req.body);
    const organization = await createOrganizationObjectiveService(id, payload);
    await auditOrganizationMutation({
      actor,
      action: "organization.objective.create",
      organizationId: id,
      details: { title: payload.title, targetValue: payload.targetValue, dueDate: payload.dueDate },
    });
    sendSuccess(res, organization, { status: 201 });
  } catch (error) {
    next(error);
  }
};

export const updateAdminOrganizationObjectiveController: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireActor(res);
    const { id, childId } = parseOrThrow(organizationChildIdParamSchema, req.params);
    assertOrganizationInScope(requireAdminAccess(res).scope, id);
    const payload = parseOrThrow(updateOrganizationObjectiveSchema, req.body);
    const organization = await updateOrganizationObjectiveService(id, childId, payload);
    await auditOrganizationMutation({
      actor,
      action: "organization.objective.update",
      organizationId: id,
      details: { objectiveId: childId, changedFields: Object.keys(payload) },
    });
    sendSuccess(res, organization);
  } catch (error) {
    next(error);
  }
};
