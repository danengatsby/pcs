import { closePool } from "../lib/db.js";
import { env } from "../lib/env.js";
import { assertNoDemoDataInProduction } from "../lib/productionDataIntegrity.js";

async function main(): Promise<void> {
  if (env.nodeEnv !== "production") {
    throw new Error("Verificarea de integritate production necesita NODE_ENV=production.");
  }
  await assertNoDemoDataInProduction(env.nodeEnv);
  console.log("Integritate date production: OK (zero randuri is_demo). ");
}

main().catch((error) => {
  console.error("Integritate date production esuata:", error);
  process.exitCode = 1;
}).finally(async () => {
  await closePool();
});
