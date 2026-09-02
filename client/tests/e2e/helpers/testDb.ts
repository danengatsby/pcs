import { randomUUID } from "node:crypto";
import path from "node:path";
import dotenv from "dotenv";
import { Pool, type QueryResult, type QueryResultRow } from "pg";

const envPath = path.resolve(process.cwd(), "server/.env");
dotenv.config({ path: envPath });

const databaseUrl = readDatabaseUrl();
assertSafeTestDatabase(databaseUrl);

const pool = new Pool({
  connectionString: databaseUrl,
  allowExitOnIdle: true,
});
let poolClosed = false;

export function buildTestEmail(prefix: string): string {
  const suffix = randomUUID().replaceAll("-", "");
  return `${prefix}.${suffix}@example.test`;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return pool.query<T>(sql, params);
}

export async function closeTestDb(): Promise<void> {
  if (poolClosed) {
    return;
  }

  poolClosed = true;
  await pool.end();
}

export async function deleteUserByEmail(email: string): Promise<void> {
  await query(
    `
      DELETE FROM users
      WHERE LOWER(email) = LOWER($1)
    `,
    [email],
  );
}

export async function deleteVolunteerByEmail(email: string): Promise<void> {
  await query(
    `
      DELETE FROM volunteers
      WHERE LOWER(email) = LOWER($1)
    `,
    [email],
  );
}

export async function deleteMembershipByEmail(email: string): Promise<void> {
  await query(
    `
      DELETE FROM membership_records
      WHERE LOWER(email) = LOWER($1)
    `,
    [email],
  );
}

export async function insertMembershipByEmail(
  email: string,
  status: "supporter" | "application" | "verified" | "approved" | "active",
): Promise<void> {
  await query(
    `
      WITH membership_subject AS (
        SELECT
          app_user.id AS user_id,
          volunteer.id AS volunteer_id,
          COALESCE(app_user.full_name, volunteer.full_name) AS full_name,
          LOWER(COALESCE(app_user.email, volunteer.email)) AS email
        FROM (
          SELECT id, full_name, email
          FROM users
          WHERE LOWER(email) = LOWER($1)
          LIMIT 1
        ) app_user
        FULL OUTER JOIN (
          SELECT id, full_name, email
          FROM volunteers
          WHERE LOWER(email) = LOWER($1)
          LIMIT 1
        ) volunteer ON LOWER(volunteer.email) = LOWER(app_user.email)
      )
      INSERT INTO membership_records (
        user_id,
        volunteer_id,
        full_name,
        email,
        status,
        application_at,
        validated_at,
        approved_at,
        joined_at
      )
      SELECT
        user_id,
        volunteer_id,
        full_name,
        email,
        $2::varchar,
        NOW(),
        CASE WHEN $2::varchar IN ('verified', 'approved', 'active') THEN NOW() END,
        CASE WHEN $2::varchar IN ('approved', 'active') THEN NOW() END,
        CASE WHEN $2::varchar = 'active' THEN NOW() END
      FROM membership_subject
    `,
    [email, status],
  );
}

export async function setUserRole(email: string, role: string): Promise<void> {
  await query(
    `
      UPDATE users
      SET role = $2
      WHERE LOWER(email) = LOWER($1)
    `,
    [email, role],
  );
}

export async function insertVolunteerWithoutUser(input: {
  fullName: string
  email: string
  phone?: string
  county: string
  locality: string
  skills?: string
  motivation?: string
  workflowStatus: "nou" | "validat" | "contactat" | "activ"
  internalNotes?: string
}): Promise<void> {
  const countyId = await readCountyId(input.county);

  await query(
    `
      INSERT INTO volunteers (
        full_name,
        email,
        phone,
        county,
        county_id,
        locality,
        skills,
        motivation,
        workflow_status,
        internal_notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
    [
      input.fullName,
      input.email,
      input.phone ?? "0712345678",
      input.county,
      countyId,
      input.locality,
      input.skills ?? "organizare",
      input.motivation ?? "Implicare locală.",
      input.workflowStatus,
      input.internalNotes ?? "",
    ],
  );
}

async function readCountyId(name: string): Promise<number> {
  const result = await query<{ id: number }>(
    `
      SELECT id
      FROM counties
      WHERE LOWER(name) = LOWER($1)
      LIMIT 1
    `,
    [name],
  );

  const id = result.rows[0]?.id;
  if (!id) {
    throw new Error(`County not found in test DB: ${name}`);
  }

  return id;
}

function readDatabaseUrl(): string {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
  if (testDatabaseUrl) {
    return testDatabaseUrl;
  }

  const directUrl = process.env.DATABASE_URL?.trim();
  if (directUrl) {
    return directUrl;
  }

  const host = process.env.POSTGRES_HOST?.trim();
  const port = process.env.POSTGRES_PORT?.trim() ?? "5432";
  const database = process.env.POSTGRES_DB?.trim();
  const user = process.env.POSTGRES_USER?.trim();
  const password = process.env.POSTGRES_PASSWORD ?? "";

  if (!host || !database || !user) {
    throw new Error("Missing DB config for Playwright fullstack tests.");
  }

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  const encodedDatabase = encodeURIComponent(database);
  const auth = password ? `${encodedUser}:${encodedPassword}` : encodedUser;

  return `postgres://${auth}@${host}:${port}/${encodedDatabase}`;
}

function assertSafeTestDatabase(databaseUrlValue: string): void {
  const explicitTestDatabaseUrl = process.env.TEST_DATABASE_URL?.trim() ?? "";
  if (!explicitTestDatabaseUrl || databaseUrlValue !== explicitTestDatabaseUrl) {
    throw new Error("Full-stack tests require an explicit TEST_DATABASE_URL.");
  }

  let databaseName = "";
  try {
    databaseName = decodeURIComponent(new URL(databaseUrlValue).pathname.replace(/^\/+/, ""));
  } catch {
    // The message below intentionally avoids echoing a possibly sensitive URL.
  }

  if (!/(^|[_-])(test|testing)([_-]|$)/i.test(databaseName)) {
    throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test' or 'testing'.");
  }
}
