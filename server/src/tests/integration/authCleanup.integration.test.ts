import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import { cleanupExpiredRefreshTokenSessions } from "../../lib/authRefreshToken.js";
import { cleanupExpiredRevokedTokens } from "../../lib/authTokenRevocation.js";
import { query } from "../../lib/db.js";
import { buildTestEmail, deleteUserByEmail } from "../helpers/dbTestUtils.js";

type ExistsRow = {
  exists: boolean;
};

type UserIdRow = {
  id: string;
};

function createTokenHash(seed: string): string {
  return createHash("sha256").update(seed).digest("hex");
}

async function hasRevokedToken(jti: string): Promise<boolean> {
  const result = await query<ExistsRow>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM auth_revoked_tokens
        WHERE jti = $1
      ) AS exists
    `,
    [jti]
  );

  return Boolean(result.rows[0]?.exists);
}

async function hasRefreshToken(tokenHash: string): Promise<boolean> {
  const result = await query<ExistsRow>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM auth_refresh_tokens
        WHERE token_hash = $1
      ) AS exists
    `,
    [tokenHash]
  );

  return Boolean(result.rows[0]?.exists);
}

test("cleanupExpiredRevokedTokens should remove only expired revoked tokens", async () => {
  const uniqueSuffix = randomUUID().replaceAll("-", "");
  const expiredJti = `expired-${uniqueSuffix}`;
  const activeJti = `active-${uniqueSuffix}`;

  try {
    await query(
      `
        INSERT INTO auth_revoked_tokens (jti, expires_at, revoked_at)
        VALUES ($1, NOW() - INTERVAL '2 hours', NOW())
      `,
      [expiredJti]
    );

    await query(
      `
        INSERT INTO auth_revoked_tokens (jti, expires_at, revoked_at)
        VALUES ($1, NOW() + INTERVAL '2 hours', NOW())
      `,
      [activeJti]
    );

    await cleanupExpiredRevokedTokens(100000);

    assert.equal(await hasRevokedToken(expiredJti), false);
    assert.equal(await hasRevokedToken(activeJti), true);
  } finally {
    await query(
      `
        DELETE FROM auth_revoked_tokens
        WHERE jti IN ($1, $2)
      `,
      [expiredJti, activeJti]
    );
  }
});

test("cleanupExpiredRefreshTokenSessions should remove only expired refresh sessions", async () => {
  const email = buildTestEmail("auth-cleanup-refresh");
  const expiredHash = createTokenHash(`expired-${randomUUID()}`);
  const activeHash = createTokenHash(`active-${randomUUID()}`);
  let userId = 0;

  try {
    const userResult = await query<UserIdRow>(
      `
        INSERT INTO users (full_name, email, password_hash, role)
        VALUES ($1, $2, $3, 'ADERENT')
        RETURNING id::text AS id
      `,
      ["Auth Cleanup", email, `scrypt$testsalt$${"ab".repeat(64)}`]
    );

    userId = Number(userResult.rows[0]?.id ?? "0");
    assert.ok(userId > 0);

    await query(
      `
        INSERT INTO auth_refresh_tokens (
          token_hash,
          csrf_token_hash,
          user_id,
          expires_at,
          revoked_at,
          user_agent,
          ip_address
        )
        VALUES ($1, $2, $3, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours', '', '')
      `,
      [expiredHash, expiredHash, userId]
    );

    await query(
      `
        INSERT INTO auth_refresh_tokens (
          token_hash,
          csrf_token_hash,
          user_id,
          expires_at,
          revoked_at,
          user_agent,
          ip_address
        )
        VALUES ($1, $2, $3, NOW() + INTERVAL '2 hours', NULL, '', '')
      `,
      [activeHash, activeHash, userId]
    );

    await cleanupExpiredRefreshTokenSessions(100000);

    assert.equal(await hasRefreshToken(expiredHash), false);
    assert.equal(await hasRefreshToken(activeHash), true);
  } finally {
    await query(
      `
        DELETE FROM auth_refresh_tokens
        WHERE token_hash IN ($1, $2)
      `,
      [expiredHash, activeHash]
    );

    if (userId > 0) {
      await deleteUserByEmail(email);
    }
  }
});
