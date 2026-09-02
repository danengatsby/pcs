import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRawMessage } from "../../lib/emailCore/message.js";

test("email message uses a stable event id for provider deduplication", () => {
  const message = buildRawMessage({
    eventId: "evt-123",
    to: ["recipient@example.test"],
    subject: "Test",
    text: "Body",
  }, ["recipient@example.test"]);

  assert.match(message, /Message-ID: <evt-123@/);
  assert.match(message, /X-Idempotency-Key: evt-123/);
});
