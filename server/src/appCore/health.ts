import { env } from "../lib/env.js";
import { buildInfo } from "../lib/buildInfo.js";
import { prisma } from "../lib/prisma.js";
import { isRuntimeDraining, readRuntimeSnapshot } from "../lib/runtimeState.js";

type DependencyStatus = {
  status: "up" | "down";
  latencyMs: number | null;
  message: string;
};

type ReadinessReport = {
  service: string;
  status: "ok" | "degraded";
  ready: boolean;
  environment: string;
  runtime: ReturnType<typeof readRuntimeSnapshot>;
  build: typeof buildInfo;
  dependencies: {
    database: DependencyStatus;
  };
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${label}_TIMEOUT`));
    }, timeoutMs);

    void promise.then(
      (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

async function checkDatabaseDependency(): Promise<DependencyStatus> {
  const startedAt = process.hrtime.bigint();

  try {
    await withTimeout(
      prisma.user.findFirst({
        select: { id: true },
      }),
      env.healthcheckDbTimeoutMs,
      "DB_HEALTHCHECK"
    );
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    return {
      status: "up",
      latencyMs: Number(elapsedMs.toFixed(2)),
      message: "ok",
    };
  } catch (error) {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const message = error instanceof Error ? error.message : "unknown_error";

    return {
      status: "down",
      latencyMs: Number(elapsedMs.toFixed(2)),
      message,
    };
  }
}

export async function buildReadinessReport(): Promise<ReadinessReport> {
  const database = await checkDatabaseDependency();
  const draining = isRuntimeDraining();
  const ready = !draining && database.status === "up";

  return {
    service: buildInfo.appName,
    status: ready ? "ok" : "degraded",
    ready,
    environment: env.nodeEnv || "unknown",
    runtime: readRuntimeSnapshot(),
    build: buildInfo,
    dependencies: {
      database,
    },
  };
}

export function buildLivenessPayload(): {
  service: string;
  status: "live";
  runtime: ReturnType<typeof readRuntimeSnapshot>;
  build: typeof buildInfo;
} {
  return {
    service: buildInfo.appName,
    status: "live",
    runtime: readRuntimeSnapshot(),
    build: buildInfo,
  };
}
