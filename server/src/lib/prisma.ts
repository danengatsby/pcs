import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

declare global {
  var __pcsPrismaClient: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: env.databaseUrl,
      },
    },
    log: env.nodeEnv === "development"
      ? ["warn", "error"]
      : ["error"],
  });
}

export const prisma = globalThis.__pcsPrismaClient ?? createPrismaClient();
let demoPrisma: PrismaClient | undefined;

// The database account configured here has SELECT permissions only.
export function getAdminDemoPrisma(): PrismaClient {
  if (!env.adminDemoDatabaseUrl) { throw new Error("Baza demo nu este configurată."); }
  demoPrisma ??= new PrismaClient({
    datasources: { db: { url: env.adminDemoDatabaseUrl } },
    log: [],
  });
  return demoPrisma;
}

if (env.nodeEnv !== "production") {
  globalThis.__pcsPrismaClient = prisma;
}

export async function closePrisma(): Promise<void> {
  await Promise.all([prisma.$disconnect(), demoPrisma?.$disconnect()]);
}
