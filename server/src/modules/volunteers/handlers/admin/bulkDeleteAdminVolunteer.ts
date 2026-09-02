import type { NextFunction, Request, Response } from "express";
import { readAuthUser } from "../../../../lib/authMiddleware.js";
import { requireAdminAccess } from "../../../../lib/adminAuthorization.js";
import { recordAdminAudit } from "../../../../lib/adminAudit.js";
import { triggerAdminAuditOutboxWorker } from "../../../../lib/adminAuditOutboxWorker.js";
import { AppError } from "../../../../lib/errors.js";
import { sendSuccess } from "../../../../lib/http.js";
import { withPrismaTransaction } from "../../../../lib/prismaTransaction.js";
import { readVolunteerListFilters } from "../../parsing.js";
import {
  bulkDeleteAdminVolunteers,
  listAdminVolunteerIdsForBulkFilters,
  listAdminVolunteerIdsForExplicitSelection,
} from "../../repository.js";
import { bulkDeleteVolunteerSchema } from "../../schema.js";

export async function bulkDeleteAdminVolunteerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const parsed = bulkDeleteVolunteerSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    next(
      new AppError(
        400,
        "VOLUNTEER_BULK_DELETE_VALIDATION_FAILED",
        issue?.message ?? "Date bulk invalide."
      )
    );
    return;
  }

  try {
    const authUser = readAuthUser(res);
    const scope = requireAdminAccess(res).scope;
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
      const bulkResult = await bulkDeleteAdminVolunteers({
        runner: tx,
        volunteerIds: uniqueVolunteerIds,
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
          action: "volunteer.delete_bulk",
          targetType: "volunteer_bulk",
          targetId: resolvedFilters ? "filters" : "ids",
          details: {
            selectionType: resolvedFilters ? "filters" : "ids",
            requestedCount: uniqueVolunteerIds.length,
            deletedCount: bulkResult.deletedVolunteerIds.length,
            missingCount: bulkResult.missingVolunteerIds.length,
            volunteerIds: resolvedFilters ? undefined : uniqueVolunteerIds.slice(0, 100),
            filters: parsed.data.target.type === "filters" ? parsed.data.target.filters : undefined,
          },
        }, tx);
      }

      return bulkResult;
    });

    if (result.enqueuedAuditCount > 0) {
      triggerAdminAuditOutboxWorker("volunteer.delete");
    }

    sendSuccess(res, {
      message: "Formularele de voluntar selectate au fost șterse.",
      deletedCount: result.deletedVolunteerIds.length,
      missingCount: result.missingVolunteerIds.length,
      deletedVolunteerIds: result.deletedVolunteerIds,
      missingVolunteerIds: result.missingVolunteerIds,
    });
  } catch (error) {
    next(error);
  }
}
