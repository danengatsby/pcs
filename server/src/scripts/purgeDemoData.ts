import type { PoolClient, QueryResult } from "pg";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { closePool, withTransaction } from "../lib/db.js";
import { env } from "../lib/env.js";
import { readDemoDataCounts } from "../lib/productionDataIntegrity.js";

const confirmation = "DELETE_SYNTHETIC_DATA";

async function tableExists(client: PoolClient, tableName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    "SELECT to_regclass($1) IS NOT NULL AS exists",
    [`public.${tableName}`],
  );
  return result.rows[0]?.exists === true;
}

async function assertNoUnmarkedRestrictedReferences(client: PoolClient): Promise<void> {
  const checks = [
    {
      table: "congresses",
      sql: `SELECT COUNT(*)::INTEGER AS count FROM congresses congress
        JOIN organizations organization ON organization.id = congress.organization_id
        LEFT JOIN users creator ON creator.id = congress.created_by
        WHERE organization.is_demo = TRUE OR creator.is_demo = TRUE`,
    },
    {
      table: "arbitration_cases",
      sql: `SELECT COUNT(*)::INTEGER AS count FROM arbitration_cases arbitration
        LEFT JOIN organizations organization ON organization.id = arbitration.organization_id
        JOIN users filer ON filer.id = arbitration.filed_by
        WHERE organization.is_demo = TRUE OR filer.is_demo = TRUE`,
    },
  ] as const;

  for (const check of checks) {
    if (!await tableExists(client, check.table)) {
      continue;
    }
    const result = await client.query<{ count: number }>(check.sql);
    if (Number(result.rows[0]?.count ?? 0) > 0) {
      throw new Error(
        `Curatarea a fost oprita: ${check.table} contine referinte la date demo care necesita revizuire manuala.`,
      );
    }
  }

  const nonDemoChildren = await client.query<{ count: number }>(`
    SELECT COUNT(*)::INTEGER AS count
    FROM organizations child
    JOIN organizations parent ON parent.id = child.parent_id
    WHERE parent.is_demo = TRUE AND child.is_demo = FALSE
  `);
  if (Number(nonDemoChildren.rows[0]?.count ?? 0) > 0) {
    throw new Error(
      "Curatarea a fost oprita: exista organizatii reale dependente de un parinte demo.",
    );
  }
}

function affected(result: QueryResult): number {
  return result.rowCount ?? 0;
}

export async function purgeDemoData(client: PoolClient): Promise<Record<string, number>> {
  await assertNoUnmarkedRestrictedReferences(client);
  const summary: Record<string, number> = {};

  // Opreste expunerea prin versiunea veche a aplicatiei pana la publicarea
  // explicita in fluxul editorial nou.
  summary.newsHeldForReview = affected(await client.query(`
    UPDATE news
    SET status = 'draft'
    WHERE is_demo = FALSE
      AND public_approved_at IS NULL
      AND status IN ('published', 'scheduled')
  `));
  summary.actionsHeldForReview = affected(await client.query(`
    UPDATE mobilization_actions
    SET status = 'draft', visibility = 'internal', updated_at = NOW()
    WHERE is_demo = FALSE
      AND public_approved_at IS NULL
      AND status = 'open'
      AND visibility = 'public'
  `));

  await client.query(`UPDATE news SET public_approved_at = NULL, public_approved_by = NULL
    WHERE public_approved_by IN (SELECT id FROM users WHERE is_demo = TRUE)`);
  await client.query(`UPDATE organizations SET public_approved_at = NULL, public_approved_by = NULL
    WHERE public_approved_by IN (SELECT id FROM users WHERE is_demo = TRUE)`);
  await client.query(`UPDATE organization_leadership_mandates
    SET public_approved_at = NULL, public_approved_by = NULL
    WHERE public_approved_by IN (SELECT id FROM users WHERE is_demo = TRUE)`);
  await client.query(`UPDATE mobilization_actions
    SET public_approved_at = NULL, public_approved_by = NULL,
        public_response_count = NULL, response_count_approved_at = NULL,
        response_count_approved_by = NULL
    WHERE public_approved_by IN (SELECT id FROM users WHERE is_demo = TRUE)
       OR response_count_approved_by IN (SELECT id FROM users WHERE is_demo = TRUE)`);
  await client.query(`UPDATE public_indicators SET approved_at = NULL, approved_by = NULL
    WHERE approved_by IN (SELECT id FROM users WHERE is_demo = TRUE)`);

  summary.dispatchRecipients = affected(await client.query(`
    DELETE FROM communication_dispatch_recipients recipient
    WHERE recipient.consent_id IN (SELECT id FROM communication_consents WHERE is_demo = TRUE)
       OR recipient.dispatch_id IN (
         SELECT dispatch.id FROM communication_dispatches dispatch
         JOIN users creator ON creator.id = dispatch.created_by
         WHERE creator.is_demo = TRUE
       )
  `));
  summary.dispatches = affected(await client.query(`
    DELETE FROM communication_dispatches dispatch
    USING users creator
    WHERE dispatch.created_by = creator.id AND creator.is_demo = TRUE
  `));
  summary.participants = affected(await client.query("DELETE FROM mobilization_participants WHERE is_demo = TRUE"));
  summary.responses = affected(await client.query("DELETE FROM mobilization_responses WHERE is_demo = TRUE"));
  summary.consents = affected(await client.query("DELETE FROM communication_consents WHERE is_demo = TRUE"));
  summary.dues = affected(await client.query("DELETE FROM membership_dues WHERE is_demo = TRUE"));
  summary.membershipEvents = affected(await client.query("DELETE FROM membership_events WHERE is_demo = TRUE"));
  summary.memberships = affected(await client.query("DELETE FROM membership_records WHERE is_demo = TRUE"));
  summary.mandates = affected(await client.query("DELETE FROM organization_leadership_mandates WHERE is_demo = TRUE"));
  summary.objectives = affected(await client.query("DELETE FROM organization_objectives WHERE is_demo = TRUE"));
  summary.actions = affected(await client.query("DELETE FROM mobilization_actions WHERE is_demo = TRUE"));
  summary.indicators = affected(await client.query("DELETE FROM public_indicators WHERE is_demo = TRUE"));
  summary.news = affected(await client.query("DELETE FROM news WHERE is_demo = TRUE"));

  if (await tableExists(client, "organization_mandate_decisions")) {
    summary.mandateDecisions = affected(await client.query(`
      DELETE FROM organization_mandate_decisions decision
      USING organizations organization
      WHERE decision.organization_id = organization.id AND organization.is_demo = TRUE
    `));
  }

  let removedOrganizations = 0;
  while (true) {
    const result = await client.query(`
      DELETE FROM organizations organization
      WHERE organization.is_demo = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM organizations child WHERE child.parent_id = organization.id
        )
    `);
    const rowCount = affected(result);
    removedOrganizations += rowCount;
    if (rowCount === 0) {
      break;
    }
  }
  summary.organizations = removedOrganizations;

  const remainingDemoOrganizations = await client.query<{ count: number }>(
    "SELECT COUNT(*)::INTEGER AS count FROM organizations WHERE is_demo = TRUE",
  );
  if (Number(remainingDemoOrganizations.rows[0]?.count ?? 0) > 0) {
    throw new Error("Curatarea a fost oprita: unele organizatii demo au dependente nerevizuite.");
  }

  summary.volunteers = affected(await client.query("DELETE FROM volunteers WHERE is_demo = TRUE"));
  summary.users = affected(await client.query("DELETE FROM users WHERE is_demo = TRUE"));
  return summary;
}

export async function runPurgeDemoDataEntrypoint(): Promise<void> {
  if (env.nodeEnv !== "production") {
    throw new Error("Curatarea este permisa numai cu NODE_ENV=production.");
  }
  if (process.env.PURGE_DEMO_DATA_CONFIRM !== confirmation) {
    throw new Error(`Seteaza PURGE_DEMO_DATA_CONFIRM=${confirmation} pentru confirmare explicita.`);
  }

  const before = await readDemoDataCounts();
  const summary = await withTransaction(purgeDemoData);
  const after = await readDemoDataCounts();
  if (after.length > 0) {
    throw new Error(`Au ramas date demo: ${after.map((item) => `${item.source}=${item.count}`).join(", ")}`);
  }
  console.log("Curatare demo finalizata:", { before, deleted: summary });
}

const currentFile = fileURLToPath(import.meta.url);
const executedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (currentFile === executedFile) {
  runPurgeDemoDataEntrypoint().catch((error) => {
    console.error("Curatarea datelor demo a esuat; tranzactia a fost anulata:", error);
    process.exitCode = 1;
  }).finally(async () => {
    await closePool();
  });
}
