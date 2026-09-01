import express from "express";
import { createRequire } from "node:module";
import { openApiSpec } from "./openapi-spec.js";

export const apiDocsPath = "/api-docs";
export const apiDocsIndexPath = "/api-docs/";
export const apiDocsJsonPath = "/api-docs.json";
export const apiDocsAssetsPath = "/api-docs/static";

const apiDocsHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex,nofollow">
  <title>PCS Platform API Documentation</title>
  <link rel="stylesheet" href="${apiDocsAssetsPath}/swagger-ui.css">
  <style>
    html {
      box-sizing: border-box;
      overflow-y: scroll;
    }

    *,
    *::before,
    *::after {
      box-sizing: inherit;
    }

    body {
      margin: 0;
      background: #fafafa;
    }

    .swagger-ui {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", sans-serif;
    }

    .swagger-ui .topbar {
      background-color: #1a1a1a;
    }

    .swagger-ui .topbar .download-url-wrapper {
      display: none;
    }

    .info .title {
      font-size: 2rem;
      color: #333;
    }

    .info .description {
      font-size: 1rem;
      color: #666;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${apiDocsAssetsPath}/swagger-ui-bundle.js"></script>
  <script src="${apiDocsAssetsPath}/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: ${JSON.stringify(apiDocsJsonPath)},
        dom_id: '#swagger-ui',
        deepLinking: true,
        displayOperationId: true,
        defaultModelsExpandDepth: 1,
        docExpansion: 'list',
        filter: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: 'StandaloneLayout'
      });
    };
  </script>
</body>
</html>
`;

const require = createRequire(import.meta.url);
const readSwaggerUiDistPath = require("swagger-ui-dist/absolute-path") as () => string;

export const swaggerUiDistPath = readSwaggerUiDistPath();

export function readSwaggerUiHtml(): string {
  return apiDocsHtml;
}

export function setupSwaggerUI(app: express.Express): void {
  app.get(/^\/api-docs$/, (_req, res) => {
    res.redirect(302, apiDocsIndexPath);
  });

  app.get(apiDocsIndexPath, (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(apiDocsHtml);
  });

  app.get(apiDocsJsonPath, (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(openApiSpec);
  });

  app.use(
    `${apiDocsAssetsPath}/`,
    express.static(swaggerUiDistPath, {
      index: false,
      redirect: false,
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "public, max-age=3600");
      },
    })
  );
}
