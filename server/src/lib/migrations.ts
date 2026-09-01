import { readdir, readFile } from "node:fs/promises";
import { pool, query } from "./db.js";

const migrationsDir = new URL("../../sql/migrations/", import.meta.url);

type AppliedMigrationRow = {
  version: string;
};

export type MigrationResult = {
  applied: string[];
  skipped: string[];
};

type RegclassRow = {
  regclass: string | null;
};

type ColumnExistsRow = {
  exists: boolean;
};

async function ensureMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function readMigrationFilenames(): Promise<string[]> {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

export async function runMigrations(): Promise<MigrationResult> {
  await ensureMigrationsTable();

  const [filenames, appliedRows] = await Promise.all([
    readMigrationFilenames(),
    query<AppliedMigrationRow>(`
      SELECT version
      FROM schema_migrations
      ORDER BY version ASC
    `),
  ]);

  const appliedSet = new Set(appliedRows.rows.map((row) => row.version));
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const filename of filenames) {
    if (appliedSet.has(filename)) {
      skipped.push(filename);
      continue;
    }

    const sql = await readFile(new URL(filename, migrationsDir), "utf8");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        `
          INSERT INTO schema_migrations (version)
          VALUES ($1)
        `,
        [filename]
      );
      await client.query("COMMIT");
      applied.push(filename);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    applied,
    skipped,
  };
}

export async function runMigrationSmokeChecks(): Promise<void> {
  const requiredTables = [
    "news",
    "users",
    "counties",
    "volunteers",
    "rate_limit_entries",
    "auth_revoked_tokens",
    "auth_refresh_tokens",
    "admin_audit_log",
    "admin_audit_outbox",
    "news_media_assets",
    "news_media_links",
    "notification_email_outbox",
  ];

  for (const tableName of requiredTables) {
    const result = await query<RegclassRow>(
      `
        SELECT to_regclass($1) AS regclass
      `,
      [tableName]
    );

    if (!result.rows[0]?.regclass) {
      throw new Error(`Smoke check failed: tabela lipsa (${tableName}).`);
    }
  }

  const requiredColumns: Array<{ tableName: string; columnName: string }> = [
    { tableName: "volunteers", columnName: "county_id" },
    { tableName: "volunteers", columnName: "owner_user_id" },
    { tableName: "volunteers", columnName: "crm_priority" },
    { tableName: "volunteers", columnName: "reminder_at" },
    { tableName: "volunteers", columnName: "skill_tags" },
    { tableName: "news_media_assets", columnName: "deleted_at" },
    { tableName: "news_media_links", columnName: "asset_id" },
    { tableName: "auth_refresh_tokens", columnName: "token_hash" },
    { tableName: "auth_refresh_tokens", columnName: "csrf_token_hash" },
    { tableName: "notification_email_outbox", columnName: "status" },
    { tableName: "notification_email_outbox", columnName: "next_attempt_at" },
    { tableName: "admin_audit_outbox", columnName: "status" },
    { tableName: "admin_audit_outbox", columnName: "next_attempt_at" },
  ];

  for (const item of requiredColumns) {
    const result = await query<ColumnExistsRow>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2
        ) AS exists
      `,
      [item.tableName, item.columnName]
    );

    if (!result.rows[0]?.exists) {
      throw new Error(
        `Smoke check failed: coloana lipsa (${item.tableName}.${item.columnName}).`
      );
    }
  }
}
