import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

declare global {
  var __pcpPrismaClient: PrismaClient | undefined;
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

export const prisma = globalThis.__pcpPrismaClient ?? createPrismaClient();

if (env.nodeEnv !== "production") {
  globalThis.__pcpPrismaClient = prisma;
}

export async function closePrisma(): Promise<void> {
  await prisma.$disconnect();
}
