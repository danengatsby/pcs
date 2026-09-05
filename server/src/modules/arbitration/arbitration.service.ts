import { recordAdminAudit } from "../../lib/adminAudit.js";
import { assertOrganizationInScope, type AdminAccessContext } from "../../lib/adminAuthorization.js";
import { AppError } from "../../lib/errors.js";
import { addEvidence, addParty, appealCase, createCase, declareConflict, decideCase, listCases, readCaseScope } from "./arbitration.repository.js";
import type { AppealInput, ConflictInput, CreateCaseInput, DecisionInput, EvidenceInput, PartyInput } from "./arbitration.schema.js";

async function assertCaseScope(caseId: string, access: AdminAccessContext) {
  const caseRow = await readCaseScope(caseId, access.scope);
  if (!caseRow) {throw new AppError(404, "ARBITRATION_NOT_FOUND", "Dosarul nu există în aria autorizată.");}
  return caseRow;
}

export async function listArbitrationCasesService(access: AdminAccessContext) { return listCases(access.scope); }

export async function createArbitrationCaseService(input: CreateCaseInput, access: AdminAccessContext) {
  if (input.organizationId) {assertOrganizationInScope(access.scope, input.organizationId);}
  else if (!access.scope.national) {throw new AppError(403, "ADMIN_NATIONAL_SCOPE_REQUIRED", "Un dosar fără organizație necesită jurisdicție națională.");}
  const created = await createCase(input, access.actor.id);
  await recordAdminAudit({ actor: access.actor, action: "arbitration.case.create", targetType: "arbitration_case", targetId: created.id, details: { caseNumber: created.caseNumber, caseType: input.caseType } });
  return created;
}

export async function addArbitrationPartyService(caseId: string, input: PartyInput, access: AdminAccessContext) { await assertCaseScope(caseId, access); const row = await addParty(caseId, input); await recordAdminAudit({ actor: access.actor, action: "arbitration.party.add", targetType: "arbitration_party", targetId: row.id, details: { caseId, partyRole: input.partyRole } }); return row; }
export async function addArbitrationEvidenceService(caseId: string, input: EvidenceInput, access: AdminAccessContext) { await assertCaseScope(caseId, access); const row = await addEvidence(caseId, input, access.actor.id); await recordAdminAudit({ actor: access.actor, action: "arbitration.evidence.add", targetType: "arbitration_evidence", targetId: row.id, details: { caseId, documentPath: input.documentPath } }); return row; }
export async function declareArbitrationConflictService(caseId: string, input: ConflictInput, access: AdminAccessContext) { await assertCaseScope(caseId, access); const row = await declareConflict(caseId, input); await recordAdminAudit({ actor: access.actor, action: "arbitration.conflict.declare", targetType: "arbitration_conflict", targetId: row.id, details: { caseId, arbitratorUserId: input.arbitratorUserId } }); return row; }

export async function decideArbitrationCaseService(caseId: string, input: DecisionInput, access: AdminAccessContext) {
  await assertCaseScope(caseId, access);
  const result = await decideCase(caseId, access.actor.id, input);
  if (!result) {throw new AppError(409, "ARBITRATION_PROCEDURE_INVALID", "Dosarul nu poate fi soluționat în starea curentă.");}
  if ("incompatible" in result) {throw new AppError(409, "ARBITRATION_INCOMPATIBLE", "Arbitrul este parte în dosar sau are o incompatibilitate declarată.");}
  await recordAdminAudit({ actor: access.actor, action: "arbitration.case.decide", targetType: "arbitration_decision", targetId: result.decisionId, details: { caseId, outcome: input.outcome } });
  return result;
}

export async function appealArbitrationCaseService(caseId: string, input: AppealInput, access: AdminAccessContext) { await assertCaseScope(caseId, access); const result = await appealCase(caseId, access.actor.id, input); if (!result) {throw new AppError(409, "ARBITRATION_PROCEDURE_INVALID", "Numai un dosar soluționat poate fi contestat.");} await recordAdminAudit({ actor: access.actor, action: "arbitration.case.appeal", targetType: "arbitration_appeal", targetId: result.appealId, details: { caseId } }); return result; }