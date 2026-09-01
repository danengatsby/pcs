import type { FastifyInstance } from "fastify";
import { getApiRouteDefinitions } from "../appCore/apiRouteRegistry.js";
import { createExpressChainHandler, type FastifyRouteSpec } from "./expressCompat.js";

function registerExpressRoutes(fastify: FastifyInstance, routes: FastifyRouteSpec[]): void {
  for (const route of routes) {
    fastify.route({
      method: route.method,
      url: route.url,
      handler: createExpressChainHandler(route.handlers),
    });
  }
}


export async function registerFastifyApiRoutes(fastify: FastifyInstance): Promise<void> {
  registerExpressRoutes(fastify, getApiRouteDefinitions());
}
