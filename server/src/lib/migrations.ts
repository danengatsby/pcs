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
    "organizations",
    "organization_territories",
    "organization_leadership_mandates",
    "organization_objectives",
    "membership_records",
    "membership_events",
    "mobilization_actions",
    "mobilization_responses",
    "mobilization_action_counties",
    "mobilization_participants",
    "communication_consents",
    "communication_dispatches",
    "communication_dispatch_recipients",
    "member_documents",
    "membership_dues",
    "public_indicators",
    "regulated_module_gates",
    "financial_transparency_records",
    "electoral_operations",
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
    { tableName: "volunteers", columnName: "is_demo" },
    { tableName: "news", columnName: "source_name" },
    { tableName: "news", columnName: "source_url" },
    { tableName: "news", columnName: "public_approved_at" },
    { tableName: "news_media_assets", columnName: "deleted_at" },
    { tableName: "news_media_links", columnName: "asset_id" },
    { tableName: "auth_refresh_tokens", columnName: "token_hash" },
    { tableName: "auth_refresh_tokens", columnName: "csrf_token_hash" },
    { tableName: "notification_email_outbox", columnName: "status" },
    { tableName: "notification_email_outbox", columnName: "event_id" },
    { tableName: "notification_email_outbox", columnName: "next_attempt_at" },
    { tableName: "admin_audit_outbox", columnName: "status" },
    { tableName: "admin_audit_outbox", columnName: "next_attempt_at" },
    { tableName: "organizations", columnName: "code" },
    { tableName: "organizations", columnName: "parent_id" },
    { tableName: "organizations", columnName: "founded_at" },
    { tableName: "organizations", columnName: "is_demo" },
    { tableName: "organizations", columnName: "public_approved_at" },
    { tableName: "organization_territories", columnName: "county_id" },
    { tableName: "organization_leadership_mandates", columnName: "started_at" },
    { tableName: "organization_leadership_mandates", columnName: "public_approved_at" },
    { tableName: "organization_objectives", columnName: "current_value" },
    { tableName: "member_documents", columnName: "expires_on" },
    { tableName: "organization_mandate_decisions", columnName: "expires_on" },
    { tableName: "congress_decisions", columnName: "expires_on" },
    { tableName: "arbitration_decisions", columnName: "expires_on" },
    { tableName: "membership_records", columnName: "organization_id" },
    { tableName: "membership_records", columnName: "version" },
    { tableName: "membership_records", columnName: "member_number" },
    { tableName: "membership_records", columnName: "application_at" },
    { tableName: "membership_records", columnName: "approved_at" },
    { tableName: "membership_records", columnName: "approval_organization_id" },
    { tableName: "membership_events", columnName: "effective_at" },
    { tableName: "mobilization_actions", columnName: "action_type" },
    { tableName: "mobilization_actions", columnName: "visibility" },
    { tableName: "mobilization_actions", columnName: "organization_id" },
    { tableName: "mobilization_actions", columnName: "public_approved_at" },
    { tableName: "mobilization_actions", columnName: "public_response_count" },
    { tableName: "mobilization_responses", columnName: "updates_consent" },
    { tableName: "mobilization_responses", columnName: "email_consent" },
    { tableName: "communication_consents", columnName: "email_consent" },
    { tableName: "mobilization_participants", columnName: "attendance_status" },
    { tableName: "regulated_module_gates", columnName: "enabled" },
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
