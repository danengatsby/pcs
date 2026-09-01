import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

export type PrismaTx = Prisma.TransactionClient;

export async function withPrismaTransaction<T>(
  runner: (tx: PrismaTx) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => runner(tx));
}
