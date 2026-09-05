import { recordAdminAudit } from "../../lib/adminAudit.js";
import { assertOrganizationInScope, type AdminAccessContext } from "../../lib/adminAuthorization.js";
import { AppError } from "../../lib/errors.js";
import { addCandidacy, addDelegate, castVote, checkInDelegate, createCongress, listCongress, readCongressOrganization, readResults, transitionCongress, validateCandidacy } from "./congress.repository.js";
import type { CandidacyInput, CastVoteInput, CreateCongressInput, DelegateInput } from "./congress.schema.js";

function assertCongressScope(access: AdminAccessContext, organizationId: string): void {
  assertOrganizationInScope(access.scope, organizationId);
}

export async function listCongressService(access: AdminAccessContext) {
  return listCongress(access.scope);
}

export async function createCongressService(input: CreateCongressInput, access: AdminAccessContext) {
  assertCongressScope(access, input.organizationId);
  const id = await createCongress(input, access.actor.id);
  await recordAdminAudit({ actor: access.actor, action: "congress.create", targetType: "congress", targetId: id, details: { title: input.title, purpose: input.purpose, quorum: input.quorum } });
  return { id };
}

export async function addDelegateService(congressId: string, input: DelegateInput, access: AdminAccessContext) {
  await assertCongressScopeForCongress(congressId, access);
  assertCongressScope(access, input.organizationId);
  const delegate = await addDelegate(congressId, input);
  await recordAdminAudit({ actor: access.actor, action: "congress.delegate.add", targetType: "congress_delegate", targetId: delegate.id, details: { congressId, organizationId: input.organizationId } });
  return delegate;
}

export async function addCandidacyService(congressId: string, input: CandidacyInput, access: AdminAccessContext) {
  await assertCongressScopeForCongress(congressId, access);
  const candidacy = await addCandidacy(congressId, input);
  await recordAdminAudit({ actor: access.actor, action: "congress.candidacy.add", targetType: "congress_candidacy", targetId: candidacy.id, details: { congressId, office: input.office } });
  return candidacy;
}

export async function transitionCongressService(congressId: string, status: "open" | "closed" | "validated", access: AdminAccessContext) {
  await assertCongressScopeForCongress(congressId, access);
  const result = await transitionCongress(congressId, status, access.actor.id);
  if (!result) {
    throw new AppError(404, "CONGRESS_NOT_FOUND", "Congresul nu a fost găsit.");
  }
  if ("invalid" in result) {
    throw new AppError(409, "CONGRESS_TRANSITION_INVALID", "Tranziția congresului nu este permisă.");
  }
  if ("quorumFailed" in result) {
    throw new AppError(409, "CONGRESS_QUORUM_NOT_REACHED", `Cvorum insuficient: ${result.checkedIn} delegați prezenți.`);
  }
  await recordAdminAudit({ actor: access.actor, action: `congress.${status}`, targetType: "congress", targetId: congressId, details: result });
  return result;
}

export async function validateCandidacyService(congressId: string, candidacyId: string, access: AdminAccessContext) {
  await assertCongressScopeForCongress(congressId, access);
  const candidacy = await validateCandidacy(congressId, candidacyId);
  if (!candidacy) {
    throw new AppError(404, "CONGRESS_CANDIDACY_NOT_FOUND", "Candidatura nu este disponibilă pentru validare.");
  }
  await recordAdminAudit({ actor: access.actor, action: "congress.candidacy.validate", targetType: "congress_candidacy", targetId: candidacyId, details: { congressId, office: candidacy.office } });
  return candidacy;
}

export async function checkInDelegateService(congressId: string, delegateId: string, access: AdminAccessContext) {
  await assertCongressScopeForCongress(congressId, access);
  const updated = await checkInDelegate(congressId, delegateId);
  if (!updated) {
    throw new AppError(404, "CONGRESS_DELEGATE_NOT_FOUND", "Delegatul nu este eligibil pentru acest congres.");
  }
  return { checkedIn: true };
}

export async function castVoteService(congressId: string, input: CastVoteInput, access: AdminAccessContext) {
  await assertCongressScopeForCongress(congressId, access);
  const result = await castVote(congressId, access.actor.id, input);
  if (!result) {
    throw new AppError(409, "CONGRESS_VOTE_INVALID", "Nu ești delegat prezent sau candidatura nu este validată.");
  }
  await recordAdminAudit({ actor: access.actor, action: "congress.vote.cast", targetType: "congress_vote", targetId: congressId, details: { candidacyId: input.candidacyId, choiceRecorded: true } });
  return result;
}

export async function readCongressResultsService(congressId: string) {
  return readResults(congressId);
}

async function assertCongressScopeForCongress(congressId: string, access: AdminAccessContext): Promise<void> {
  const organizationId = await readCongressOrganization(congressId);
  if (!organizationId) {
    throw new AppError(404, "CONGRESS_NOT_FOUND", "Congresul nu a fost găsit.");
  }
  assertCongressScope(access, organizationId);
}