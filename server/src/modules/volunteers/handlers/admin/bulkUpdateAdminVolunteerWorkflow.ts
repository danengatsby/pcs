import type { NextFunction, Request, Response } from "express";
import { readAuthUser } from "../../../../lib/authMiddleware.js";
import { requireAdminAccess } from "../../../../lib/adminAuthorization.js";
import { recordAdminAudit } from "../../../../lib/adminAudit.js";
import { triggerAdminAuditOutboxWorker } from "../../../../lib/adminAuditOutboxWorker.js";
import { AppError } from "../../../../lib/errors.js";
import { sendSuccess } from "../../../../lib/http.js";
import { triggerNotificationOutboxWorker } from "../../../../lib/notificationOutboxWorker.js";
import { withPrismaTransaction } from "../../../../lib/prismaTransaction.js";
import { readVolunteerListFilters } from "../../parsing.js";
import {
  bulkUpdateAdminVolunteerWorkflow,
  listAdminVolunteerIdsForBulkFilters,
  listAdminVolunteerIdsForExplicitSelection,
} from "../../repository.js";
import { bulkWorkflowUpdateSchema } from "../../schema.js";

export async function bulkUpdateAdminVolunteerWorkflowHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const parsed = bulkWorkflowUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    next(new AppError(400, "VOLUNTEER_WORKFLOW_VALIDATION_FAILED", issue?.message ?? "Date bulk invalide."));
    return;
  }

  try {
    const authUser = readAuthUser(res);
    const scope = requireAdminAccess(res).scope;
    if (
      parsed.data.status === "activ"
      && authUser?.role !== "PRESEDINTE"
      && authUser?.role !== "VICEPRESEDINTE"
    ) {
      next(new AppError(403, "AUTH_FORBIDDEN", "Doar conducerea poate promova persoane ca membri."));
      return;
    }
    const statusUpdatedBy = authUser ? Number(authUser.id) : null;
    const updatedByLabel = authUser?.fullName || authUser?.email || "administrator PCS";
    const requestedVolunteerIds = parsed.data.target.type === "ids"
      ? parsed.data.target.volunteerIds
      : [];
    const resolvedFilters = parsed.data.target.type === "filters"
      ? readVolunteerListFilters(parsed.data.target.filters)
      : null;
    const result = await withPrismaTransaction(async (tx) => {
      const uniqueVolunteerIds = resolvedFilters
        ? await listAdminVolunteerIdsForBulkFilters(resolvedFilters, scope, tx)
        : await listAdminVolunteerIdsForExplicitSelection(requestedVolunteerIds, scope, tx);
      if (!resolvedFilters && uniqueVolunteerIds.length !== new Set(requestedVolunteerIds).size) {
        throw new AppError(403, "ADMIN_TERRITORY_FORBIDDEN", "Selecția conține dosare din afara teritoriului tău.");
      }
      const bulkResult = await bulkUpdateAdminVolunteerWorkflow({
        runner: tx,
        volunteerIds: uniqueVolunteerIds,
        status: parsed.data.status,
        statusUpdatedBy,
        updatedByLabel,
        actor: authUser ? {
          userId: authUser.id,
          email: authUser.email,
          role: authUser.role,
        } : undefined,
      });

      if (authUser) {
        await recordAdminAudit({
          actor: {
            userId: authUser.id,
            email: authUser.email,
            role: authUser.role,
          },
          action: "volunteer.workflow_bulk_update",
          targetType: "volunteer_bulk",
          targetId: resolvedFilters ? "filters" : "ids",
          details: {
            selectionType: resolvedFilters ? "filters" : "ids",
            nextStatus: parsed.data.status,
            requestedCount: uniqueVolunteerIds.length,
            updatedCount: bulkResult.updatedVolunteerIds.length,
            skippedCount: bulkResult.skippedVolunteerIds.length,
            missingCount: bulkResult.missingVolunteerIds.length,
            volunteerIds: resolvedFilters ? undefined : uniqueVolunteerIds.slice(0, 100),
            filters: parsed.data.target.type === "filters" ? parsed.data.target.filters : undefined,
          },
        }, tx);
      }

      return bulkResult;
    });

    if (result.enqueuedEmailCount > 0) {
      triggerNotificationOutboxWorker("volunteer.workflow_bulk_update");
    }
    if (result.enqueuedAuditCount > 0) {
      triggerAdminAuditOutboxWorker("volunteer.workflow_bulk_update");
    }

    sendSuccess(res, {
      message: "Workflow-ul selectat a fost actualizat.",
      updatedCount: result.updatedVolunteerIds.length,
      skippedCount: result.skippedVolunteerIds.length,
      missingCount: result.missingVolunteerIds.length,
      updatedVolunteerIds: result.updatedVolunteerIds,
      skippedVolunteerIds: result.skippedVolunteerIds,
      missingVolunteerIds: result.missingVolunteerIds,
    });
  } catch (error) {
    next(error);
  }
}
