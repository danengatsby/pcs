import assert from "node:assert/strict";
import { test } from "node:test";
import { query } from "../../lib/db.js";
import {
  processNotificationEmailOutboxBatch,
  type NotificationEmailPayload,
} from "../../lib/notificationOutbox.js";

type OutboxIdRow = {
  id: string;
};

type OutboxStateRow = {
  id: string;
  status: "pending" | "processing" | "retry" | "sent" | "failed";
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lastError: string;
  sentAt: string | Date | null;
};

async function insertOutboxRow(input: {
  action: string;
  payload: NotificationEmailPayload;
  maxAttempts: number;
  nextAttemptAt: string;
}): Promise<string> {
  const result = await query<OutboxIdRow>(
    `
      INSERT INTO notification_email_outbox (
        action,
        payload,
        status,
        attempt_count,
        max_attempts,
        next_attempt_at,
        last_error,
        created_at,
        updated_at
      )
      VALUES ($1, $2::jsonb, 'pending', 0, $3, $4::timestamptz, '', NOW(), NOW())
      RETURNING id::text AS id
    `,
    [
      input.action,
      JSON.stringify(input.payload),
      input.maxAttempts,
      input.nextAttemptAt,
    ]
  );

  return String(result.rows[0]?.id ?? "");
}

async function readOutboxState(id: string): Promise<OutboxStateRow | null> {
  const result = await query<OutboxStateRow>(
    `
      SELECT
        id::text AS id,
        status,
        attempt_count AS "attemptCount",
        max_attempts AS "maxAttempts",
        next_attempt_at AS "nextAttemptAt",
        last_error AS "lastError",
        sent_at AS "sentAt"
      FROM notification_email_outbox
      WHERE id = $1::bigint
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

async function deleteOutboxRow(id: string): Promise<void> {
  await query(
    `
      DELETE FROM notification_email_outbox
      WHERE id = $1::bigint
    `,
    [id]
  );
}

test("notification outbox processor should retry and then fail after max attempts", async () => {
  // Keep test window in the past so only rows created by this test are eligible.
  const now = new Date("2001-03-01T10:00:00.000Z");
  const createdId = await insertOutboxRow({
    action: "test.retry",
    payload: {
      to: ["retry@example.test"],
      subject: "Retry test",
      text: "Email retry test.",
    },
    maxAttempts: 2,
    nextAttemptAt: new Date(now.getTime() - 60_000).toISOString(),
  });

  try {
    const failingDeliver = async (): Promise<void> => {
      throw new Error("SMTP unavailable in test");
    };

    const firstPass = await processNotificationEmailOutboxBatch({
      batchSize: 10,
      now,
      baseDelaySeconds: 1,
      maxDelaySeconds: 5,
      deliver: failingDeliver,
      force: true,
    });

    assert.ok(firstPass.claimed >= 1);
    assert.equal(firstPass.sent, 0);
    assert.ok(firstPass.retried >= 1);
    assert.equal(firstPass.failed, 0);

    const stateAfterFirstPass = await readOutboxState(createdId);
    assert.equal(stateAfterFirstPass?.status, "retry");
    assert.equal(stateAfterFirstPass?.attemptCount, 1);
    assert.match(stateAfterFirstPass?.lastError ?? "", /SMTP unavailable in test/i);

    const secondPass = await processNotificationEmailOutboxBatch({
      batchSize: 10,
      now: new Date(now.getTime() + 2_000),
      baseDelaySeconds: 1,
      maxDelaySeconds: 5,
      deliver: failingDeliver,
      force: true,
    });

    assert.ok(secondPass.claimed >= 1);
    assert.equal(secondPass.sent, 0);
    assert.equal(secondPass.retried, 0);
    assert.ok(secondPass.failed >= 1);

    const stateAfterSecondPass = await readOutboxState(createdId);
    assert.equal(stateAfterSecondPass?.status, "failed");
    assert.equal(stateAfterSecondPass?.attemptCount, 2);
    assert.match(stateAfterSecondPass?.lastError ?? "", /SMTP unavailable in test/i);
    assert.equal(stateAfterSecondPass?.sentAt, null);
  } finally {
    if (createdId) {
      await deleteOutboxRow(createdId);
    }
  }
});

test("notification outbox processor should mark row sent when delivery succeeds", async () => {
  // Keep test window in the past so outbox rows from other tests are not claimed.
  const now = new Date("2002-04-01T12:00:00.000Z");
  const createdId = await insertOutboxRow({
    action: "test.success",
    payload: {
      to: ["success@example.test"],
      subject: "Success test",
      text: "Email success test.",
    },
    maxAttempts: 3,
    nextAttemptAt: new Date(now.getTime() - 60_000).toISOString(),
  });

  try {
    const successPass = await processNotificationEmailOutboxBatch({
      batchSize: 10,
      now,
      deliver: async () => {},
      force: true,
    });

    assert.ok(successPass.claimed >= 1);
    assert.ok(successPass.sent >= 1);
    assert.equal(successPass.retried, 0);
    assert.equal(successPass.failed, 0);

    const stateAfterSuccess = await readOutboxState(createdId);
    assert.equal(stateAfterSuccess?.status, "sent");
    assert.equal(stateAfterSuccess?.attemptCount, 1);
    assert.equal(stateAfterSuccess?.lastError, "");
    assert.ok(stateAfterSuccess?.sentAt);
  } finally {
    if (createdId) {
      await deleteOutboxRow(createdId);
    }
  }
});
