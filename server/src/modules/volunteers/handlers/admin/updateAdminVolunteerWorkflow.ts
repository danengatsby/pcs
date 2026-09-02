import type { NextFunction, Request, Response } from "express";
import { readAuthUser } from "../../../../lib/authMiddleware.js";
import {
  isGeographyInScope,
  requireAdminAccess,
} from "../../../../lib/adminAuthorization.js";
import { recordAdminAudit } from "../../../../lib/adminAudit.js";
import { AppError } from "../../../../lib/errors.js";
import { sendSuccess } from "../../../../lib/http.js";
import { sendVolunteerStatusChangedEmail } from "../../../../lib/notificationEmails.js";
import { parseVolunteerId } from "../../parsing.js";
import {
  readAdminVolunteerById,
  listAdminVolunteerOwners,
  updateAdminVolunteerWorkflow,
} from "../../repository.js";
import { workflowUpdateSchema } from "../../schema.js";

function formatOwnerLabel(input: {
  fullName?: string | null;
  email?: string | null;
  userId?: string | null;
}): string | null {
  const fullName = input.fullName?.trim() ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";
  const userId = input.userId?.trim() ?? "";

  if (fullName && email && fullName.toLowerCase() !== email) {
    return `${fullName} (${email})`;
  }

  return fullName || email || userId || null;
}

export async function updateAdminVolunteerWorkflowHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const volunteerId = parseVolunteerId(req.params.id);
  if (!volunteerId) {
    next(new AppError(400, "VOLUNTEER_ID_INVALID", "ID voluntar invalid."));
    return;
  }

  const parsed = workflowUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    next(new AppError(400, "VOLUNTEER_WORKFLOW_VALIDATION_FAILED", issue?.message ?? "Date workflow invalide."));
    return;
  }

  try {
    const scope = requireAdminAccess(res).scope;
    const existing = await readAdminVolunteerById(volunteerId, scope);
    if (!existing) {
      next(new AppError(404, "VOLUNTEER_NOT_FOUND", "Voluntarul nu a fost gasit."));
      return;
    }

    const authUser = readAuthUser(res);
    if (
      parsed.data.status === "activ"
      && authUser?.role !== "PRESEDINTE"
      && authUser?.role !== "VICEPRESEDINTE"
    ) {
      next(new AppError(403, "AUTH_FORBIDDEN", "Doar conducerea poate promova o persoană ca membru."));
      return;
    }
    const statusUpdatedBy = authUser ? Number(authUser.id) : null;
    if (
      (parsed.data.county !== undefined || parsed.data.locality !== undefined)
      && !isGeographyInScope(
        scope,
        parsed.data.county ?? existing.county,
        parsed.data.locality ?? existing.locality
      )
    ) {
      next(new AppError(
        403,
        "ADMIN_TERRITORY_FORBIDDEN",
        "Dosarul nu poate fi mutat geografic în afara teritoriului tău."
      ));
      return;
    }
    if (parsed.data.ownerUserId) {
      const allowedOwners = await listAdminVolunteerOwners(scope);
      if (!allowedOwners.some((owner) => Number(owner.id) === parsed.data.ownerUserId)) {
        next(new AppError(403, "ADMIN_TERRITORY_FORBIDDEN", "Responsabilul selectat este în afara teritoriului tău."));
        return;
      }
    }

    const updated = await updateAdminVolunteerWorkflow({
      volunteerId,
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      motivation: parsed.data.motivation,
      status: parsed.data.status,
      internalNotes: parsed.data.internalNotes,
      statusUpdatedBy,
      county: parsed.data.county,
      locality: parsed.data.locality,
      skills: parsed.data.skills,
      ownerUserId: parsed.data.ownerUserId,
      followUpAt: parsed.data.followUpAt,
      reminderAt: parsed.data.reminderAt,
      lastContactAt: parsed.data.lastContactAt,
      contactChannel: parsed.data.contactChannel,
      priority: parsed.data.priority,
      rejectionReason: parsed.data.rejectionReason,
      tags: parsed.data.tags,
      skillTags: parsed.data.skillTags,
      scope,
    });

    if (!updated) {
      next(new AppError(404, "VOLUNTEER_NOT_FOUND", "Voluntarul nu a fost gasit."));
      return;
    }

    if (authUser) {
      const changedFields = {
        fullName: existing.fullName !== updated.fullName,
        email: existing.email !== updated.email,
        phone: existing.phone !== updated.phone,
        motivation: existing.motivation !== updated.motivation,
        status: existing.workflowStatus !== updated.workflowStatus,
        county: existing.county !== updated.county,
        locality: existing.locality !== updated.locality,
        skills: existing.skills !== updated.skills,
        owner: existing.ownerUserId !== updated.ownerUserId,
        followUpAt: existing.followUpAt !== updated.followUpAt,
        reminderAt: existing.reminderAt !== updated.reminderAt,
        lastContactAt: existing.lastContactAt !== updated.lastContactAt,
        contactChannel: existing.contactChannel !== updated.contactChannel,
        priority: existing.priority !== updated.priority,
        rejectionReason: (existing.rejectionReason ?? "") !== (updated.rejectionReason ?? ""),
        tags: JSON.stringify(existing.tags) !== JSON.stringify(updated.tags),
        skillTags: JSON.stringify(existing.skillTags) !== JSON.stringify(updated.skillTags),
      };

      await recordAdminAudit({
        actor: {
          userId: authUser.id,
          email: authUser.email,
          role: authUser.role,
        },
        action: "volunteer.workflow_update",
        targetType: "volunteer",
        targetId: updated.id,
        details: {
          changedFields,
          previousFullName: existing.fullName,
          nextFullName: updated.fullName,
          previousEmail: existing.email,
          nextEmail: updated.email,
          previousPhone: existing.phone,
          nextPhone: updated.phone,
          previousMotivationLength: existing.motivation.length,
          nextMotivationLength: updated.motivation.length,
          previousStatus: existing.workflowStatus,
          nextStatus: updated.workflowStatus,
          previousCounty: existing.county,
          nextCounty: updated.county,
          previousLocality: existing.locality,
          nextLocality: updated.locality,
          previousSkills: existing.skills,
          nextSkills: updated.skills,
          previousOwnerLabel: formatOwnerLabel({
            fullName: existing.ownerName,
            email: existing.ownerEmail,
            userId: existing.ownerUserId,
          }),
          nextOwnerLabel: formatOwnerLabel({
            fullName: updated.ownerName,
            email: updated.ownerEmail,
            userId: updated.ownerUserId,
          }),
          previousFollowUpAt: existing.followUpAt,
          nextFollowUpAt: updated.followUpAt,
          previousReminderAt: existing.reminderAt,
          nextReminderAt: updated.reminderAt,
          previousLastContactAt: existing.lastContactAt,
          nextLastContactAt: updated.lastContactAt,
          previousContactChannel: existing.contactChannel,
          nextContactChannel: updated.contactChannel,
          previousPriority: existing.priority,
          nextPriority: updated.priority,
          previousRejectionReasonLength: existing.rejectionReason?.length ?? 0,
          nextRejectionReasonLength: updated.rejectionReason?.length ?? 0,
          previousTags: existing.tags,
          nextTags: updated.tags,
          previousSkillTags: existing.skillTags,
          nextSkillTags: updated.skillTags,
          previousNotesLength: existing.internalNotes.length,
          nextNotesLength: updated.internalNotes.length,
        },
      });
    }

    if (existing.workflowStatus !== updated.workflowStatus) {
      void sendVolunteerStatusChangedEmail({
        fullName: updated.fullName,
        email: updated.email,
        previousStatus: existing.workflowStatus,
        nextStatus: updated.workflowStatus,
        updatedBy: authUser?.fullName || authUser?.email || "administrator PCS",
      });
    }

    sendSuccess(res, {
      message: "Workflow voluntar actualizat.",
      volunteer: updated,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "VOLUNTEER_OWNER_INVALID") {
      next(new AppError(400, "VOLUNTEER_OWNER_INVALID", "Responsabilul selectat nu este valid."));
      return;
    }
    if (
      typeof error === "object"
      && error !== null
      && "code" in error
      && (error as { code?: unknown }).code === "P2002"
    ) {
      next(new AppError(409, "VOLUNTEER_EMAIL_EXISTS", "Adresa de email este deja folosită."));
      return;
    }

    next(error);
  }
}
