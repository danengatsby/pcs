import type { AuthenticatedUser } from "../../lib/authMiddleware.js";
import { AppError } from "../../lib/errors.js";
import {
  readMemberPortalFromRepository,
  updateOwnCommunicationConsentFromRepository,
  updateOwnEventResponseFromRepository,
  updateOwnTaskReportFromRepository,
} from "./memberPortal.repository.js";
import type {
  MemberConsentInput,
  MemberEventResponseInput,
  MemberTaskReportInput,
} from "./memberPortal.schema.js";

export const readMemberPortalService = (actor: AuthenticatedUser) => readMemberPortalFromRepository(actor);

export async function updateMemberEventResponseService(actor: AuthenticatedUser, actionId: string, payload: MemberEventResponseInput) {
  const updated = await updateOwnEventResponseFromRepository({ actor, actionId: BigInt(actionId), payload });
  if (!updated) {throw new AppError(403, "MEMBER_PORTAL_ACTION_FORBIDDEN", "Evenimentul nu este asociat contului tău.");}
  return updated;
}

export async function updateMemberTaskReportService(actor: AuthenticatedUser, participantId: string, payload: MemberTaskReportInput) {
  const updated = await updateOwnTaskReportFromRepository({ actor, participantId: BigInt(participantId), payload });
  if (!updated) {throw new AppError(403, "MEMBER_PORTAL_ACTION_FORBIDDEN", "Sarcina nu este asociată contului tău.");}
  return updated;
}

export async function updateMemberConsentService(actor: AuthenticatedUser, payload: MemberConsentInput) {
  const updated = await updateOwnCommunicationConsentFromRepository(actor, payload);
  if (!updated) {throw new AppError(500, "INTERNAL_ERROR", "Preferințele nu au putut fi salvate.");}
  return updated;
}
