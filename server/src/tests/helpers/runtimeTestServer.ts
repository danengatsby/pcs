import type { Server } from "node:http";
import { createFastifyServer } from "../../fastifyServer.js";

export type RuntimeTestServer = {
  adapter: "fastify";
  target: Server;
  close: () => Promise<void>;
};

export async function createRuntimeTestServer(): Promise<RuntimeTestServer> {
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
