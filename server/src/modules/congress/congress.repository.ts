import { createHash, randomUUID } from "node:crypto";
import { query, withTransaction } from "../../lib/db.js";
import type { CandidacyInput, CastVoteInput, CreateCongressInput, DelegateInput } from "./congress.schema.js";

export async function listCongress(scope: { national: boolean; organizationIds: string[] }) {
  const result = await query(`
    SELECT c.id, c.organization_id, c.title, c.purpose, c.status, c.starts_at, c.ends_at,
      c.quorum, COUNT(d.id)::int AS delegate_count, COUNT(d.voted_at)::int AS vote_count
    FROM congresses c LEFT JOIN congress_delegates d ON d.congress_id = c.id
    WHERE ($1 OR c.organization_id = ANY($2::varchar[]))
    GROUP BY c.id ORDER BY c.starts_at DESC
  `, [scope.national, scope.organizationIds]);
  return result.rows.map((row) => ({
    id: row.id.toString(), organizationId: row.organization_id, title: row.title,
    purpose: row.purpose, status: row.status, startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(), quorum: row.quorum,
    delegateCount: row.delegate_count, votedDelegateCount: row.vote_count,
  }));
}

export async function createCongress(input: CreateCongressInput, actorId: string) {
  const result = await query(`
    INSERT INTO congresses (organization_id, title, purpose, starts_at, ends_at, quorum, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
  `, [input.organizationId, input.title, input.purpose, input.startsAt, input.endsAt, input.quorum, actorId]);
  return result.rows[0].id.toString();
}

export async function readCongressOrganization(congressId: string): Promise<string | null> {
  const result = await query("SELECT organization_id FROM congresses WHERE id = $1", [congressId]);
  return result.rows[0]?.organization_id ?? null;
}

export async function addDelegate(congressId: string, input: DelegateInput) {
  const result = await query(`
    INSERT INTO congress_delegates (congress_id, user_id, full_name, organization_id, selected_by)
    VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, organization_id, eligibility_status
  `, [congressId, input.userId ?? null, input.fullName, input.organizationId, input.selectedBy]);
  return result.rows[0];
}

export async function addCandidacy(congressId: string, input: CandidacyInput) {
  const result = await query(`
    INSERT INTO congress_candidacies (congress_id, candidate_user_id, candidate_name, office)
    VALUES ($1, $2, $3, $4) RETURNING id, candidate_name, office, status
  `, [congressId, input.candidateUserId ?? null, input.candidateName, input.office]);
  return result.rows[0];
}

export async function validateCandidacy(congressId: string, candidacyId: string) {
  const result = await query("UPDATE congress_candidacies SET status = 'validated' WHERE id = $1 AND congress_id = $2 AND status = 'submitted' RETURNING id, candidate_name, office, status", [candidacyId, congressId]);
  return result.rows[0] ?? null;
}

export async function transitionCongress(congressId: string, status: "open" | "closed" | "validated", actorId: string) {
  return withTransaction(async (client) => {
    const congress = await client.query("SELECT status, quorum FROM congresses WHERE id = $1 FOR UPDATE", [congressId]);
    const current = congress.rows[0];
    if (!current) {
      return null;
    }
    const allowed = (current.status === "draft" && status === "open")
      || (current.status === "open" && status === "closed")
      || (current.status === "closed" && status === "validated");
    if (!allowed) {
      return { invalid: true };
    }
    if (status === "closed") {
      const count = await client.query("SELECT COUNT(*)::int AS total FROM congress_delegates WHERE congress_id = $1 AND eligibility_status = 'eligible' AND checked_in_at IS NOT NULL", [congressId]);
      if (count.rows[0].total < current.quorum) {
        return { quorumFailed: true, checkedIn: count.rows[0].total };
      }
    }
    const timestampColumn = status === "open" ? "opened_at" : status === "closed" ? "closed_at" : "validated_at";
    await client.query(`UPDATE congresses SET status = $1, ${timestampColumn} = NOW(), updated_at = NOW() WHERE id = $2`, [status, congressId]);
    await client.query("INSERT INTO congress_decisions (congress_id, decision_type, decision_text, evidence, created_by) VALUES ($1, $2, $3, $4, $5)", [congressId, status === "validated" ? "validation" : "minutes", `Congres trecut în starea ${status}.`, { status }, actorId]);
    return { status };
  });
}

export async function checkInDelegate(congressId: string, delegateId: string) {
  const result = await query("UPDATE congress_delegates SET checked_in_at = COALESCE(checked_in_at, NOW()) WHERE id = $1 AND congress_id = $2 AND eligibility_status = 'eligible' RETURNING id", [delegateId, congressId]);
  return result.rowCount === 1;
}

export async function castVote(congressId: string, userId: string, input: CastVoteInput) {
  return withTransaction(async (client) => {
    const delegate = await client.query("SELECT d.id FROM congress_delegates d JOIN congresses g ON g.id = d.congress_id WHERE d.congress_id = $1 AND g.status = 'open' AND d.user_id = $2 AND d.eligibility_status = 'eligible' AND d.checked_in_at IS NOT NULL AND d.voted_at IS NULL FOR UPDATE", [congressId, userId]);
    if (delegate.rowCount !== 1) {
      return null;
    }
    const candidacy = await client.query("SELECT office FROM congress_candidacies WHERE id = $1 AND congress_id = $2 AND status = 'validated'", [input.candidacyId, congressId]);
    if (candidacy.rowCount !== 1) {
      return null;
    }
    const ballotHash = createHash("sha256").update(randomUUID()).digest("hex");
    await client.query("INSERT INTO congress_votes (congress_id, candidacy_id, office, choice, ballot_hash) VALUES ($1, $2, $3, $4, $5)", [congressId, input.candidacyId, candidacy.rows[0].office, input.choice, ballotHash]);
    await client.query("UPDATE congress_delegates SET voted_at = NOW() WHERE id = $1", [delegate.rows[0].id]);
    return { receipt: ballotHash };
  });
}

export async function readResults(congressId: string) {
  const result = await query(`SELECT c.office, c.id AS candidacy_id, c.candidate_name,
    COUNT(v.id) FILTER (WHERE v.choice = 'yes')::int AS yes,
    COUNT(v.id) FILTER (WHERE v.choice = 'no')::int AS no,
    COUNT(v.id) FILTER (WHERE v.choice = 'abstain')::int AS abstain
    FROM congress_candidacies c LEFT JOIN congress_votes v ON v.candidacy_id = c.id
    JOIN congresses g ON g.id = c.congress_id AND g.status = 'validated'
    WHERE c.congress_id = $1 GROUP BY c.id ORDER BY c.office, c.candidate_name`, [congressId]);
  return result.rows;
}