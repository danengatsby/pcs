import type { Server } from "node:http";
import type express from "express";
import { createApp } from "../../app.js";
import { createFastifyServer } from "../../fastifyServer.js";
import { env } from "../../lib/env.js";

export type RuntimeTestServer = {
  adapter: "express" | "fastify";
  target: express.Express | Server;
  close: () => Promise<void>;
};

export async function createRuntimeTestServer(): Promise<RuntimeTestServer> {
  if (env.httpServerAdapter === "fastify") {
    const fastify = await createFastifyServer();
    await fastify.ready();

    return {
      adapter: "fastify",
      target: fastify.server,
      close: async () => {
        await fastify.close();
      },
    };
  }

  return {
    adapter: "express",
    target: createApp(),
    close: async () => Promise.resolve(),
  };
}
