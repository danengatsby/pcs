import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { query } from "../../lib/db.js";
import { createMobilizationResponse, listPublicMobilizationActions } from "../../modules/mobilization/mobilization.repository.js";
import { mobilizationResponseSchema } from "../../modules/mobilization/mobilization.schema.js";
import { updatePoliticalParticipantFromRepository } from "../../modules/politicalOperations/politicalOperations.repository.js";
import { updateOwnEventResponseFromRepository } from "../../modules/memberPortal/memberPortal.repository.js";
import { buildTestEmail, deleteUserByEmail } from "../helpers/dbTestUtils.js";

const app = createApp();

async function fixture(capacity: number | null) {
  const slug = `capacity-${randomUUID()}`;
  const email = buildTestEmail("capacity-approver");
  const approver = (await query<{ id: string }>(`
    INSERT INTO users (full_name, email, password_hash, role)
    VALUES ('Aprobator capacitate', $1, 'unused', 'PRESEDINTE') RETURNING id
  `, [email])).rows[0];
  const action = (await query<{ id: string }>(`
    INSERT INTO mobilization_actions (
      slug, action_type, title, summary, capacity, public_approved_at, public_approved_by,
      public_response_count, response_count_approved_at, response_count_approved_by
    ) VALUES ($1, 'event', 'Eveniment capacitate', 'Test concurenta inscrieri', $2, NOW(), $3, 999, NOW(), $3)
    RETURNING id
  `, [slug, capacity, approver.id])).rows[0];
  const emails: string[] = [];
  return {
    slug, id: action.id,
    payload(joinWaitlist = false) {
      const participantEmail = buildTestEmail("capacity-participant");
      emails.push(participantEmail);
      return mobilizationResponseSchema.parse({
        fullName: "Participant capacitate", email: participantEmail, county: "Cluj",
        interests: ["organizare"], privacyConsent: true, joinWaitlist,
      });
    },
    async cleanup() {
      await query("DELETE FROM mobilization_actions WHERE id = $1", [action.id]);
      await query("DELETE FROM communication_consents WHERE email = ANY($1::text[])", [emails]);
      await deleteUserByEmail(email);
    },
  };
}

test("simultaneous registrations reserve exactly the capacity and persist the remainder on the waiting list", async () => {
  const f = await fixture(3);
  try {
    const results = await Promise.all(Array.from({ length: 8 }, () => request(app)
      .post(`/api/mobilization/actions/${f.slug}/responses`).send(f.payload(true))));
    assert.ok(results.every((result) => result.status === 201));
    assert.equal(results.filter((result) => result.body.data.registrationStatus === "confirmed").length, 3);
    assert.equal(results.filter((result) => result.body.data.registrationStatus === "waitlisted").length, 5);
    const statuses = await query<{ status: string; count: number }>(`
      SELECT status, COUNT(*)::int AS count FROM mobilization_participants WHERE action_id = $1 GROUP BY status
    `, [f.id]);
    assert.deepEqual(Object.fromEntries(statuses.rows.map((row) => [row.status, row.count])), { confirmed: 3, waitlisted: 5 });
    const action = (await listPublicMobilizationActions()).find((item) => item.slug === f.slug);
    assert.equal(action?.availableSpots, 0);
    assert.equal(action?.responseCount, 999, "editorial snapshot must not determine available seats");
  } finally { await f.cleanup(); }
});

test("full actions reject without waitlist consent and without response, participant or consent side effects", async () => {
  const f = await fixture(1);
  try {
    const first = f.payload();
    await createMobilizationResponse(f.slug, first);
    const second = f.payload();
    const rejected = await request(app).post(`/api/mobilization/actions/${f.slug}/responses`).send(second).expect(409);
    assert.equal(rejected.body.error.code, "MOBILIZATION_ACTION_FULL");
    const counts = (await query<{ responses: number; participants: number; consents: number }>(`
      SELECT (SELECT COUNT(*)::int FROM mobilization_responses WHERE email = $1) responses,
        (SELECT COUNT(*)::int FROM mobilization_participants WHERE email = $1) participants,
        (SELECT COUNT(*)::int FROM communication_consents WHERE email = $1) consents
    `, [second.email])).rows[0];
    assert.deepEqual(counts, { responses: 0, participants: 0, consents: 0 });
    const waiting = await request(app).post(`/api/mobilization/actions/${f.slug}/responses`)
      .send({ ...second, joinWaitlist: true }).expect(201);
    assert.equal(waiting.body.data.registrationStatus, "waitlisted");
    for (const payload of [first, second]) {
      const duplicate = await request(app).post(`/api/mobilization/actions/${f.slug}/responses`)
        .send({ ...payload, email: payload.email.toUpperCase(), joinWaitlist: true }).expect(409);
      assert.equal(duplicate.body.error.code, "MOBILIZATION_RESPONSE_EXISTS");
    }
  } finally { await f.cleanup(); }
});

test("waiting participants cannot be promoted by admin or member portal until a seat is released", async () => {
  const f = await fixture(1);
  try {
    const first = f.payload();
    const second = f.payload(true);
    await createMobilizationResponse(f.slug, first);
    await createMobilizationResponse(f.slug, second);
    const participants = (await query<{ id: string; email: string }>(
      "SELECT id, email FROM mobilization_participants WHERE action_id = $1", [f.id],
    )).rows;
    const booked = participants.find((item) => item.email === first.email)!;
    const waiting = participants.find((item) => item.email === second.email)!;
    const promote = () => updatePoliticalParticipantFromRepository({ id: BigInt(waiting.id), payload: { status: "confirmed" } });
    const fullError = (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "MOBILIZATION_ACTION_FULL");
    await assert.rejects(promote(), fullError);
    await assert.rejects(updateOwnEventResponseFromRepository({
      actor: { id: "0", fullName: second.fullName, email: second.email, role: "MEMBRU" },
      actionId: BigInt(f.id), payload: { response: "confirmed" },
    }), fullError);
    // Updating an already seated person must not require a second seat.
    await updatePoliticalParticipantFromRepository({ id: BigInt(booked.id), payload: { status: "confirmed" } });
    await updatePoliticalParticipantFromRepository({ id: BigInt(booked.id), payload: { status: "cancelled" } });
    assert.equal((await listPublicMobilizationActions()).find((item) => item.id === f.id)?.availableSpots, 1);
    assert.equal((await promote())?.status, "confirmed");
    assert.equal((await listPublicMobilizationActions()).find((item) => item.id === f.id)?.availableSpots, 0);
  } finally { await f.cleanup(); }
});

test("public registration and administrative confirmation compete for the same last seat", async () => {
  const f = await fixture(1);
  try {
    const invitee = f.payload();
    const participant = (await query<{ id: string }>(`
      INSERT INTO mobilization_participants (action_id, full_name, email, status)
      VALUES ($1, $2, $3, 'invited') RETURNING id
    `, [f.id, invitee.fullName, invitee.email])).rows[0];
    const results = await Promise.allSettled([
      createMobilizationResponse(f.slug, f.payload()),
      updatePoliticalParticipantFromRepository({ id: BigInt(participant.id), payload: { status: "confirmed" } }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(rejected?.status === "rejected");
    assert.equal(rejected.reason.code, "MOBILIZATION_ACTION_FULL");
    const occupied = await query<{ count: number }>("SELECT COUNT(*)::int AS count FROM mobilization_participants WHERE action_id = $1 AND status = 'confirmed'", [f.id]);
    assert.equal(occupied.rows[0].count, 1);
  } finally { await f.cleanup(); }
});

test("unlimited actions confirm every response and actions closed to registration reject waitlist requests", async () => {
  const f = await fixture(null);
  try {
    const results = await Promise.all(Array.from({ length: 4 }, () => createMobilizationResponse(f.slug, f.payload(true))));
    assert.ok(results.every((result) => result?.registrationStatus === "confirmed"));
    assert.equal((await listPublicMobilizationActions()).find((item) => item.id === f.id)?.availableSpots, null);
    await query("UPDATE mobilization_actions SET status = 'closed' WHERE id = $1", [f.id]);
    await request(app).post(`/api/mobilization/actions/${f.slug}/responses`).send(f.payload(true)).expect(404);
  } finally { await f.cleanup(); }
});
