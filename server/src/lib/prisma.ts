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

if (env.nodeEnv !== "production") {
  globalThis.__pcsPrismaClient = prisma;
}

export async function closePrisma(): Promise<void> {
  await prisma.$disconnect();
}
