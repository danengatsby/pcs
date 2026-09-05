import assert from "node:assert/strict";
import test from "node:test";
import { castVoteSchema, createCongressSchema, delegateSchema } from "../../modules/congress/congress.schema.js";

test("congress requires a positive quorum and ordered dates", () => {
  const base = {
    organizationId: "org-national-pcs",
    title: "Congresul național PCS",
    purpose: "ordinary",
    startsAt: "2026-10-01T10:00:00.000Z",
    endsAt: "2026-10-01T12:00:00.000Z",
    quorum: 10,
  };
  assert.equal(createCongressSchema.safeParse(base).success, true);
  assert.equal(createCongressSchema.safeParse({ ...base, quorum: 0 }).success, false);
  assert.equal(createCongressSchema.safeParse({ ...base, endsAt: base.startsAt }).success, false);
});

test("delegate and vote payloads stay identifier-based and constrained", () => {
  assert.equal(delegateSchema.safeParse({ fullName: "Delegat Test", organizationId: "org-iasi" }).success, true);
  assert.equal(castVoteSchema.safeParse({ candidacyId: 1, choice: "yes" }).success, true);
  assert.equal(castVoteSchema.safeParse({ candidacyId: 1, choice: "ballot-with-identity" }).success, false);
});