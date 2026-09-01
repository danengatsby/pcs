// Initialize telemetry as early as possible
import { initTelemetry } from "./lib/telemetry.js";

// Initialize before anything else
initTelemetry();

import { createApp } from "./app.js";
import { createFastifyServer } from "./fastifyServer.js";
import { closePool } from "./lib/db.js";
import { env } from "./lib/env.js";
import { appLogger } from "./lib/logger.js";
import { buildInfo } from "./lib/buildInfo.js";
import { closePrisma } from "./lib/prisma.js";
import { closeRedisClient, ensureRedisConnected } from "./lib/redisClient.js";
import { setRuntimeDraining } from "./lib/runtimeState.js";
import {
  startAdminAuditOutboxWorker,
  stopAdminAuditOutboxWorker,
} from "./lib/adminAuditOutboxWorker.js";
import {
  startNotificationOutboxWorker,
  stopNotificationOutboxWorker,
} from "./lib/notificationOutboxWorker.js";

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
    stopAdminAuditOutboxWorker(),
    stopNotificationOutboxWorker(),
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
  if (env.authRefreshEnabled && env.authRefreshStore === "redis") {
    await ensureRedisConnected();
  }

  startNotificationOutboxWorker();
  startAdminAuditOutboxWorker();

  if (env.httpServerAdapter === "express") {
    const app = createApp();
    const server = app.listen(env.port, env.bindHost, () => {
      appLogger.info(
        {
          adapter: env.httpServerAdapter,
          bindHost: env.bindHost,
          port: env.port,
          version: buildInfo.appVersion,
          release: buildInfo.appRelease,
        },
        `PCP API ruleaza pe http://localhost:${env.port}`
      );
    });

    server.on("error", (error) => {
      appLogger.fatal({ err: error }, "Server error fatal.");
      void shutdown("SERVER_ERROR", 1);
    });

    closeHttpServer = async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error?: Error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    };
    return;
  }

  const fastify = await createFastifyServer();
  await fastify.listen({ port: env.port, host: env.bindHost });

  fastify.server.on("error", (error) => {
    appLogger.fatal({ err: error }, "Server error fatal.");
    void shutdown("SERVER_ERROR", 1);
  });

  appLogger.info(
    {
      adapter: env.httpServerAdapter,
      bindHost: env.bindHost,
      port: env.port,
      version: buildInfo.appVersion,
      release: buildInfo.appRelease,
    },
    `PCP API ruleaza pe http://localhost:${env.port}`
  );

  closeHttpServer = async () => {
    await fastify.close();
  };
}

void bootstrap().catch((error) => {
  appLogger.fatal({ err: error }, "Bootstrap failed.");
  void closeResourcesAndExit(1);
});
