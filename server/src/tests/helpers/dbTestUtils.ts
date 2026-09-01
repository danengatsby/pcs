import { randomUUID } from "node:crypto";
import { query } from "../../lib/db.js";
import { env } from "../../lib/env.js";
import { assertSafeTestDatabase } from "../../lib/testDatabaseSafety.js";

assertSafeTestDatabase({
  nodeEnv: env.nodeEnv,
  databaseUrl: env.databaseUrl,
  testDatabaseUrl: process.env.TEST_DATABASE_URL?.trim() ?? "",
});

export function buildTestEmail(prefix: string): string {
  const suffix = randomUUID().replaceAll("-", "");
  return `${prefix}.${suffix}@example.test`;
}

export function buildTestNewsTitle(prefix: string): string {
  return `[TEST ${prefix}] ${randomUUID()}`;
}

export async function deleteUserByEmail(email: string): Promise<void> {
  await query(
    `
      DELETE FROM users
      WHERE LOWER(email) = LOWER($1)
    `,
    [email]
  );
}

export async function deleteVolunteerByEmail(email: string): Promise<void> {
  await query(
    `
      DELETE FROM volunteers
      WHERE LOWER(email) = LOWER($1)
    `,
    [email]
  );
}

export async function deleteNewsById(id: number): Promise<void> {
  await query(
    `
      DELETE FROM news
      WHERE id = $1
    `,
    [id]
  );
}
