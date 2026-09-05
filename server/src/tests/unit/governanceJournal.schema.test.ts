import assert from "node:assert/strict";
import test from "node:test";
import { governanceJournalQuerySchema } from "../../modules/governanceJournal/governanceJournal.schema.js";

test("governance journal accepts bounded filters and rejects reversed dates", () => {
  assert.equal(governanceJournalQuerySchema.safeParse({ type: "congress", from: "2026-01-01", to: "2026-12-31" }).success, true);
  assert.equal(governanceJournalQuerySchema.safeParse({ from: "2026-12-31", to: "2026-01-01" }).success, false);
  assert.equal(governanceJournalQuerySchema.safeParse({ type: "private" }).success, false);
});