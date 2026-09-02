import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { getApiRouteDefinitions } from "./apiRouteRegistry.js";
import type { ApiRouteDefinition } from "./apiRouteTypes.js";
import { sendError } from "../lib/http.js";
import { buildManifestPageCspHeaderValue, manifestPageFileName } from "./publicPages.js";

const manifestPageCspHeader = buildManifestPageCspHeaderValue();

function registerExpressRoute(app: express.Express, route: ApiRouteDefinition): void {
  switch (route.method) {
    case "GET":
      app.get(route.url, ...route.handlers);
      return;
    case "POST":
      app.post(route.url, ...route.handlers);
      return;
    case "PUT":
      app.put(route.url, ...route.handlers);
      return;
    case "PATCH":
      app.patch(route.url, ...route.handlers);
      return;
    case "DELETE":
      app.delete(route.url, ...route.handlers);
      return;
  }
}

export function registerApiRoutes(app: express.Express, uploadsPath: string): void {
  for (const route of getApiRouteDefinitions()) {
    registerExpressRoute(app, route);
  }

  app.use("/uploads", express.static(uploadsPath));
}

export function registerApiNotFoundRoute(app: express.Express): void {
  app.use("/api", (_req, res) => {
    sendError(res, 404, {
      code: "API_ROUTE_NOT_FOUND",
      message: "Ruta API inexistenta.",
    });
  });
}

export function registerClientSpaFallback(app: express.Express, clientDistPath: string): void {
  if (!existsSync(clientDistPath)) {
    return;
  }

  app.use(
    express.static(clientDistPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(`${path.sep}${manifestPageFileName}`)) {
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("Content-Security-Policy", manifestPageCspHeader);
          return;
        }

        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-store");
          return;
        }

        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          return;
        }

        res.setHeader("Cache-Control", "public, max-age=3600");
      },
    })
  );

  app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}
