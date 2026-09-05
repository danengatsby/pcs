// Initialize telemetry as early as possible
import { initTelemetry } from "./lib/telemetry.js";

// Initialize before anything else
initTelemetry();

import { createFastifyServer } from "./fastifyServer.js";
import { closePool } from "./lib/db.js";
import { env } from "./lib/env.js";
import { appLogger } from "./lib/logger.js";
import { buildInfo } from "./lib/buildInfo.js";
import { closePrisma } from "./lib/prisma.js";
import { closeRedisClient, ensureRedisConnected } from "./lib/redisClient.js";
import { setRuntimeDraining } from "./lib/runtimeState.js";
import { assertNoDemoDataInProduction } from "./lib/productionDataIntegrity.js";

let shutdownStarted = false;
let forcedExitTimer: ReturnType<typeof setTimeout> | null = null;
let closeHttpServer: (() => Promise<void>) | null = null;

function clearForcedExitTimer(): void {
  if (!forcedExitTimer) {
    return;
  }

  clearTimeout(forcedExitTimer);
  forcedExitTimer = null;
}

async function closeResourcesAndExit(code: number): Promise<void> {
  const results = await Promise.allSettled([
    closePool(),
    closePrisma(),
    closeRedisClient(),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      appLogger.error({ err: result.reason }, "Eroare la inchiderea resurselor.");
    }
  }

  process.exit(code);
}

async function shutdown(signal: string, code = 0): Promise<void> {
  if (shutdownStarted) {
    appLogger.warn({ signal }, "Shutdown deja in progres.");
    return;
  }

  shutdownStarted = true;
  setRuntimeDraining(true);

  appLogger.info(
    {
      signal,
      graceMs: env.shutdownGraceMs,
    },
    "Semnal primit. Inchid serverul..."
  );

  forcedExitTimer = setTimeout(() => {
    appLogger.error(
      { graceMs: env.shutdownGraceMs },
      "Shutdown grace period depasit. Fortez iesirea procesului."
    );
    void closeResourcesAndExit(1);
  }, env.shutdownGraceMs);
  forcedExitTimer.unref?.();

  try {
    if (closeHttpServer) {
      await closeHttpServer();
      appLogger.info("Server HTTP inchis. Eliberez resursele.");
    }
    clearForcedExitTimer();
    await closeResourcesAndExit(code);
  } catch (error) {
    clearForcedExitTimer();
    appLogger.error({ err: error }, "Eroare la inchiderea serverului HTTP.");
    await closeResourcesAndExit(1);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("unhandledRejection", (reason) => {
  appLogger.error({ reason }, "Unhandled promise rejection.");
  void shutdown("UNHANDLED_REJECTION", 1);
});

process.on("uncaughtException", (error) => {
  appLogger.fatal({ err: error }, "Uncaught exception.");
  void shutdown("UNCAUGHT_EXCEPTION", 1);
});

async function bootstrap(): Promise<void> {
  await assertNoDemoDataInProduction(env.nodeEnv);

  if (env.authRefreshEnabled && env.authRefreshStore === "redis") {
    await ensureRedisConnected();
  }

  const fastify = await createFastifyServer();
  await fastify.listen({ port: env.port, host: env.bindHost });

  fastify.server.on("error", (error) => {
    appLogger.fatal({ err: error }, "Server error fatal.");
    void shutdown("SERVER_ERROR", 1);
  });

  appLogger.info(
    {
      adapter: "fastify",
      bindHost: env.bindHost,
      port: env.port,
      version: buildInfo.appVersion,
      release: buildInfo.appRelease,
    },
    `PCS API ruleaza pe http://localhost:${env.port}`
  );

  closeHttpServer = async () => {
    await fastify.close();
  };
}

void bootstrap().catch((error) => {
  appLogger.fatal({ err: error }, "Bootstrap failed.");
  void closeResourcesAndExit(1);
});
