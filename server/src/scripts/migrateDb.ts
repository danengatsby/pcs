import { closePool } from "../lib/db.js";
import { runMigrations, runMigrationSmokeChecks } from "../lib/migrations.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { env } from "../lib/env.js";
import { assertSafeTestDatabase } from "../lib/testDatabaseSafety.js";

export async function runDbMigrationsEntrypoint(): Promise<void> {
  assertSafeTestDatabase({
    nodeEnv: env.nodeEnv,
    databaseUrl: env.databaseUrl,
    testDatabaseUrl: process.env.TEST_DATABASE_URL?.trim() ?? "",
  });

  const result = await runMigrations();
  console.log(`Migrari aplicate: ${result.applied.length}`);
  if (result.applied.length > 0) {
    console.log(`Aplicate: ${result.applied.join(", ")}`);
  } else {
    console.log("Nu exista migrari noi.");
  }

  await runMigrationSmokeChecks();
  console.log("Smoke checks DB: OK");
}

const currentFile = fileURLToPath(import.meta.url);
const executedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (currentFile === executedFile) {
  runDbMigrationsEntrypoint()
    .catch((error) => {
      console.error("Eroare la rularea migrarilor:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closePool();
    });
}
