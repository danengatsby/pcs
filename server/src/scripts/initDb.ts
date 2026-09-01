import { closePool } from "../lib/db.js";
import { runDbMigrationsEntrypoint } from "./migrateDb.js";

async function main(): Promise<void> {
  await runDbMigrationsEntrypoint();
}

main()
  .catch((error) => {
    console.error("Eroare la initializarea DB:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
