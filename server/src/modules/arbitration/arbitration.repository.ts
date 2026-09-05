import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../../lib/db.js";
import type { AppealInput, ConflictInput, CreateCaseInput, DecisionInput, EvidenceInput, PartyInput } from "./arbitration.schema.js";

type Scope = { national: boolean; organizationIds: string[] };
function scopeSql(scope: Scope) { return scope.national ? { sql: "TRUE", params: [] as unknown[] } : { sql: "organization_id = ANY($1::varchar[])", params: [scope.organizationIds] }; }

export async function listCases(scope: Scope) {
  const scoped = scopeSql(scope);
  const result = await query(`SELECT id, case_number, organization_id, case_type, subject, status, filed_at, response_due_at, decided_at FROM arbitration_cases WHERE ${scoped.sql} ORDER BY filed_at DESC`, scoped.params);
  return result.rows.map((row) => ({ id: row.id.toString(), caseNumber: row.case_number, organizationId: row.organization_id, caseType: row.case_type, subject: row.subject, status: row.status, filedAt: row.filed_at.toISOString(), responseDueAt: row.response_due_at?.toISOString() ?? null, decidedAt: row.decided_at?.toISOString() ?? null }));
}

export async function readCaseScope(caseId: string, scope: Scope) {
  const result = scope.national
    ? await query("SELECT id, organization_id, status FROM arbitration_cases WHERE id = $1", [caseId])
    : await query("SELECT id, organization_id, status FROM arbitration_cases WHERE id = $1 AND organization_id = ANY($2::varchar[])", [caseId, scope.organizationIds]);
  return result.rows[0] ?? null;
}

export async function createCase(input: CreateCaseInput, actorId: string) {
  const result = await query(`INSERT INTO arbitration_cases (case_number, organization_id, case_type, subject, facts, legal_basis, response_due_at, filed_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, case_number`, [`ARB-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`, input.organizationId ?? null, input.caseType, input.subject, input.facts, input.legalBasis, input.responseDueAt ?? null, actorId]);
  return { id: result.rows[0].id.toString(), caseNumber: result.rows[0].case_number };
}

export async function addParty(caseId: string, input: PartyInput) { const result = await query(`INSERT INTO arbitration_parties (case_id, user_id, full_name, party_role) VALUES ($1, $2, $3, $4) RETURNING id, full_name, party_role`, [caseId, input.userId ?? null, input.fullName, input.partyRole]); return result.rows[0]; }
export async function addEvidence(caseId: string, input: EvidenceInput, actorId: string) { const result = await query(`INSERT INTO arbitration_evidence (case_id, submitted_by, title, document_path, description) VALUES ($1, $2, $3, $4, $5) RETURNING id, title, document_path`, [caseId, actorId, input.title, input.documentPath, input.description]); return result.rows[0]; }
export async function declareConflict(caseId: string, input: ConflictInput) { const result = await query(`INSERT INTO arbitration_conflicts (case_id, arbitrator_user_id, reason) VALUES ($1, $2, $3) RETURNING id, arbitrator_user_id, status`, [caseId, input.arbitratorUserId, input.reason]); return result.rows[0]; }

export async function decideCase(caseId: string, actorId: string, input: DecisionInput) {
  return withTransaction(async (client) => {
    const conflict = await client.query("SELECT 1 FROM arbitration_parties WHERE case_id = $1 AND user_id = $2 UNION SELECT 1 FROM arbitration_conflicts WHERE case_id = $1 AND arbitrator_user_id = $2 AND status IN ('declared', 'accepted')", [caseId, actorId]);
    if (conflict.rowCount) {return { incompatible: true };}
    const current = await client.query("SELECT status FROM arbitration_cases WHERE id = $1 FOR UPDATE", [caseId]);
    if (current.rowCount !== 1 || !["submitted", "response_due", "hearing", "appealed"].includes(current.rows[0].status)) {return null;}
    const decision = await client.query("INSERT INTO arbitration_decisions (case_id, decided_by, outcome, reasoning) VALUES ($1, $2, $3, $4) RETURNING id", [caseId, actorId, input.outcome, input.reasoning]);
    await client.query("UPDATE arbitration_cases SET status = 'decided', decided_at = NOW(), updated_at = NOW() WHERE id = $1", [caseId]);
    return { decisionId: decision.rows[0].id.toString() };
  });
}

export async function appealCase(caseId: string, actorId: string, input: AppealInput) {
  return withTransaction(async (client) => {
    const current = await client.query("SELECT status FROM arbitration_cases WHERE id = $1 FOR UPDATE", [caseId]);
    if (current.rowCount !== 1 || current.rows[0].status !== "decided") {return null;}
    const appeal = await client.query("INSERT INTO arbitration_appeals (case_id, appealed_by, grounds, due_at) VALUES ($1, $2, $3, $4) RETURNING id", [caseId, actorId, input.grounds, input.dueAt ?? null]);
    await client.query("UPDATE arbitration_cases SET status = 'appealed', updated_at = NOW() WHERE id = $1", [caseId]);
    return { appealId: appeal.rows[0].id.toString() };
  });
}