/**
 * OpenAPI 3.0 Specification for PCS Platform API
 * Static contract kept in sync with handlers by tests
 */

import { newsMediaKindValues, newsStatusValues } from "../modules/news/types.js";
import { refreshCsrfHeaderName } from "../modules/auth/types.js";
import { memberWorkflowStatuses } from "../modules/members/members.schema.js";
import {
  volunteerContactChannelValues,
  volunteerPriorityValues,
  volunteerStatusValues,
} from "../modules/volunteers/types.js";
import { packageVersion } from "./buildInfo.js";
import { env } from "./env.js";

function createSuccessResponseSchema(dataSchema: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "object",
    required: ["data", "error", "meta"],
    properties: {
      data: dataSchema,
      error: {
        nullable: true,
        description: "Always null for success responses",
        example: null,
      },
      meta: {
        $ref: "#/components/schemas/ApiMeta",
      },
    },
  };
}

const positiveIntegerSchema = {
  type: "integer",
  minimum: 1,
} as const;

const newsIdParameter = {
  name: "id",
  in: "path",
  required: true,
  description: "Numeric news article ID",
  schema: positiveIntegerSchema,
} as const;

const newsMediaAssetIdParameter = {
  name: "assetId",
  in: "path",
  required: true,
  description: "Numeric media asset ID",
  schema: positiveIntegerSchema,
} as const;

const organizationIdParameter = {
  name: "id",
  in: "path",
  required: true,
  description: "Organization identifier",
  schema: { type: "string", minLength: 1, maxLength: 80 },
} as const;

const organizationChildIdParameter = {
  name: "childId",
  in: "path",
  required: true,
  description: "Mandate or objective identifier",
  schema: positiveIntegerSchema,
} as const;

const newsWriteRequestSchema = {
  $ref: "#/components/schemas/NewsWriteInput",
} as const;

const userRoleValues = [
  "SUSTINATOR",
  "ADERENT",
  "MEMBRU",
  "CONSILIER",
  "SECRETAR",
  "VICEPRESEDINTE",
  "PRESEDINTE",
] as const;

const authSignupRequestSchema = {
  $ref: "#/components/schemas/AuthSignupInput",
} as const;

const authSigninRequestSchema = {
  $ref: "#/components/schemas/AuthSigninInput",
} as const;

const volunteerSignupRequestSchema = {
  $ref: "#/components/schemas/VolunteerSignupInput",
} as const;

const volunteerWorkflowUpdateRequestSchema = {
  $ref: "#/components/schemas/VolunteerWorkflowUpdateInput",
} as const;

const volunteerBulkWorkflowUpdateRequestSchema = {
  $ref: "#/components/schemas/VolunteerBulkWorkflowUpdateInput",
} as const;

const volunteerBulkDeleteRequestSchema = {
  $ref: "#/components/schemas/VolunteerBulkDeleteInput",
} as const;

const adminEmailTestRequestSchema = {
  $ref: "#/components/schemas/AdminEmailTestInput",
} as const;

const csrfHeaderParameter = {
  name: refreshCsrfHeaderName,
  in: "header",
  required: true,
  description: "CSRF header required by the refresh cookie flow.",
  schema: {
    type: "string",
    minLength: 1,
  },
} as const;

const optionalCsrfHeaderParameter = {
  ...csrfHeaderParameter,
  required: false,
  description: "CSRF header used when the request also carries refresh auth cookies.",
} as const;

export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "PCS Platform API",
    version: packageVersion,
    description:
      "Romanian political platform API for news, volunteers, members, and administration management",
    contact: {
      name: "PCS Development Team",
    },
  },
  servers: [
    {
      url: "/api",
      description: "Production API",
    },
  ],
  paths: {
    "/health/live": {
      get: {
        tags: ["Health"],
        summary: "Liveness probe",
        description: "Returns basic liveness status for Kubernetes/Docker health checks",
        operationId: "getHealthLive",
        responses: {
          "200": {
            description: "Service is alive",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiSuccessResponse",
                },
              },
            },
          },
        },
      },
    },
    "/health/ready": {
      get: {
        tags: ["Health"],
        summary: "Readiness probe",
        description: "Returns readiness status including database and external service checks",
        operationId: "getHealthReady",
        responses: {
          "200": {
            description: "Service is ready to handle requests",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiSuccessResponse",
                },
              },
            },
          },
          "503": {
            description: "Service is not ready",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        description: "Alias for readiness probe",
        operationId: "getHealth",
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiSuccessResponse",
                },
              },
            },
          },
          "503": {
            description: "Service is unhealthy",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    ...(env.metricsEnabled
      ? {
        "/metrics": {
          get: {
            tags: ["Monitoring"],
            summary: "Prometheus metrics endpoint",
            description: "Returns Prometheus-format metrics (requires metrics authorization)",
            operationId: "getMetrics",
            security: [
              {
                BearerAuth: [],
              },
            ],
            responses: {
              "200": {
                description: "Metrics in Prometheus text format",
                content: {
                  "text/plain": {
                    schema: {
                      type: "string",
                    },
                  },
                },
              },
              "401": {
                description: "Unauthorized - metrics access denied",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/ApiErrorResponse",
                    },
                  },
                },
              },
            },
          },
        },
      }
      : {}),
    "/news": {
      get: {
        tags: ["News"],
        summary: "List public news",
        description: "Lista publica de stiri suporta keyset pagination by default si offset pagination optional.",
        operationId: "listPublicNews",
        parameters: [
          {
            name: "limit",
            in: "query",
            description: "Numar maxim de stiri returnate. Valori permise: 1-24.",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 24,
              default: 6,
            },
          },
          {
            name: "cursor",
            in: "query",
            description: "Cursor base64url pentru keyset pagination.",
            schema: {
              type: "string",
            },
          },
          {
            name: "mode",
            in: "query",
            description: "Modul de paginare. Implicit este keyset.",
            schema: {
              type: "string",
              enum: ["keyset", "offset"],
              default: "keyset",
            },
          },
          {
            name: "offset",
            in: "query",
            description: "Offset folosit doar cand `mode=offset`.",
            schema: {
              type: "integer",
              minimum: 0,
              default: 0,
            },
          },
        ],
        responses: {
          "200": {
            description: "Lista de stiri publice.",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/NewsListItem",
                  },
                }),
              },
            },
          },
          "400": {
            description: "Cursor invalid.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["News"],
        summary: "Create admin news",
        description: "Creeaza o stire noua. Necesita autentificare si unul dintre rolurile privilegiate.",
        operationId: "createAdminNews",
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: newsWriteRequestSchema,
            },
          },
        },
        responses: {
          "201": {
            description: "Stirea a fost creata.",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  type: "object",
                  required: ["message", "news"],
                  properties: {
                    message: {
                      type: "string",
                    },
                    news: {
                      $ref: "#/components/schemas/NewsAdminItem",
                    },
                  },
                }),
              },
            },
          },
          "400": {
            description: "Payload invalid.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "403": {
            description: "Insufficient permissions",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/news/{id}": {
      get: {
        tags: ["News"],
        summary: "Get public news by ID",
        description: "Returneaza detaliile unei stiri publice.",
        operationId: "getPublicNewsById",
        parameters: [newsIdParameter],
        responses: {
          "200": {
            description: "Detaliile stirii.",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  $ref: "#/components/schemas/NewsDetailItem",
                }),
              },
            },
          },
          "400": {
            description: "ID stire invalid.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "News article not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
        },
      },
      put: {
        tags: ["News"],
        summary: "Update admin news",
        description: "Actualizeaza o stire existenta.",
        operationId: "updateAdminNews",
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [newsIdParameter],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: newsWriteRequestSchema,
            },
          },
        },
        responses: {
          "200": {
            description: "Stirea a fost actualizata.",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  type: "object",
                  required: ["message", "news"],
                  properties: {
                    message: {
                      type: "string",
                    },
                    news: {
                      $ref: "#/components/schemas/NewsAdminItem",
                    },
                  },
                }),
              },
            },
          },
          "400": {
            description: "ID sau payload invalid.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "403": {
            description: "Insufficient permissions",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "News article not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ["News"],
        summary: "Delete admin news",
        description: "Sterge o stire existenta.",
        operationId: "deleteAdminNews",
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [newsIdParameter],
        responses: {
          "200": {
            description: "Stirea a fost stearsa.",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  type: "object",
                  required: ["message", "id"],
                  properties: {
                    message: {
                      type: "string",
                    },
                    id: positiveIntegerSchema,
                  },
                }),
              },
            },
          },
          "400": {
            description: "ID stire invalid.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "403": {
            description: "Insufficient permissions",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "News article not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/news/admin/list": {
      get: {
        tags: ["News"],
        summary: "List admin news",
        description: "Lista administrativa de stiri foloseste keyset pagination.",
        operationId: "listAdminNews",
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "limit",
            in: "query",
            description: "Numar maxim de rezultate. Valori permise: 1-500.",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 500,
              default: 120,
            },
          },
          {
            name: "cursor",
            in: "query",
            description: "Cursor base64url pentru pagina urmatoare.",
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Lista administrativa de stiri.",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/NewsAdminListItem",
                  },
                }),
              },
            },
          },
          "400": {
            description: "Cursor invalid.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "403": {
            description: "Insufficient permissions",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/news/admin/{id}": {
      get: {
        tags: ["News"],
        summary: "Get admin news by ID",
        description: "Returneaza detaliile unei stiri din zona administrativa.",
        operationId: "getAdminNewsById",
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [newsIdParameter],
        responses: {
          "200": {
            description: "Detaliile administrative ale stirii.",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  $ref: "#/components/schemas/NewsAdminItem",
                }),
              },
            },
          },
          "400": {
            description: "ID stire invalid.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "403": {
            description: "Insufficient permissions",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "News article not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/news/media/library": {
      get: {
        tags: ["News Media"],
        summary: "List media library",
        description: "Lista asset-urilor media active pentru stiri.",
        operationId: "listMediaLibrary",
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "limit",
            in: "query",
            description: "Numar maxim de asset-uri returnate. Valori permise: 1-500.",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 500,
              default: 120,
            },
          },
        ],
        responses: {
          "200": {
            description: "Lista asset-urilor media.",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/NewsMediaAsset",
                  },
                }),
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "403": {
            description: "Insufficient permissions",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/news/media/upload": {
      post: {
        tags: ["News Media"],
        summary: "Upload media asset",
        description: "Incarca un asset media pentru folosire in stiri.",
        operationId: "uploadMedia",
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                    description: "Fisierul incarcat.",
                  },
                  kind: {
                    $ref: "#/components/schemas/NewsMediaKind",
                  },
                  title: {
                    type: "string",
                    maxLength: 180,
                  },
                  alt: {
                    type: "string",
                    maxLength: 240,
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Asset-ul media a fost incarcat.",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  type: "object",
                  required: ["message", "asset", "media"],
                  properties: {
                    message: {
                      type: "string",
                    },
                    asset: {
                      $ref: "#/components/schemas/NewsMediaAsset",
                    },
                    media: {
                      $ref: "#/components/schemas/NewsMediaItem",
                    },
                  },
                }),
              },
            },
          },
          "400": {
            description: "Fisier sau payload invalid.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "403": {
            description: "Insufficient permissions",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/news/media/library/{assetId}": {
      delete: {
        tags: ["News Media"],
        summary: "Delete media asset",
        description: "Dezactiveaza un asset media daca nu este folosit in nicio stire.",
        operationId: "deleteMediaAsset",
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [newsMediaAssetIdParameter],
        responses: {
          "200": {
            description: "Asset-ul media a fost dezactivat.",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  type: "object",
                  required: ["message", "id", "publicUrl"],
                  properties: {
                    message: {
                      type: "string",
                    },
                    id: {
                      type: "string",
                    },
                    publicUrl: {
                      type: "string",
                    },
                  },
                }),
              },
            },
          },
          "400": {
            description: "ID media invalid.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "403": {
            description: "Insufficient permissions",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "Media asset not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "409": {
            description: "Media asset is in use",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/auth/signup": {
      post: {
        tags: ["Authentication"],
        summary: "Sign up new user",
        description: "Register a new PCS account using the live signup contract.",
        operationId: "signupUser",
        parameters: [
          {
            name: "X-Rate-Limit-Identifier",
            in: "header",
            description: "Unique identifier for rate limiting (email, IP, etc.)",
            schema: {
              type: "string",
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: authSignupRequestSchema,
            },
          },
        },
        responses: {
          "201": {
            description: "Signup request accepted",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  $ref: "#/components/schemas/AuthSignupAcceptedData",
                }),
              },
            },
          },
          "400": {
            description: "Invalid signup payload",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "429": {
            description: "Too many requests - rate limit exceeded",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/auth/signin": {
      post: {
        tags: ["Authentication"],
        summary: "Sign in user",
        description: "Authenticate user and obtain an access token plus refresh session metadata.",
        operationId: "signinUser",
        parameters: [
          {
            name: "X-Rate-Limit-Identifier",
            in: "header",
            description: "Unique identifier for rate limiting",
            schema: {
              type: "string",
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: authSigninRequestSchema,
            },
          },
        },
        responses: {
          "200": {
            description: "Authentication successful",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  $ref: "#/components/schemas/AuthSessionData",
                }),
              },
            },
          },
          "401": {
            description: "Invalid credentials",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "429": {
            description: "Too many requests - rate limit exceeded",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Authentication"],
        summary: "Refresh access token",
        description: "Rotate the refresh cookie session and issue a new access token.",
        operationId: "refreshToken",
        parameters: [csrfHeaderParameter],
        responses: {
          "200": {
            description: "New access token issued",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  $ref: "#/components/schemas/AuthSessionData",
                }),
              },
            },
          },
          "400": {
            description: "Missing CSRF header",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "403": {
            description: "Invalid CSRF token",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "Refresh flow disabled",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "401": {
            description: "Invalid or expired refresh token",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "429": {
            description: "Too many requests - rate limit exceeded",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/auth/signout": {
      post: {
        tags: ["Authentication"],
        summary: "Sign out user",
        description: "Invalidate the current bearer token and/or refresh-cookie session.",
        operationId: "signoutUser",
        parameters: [optionalCsrfHeaderParameter],
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          "200": {
            description: "User signed out successfully",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  $ref: "#/components/schemas/AuthMessageData",
                }),
              },
            },
          },
          "400": {
            description: "Missing refresh/CSRF context for cookie logout",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "403": {
            description: "Invalid CSRF token",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "401": {
            description: "No active session",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Authentication"],
        summary: "Logout user",
        description: "Alias for signout endpoint",
        operationId: "logoutUser",
        parameters: [optionalCsrfHeaderParameter],
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          "200": {
            description: "User logged out successfully",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  $ref: "#/components/schemas/AuthMessageData",
                }),
              },
            },
          },
          "400": {
            description: "Missing refresh/CSRF context for cookie logout",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "403": {
            description: "Invalid CSRF token",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "401": {
            description: "No active session",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/auth/revoke-all": {
      post: {
        tags: ["Authentication"],
        summary: "Revoke all sessions",
        description: "Invalidate all active sessions for the user",
        operationId: "revokeAllSessions",
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          "200": {
            description: "All sessions revoked successfully",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  $ref: "#/components/schemas/AuthMessageData",
                }),
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/auth/policy": {
      get: {
        tags: ["Authentication"],
        summary: "Get auth token policy",
        description: "Retrieve the effective access-token and refresh-token runtime policy.",
        operationId: "getAuthPolicy",
        responses: {
          "200": {
            description: "Auth policy information",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  $ref: "#/components/schemas/AuthPolicyData",
                }),
              },
            },
          },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Authentication"],
        summary: "Get current user",
        description: "Retrieve authenticated user profile",
        operationId: "getCurrentUser",
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          "200": {
            description: "Current user profile",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  $ref: "#/components/schemas/AuthMeData",
                }),
              },
            },
          },
          "401": {
            description: "Not authenticated",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/volunteers": {
      get: {
        tags: ["Volunteers"],
        summary: "List public volunteers",
        description: "Retrieve list of active volunteers (public data only)",
        operationId: "listPublicVolunteers",
        parameters: [
          {
            name: "limit",
            in: "query",
            description: "Maximum number of public volunteer rows to return.",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 1000,
              default: 300,
            },
          },
        ],
        responses: {
          "200": {
            description: "List of volunteers",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/VolunteerPublicItem",
                  },
                }),
              },
            },
          },
        },
      },
      post: {
        tags: ["Volunteers"],
        summary: "Create volunteer",
        description: "Register as a new volunteer",
        operationId: "createVolunteer",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: volunteerSignupRequestSchema,
            },
          },
        },
        responses: {
          "201": {
            description: "Volunteer registered successfully",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  $ref: "#/components/schemas/VolunteerSignupResponseData",
                }),
              },
            },
          },
          "400": {
            description: "Invalid input",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "409": {
            description: "Volunteer or account already exists",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
          "429": {
            description: "Too many requests - rate limit exceeded",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/volunteers/counties": {
      get: {
        tags: ["Volunteers"],
        summary: "List volunteer counties",
        description: "Get list of all Romanian counties",
        operationId: "listVolunteerCounties",
        responses: {
          "200": {
            description: "List of counties",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  type: "array",
                  items: {
                    type: "string",
                  },
                }),
              },
            },
          },
        },
      },
    },
    "/meta/counties": {
      get: {
        tags: ["Meta"],
        summary: "List counties metadata",
        description: "Get list of counties (same as /volunteers/counties)",
        operationId: "getCountiesMetadata",
        responses: {
          "200": {
            description: "Counties metadata",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  type: "array",
                  items: {
                    type: "string",
                  },
                }),
              },
            },
          },
        },
      },
    },
    "/volunteers/by-county": {
      get: {
        tags: ["Volunteers"],
        summary: "List volunteers by county",
        description: "Group volunteers by county with counts",
        operationId: "listVolunteersByCounty",
        responses: {
          "200": {
            description: "Volunteers grouped by county",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/VolunteerCountyCountItem",
                  },
                }),
              },
            },
          },
        },
      },
    },
    "/mobilization/actions": {
      get: {
        tags: ["Mobilization"],
        summary: "List open mobilization actions",
        operationId: "listMobilizationActions",
        parameters: [],
        responses: {
          "200": {
            description: "Open events, campaigns, volunteer tasks, petitions and consultations",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  type: "array",
                  items: { $ref: "#/components/schemas/MobilizationAction" },
                }),
              },
            },
          },
        },
      },
    },
    "/mobilization/actions/{slug}/responses": {
      post: {
        tags: ["Mobilization"],
        summary: "Respond to a mobilization action",
        operationId: "createMobilizationResponse",
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string", minLength: 3, maxLength: 120 },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/MobilizationResponseInput" },
            },
          },
        },
        responses: {
          "201": {
            description: "Participation response recorded",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  $ref: "#/components/schemas/MobilizationResponseData",
                }),
              },
            },
          },
          "400": {
            description: "Invalid response",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ApiErrorResponse" } } },
          },
          "404": {
            description: "Action unavailable",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ApiErrorResponse" } } },
          },
          "409": {
            description: "Response already exists for this email",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ApiErrorResponse" } } },
          },
          "429": {
            description: "Too many responses",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ApiErrorResponse" } } },
          },
        },
      },
    },
    "/member-portal": {
      get: {
        tags: ["Member Portal"],
        summary: "Read the authenticated member workspace",
        operationId: "getMemberPortal",
        security: [{ BearerAuth: [] }],
        parameters: [],
        responses: {
          "200": { description: "Membership, branch, activities, documents, dues and communication preferences", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccessResponse" } } } },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/member-portal/events/{id}/response": {
      post: {
        tags: ["Member Portal"],
        summary: "Confirm or decline an event invitation owned by the member",
        operationId: "respondToMemberEvent",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: positiveIntegerSchema }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/MemberEventResponseInput" } } } },
        responses: {
          "200": { description: "Response recorded", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccessResponse" } } } },
          "401": { description: "Unauthorized" },
          "403": { description: "Invitation does not belong to the member" },
        },
      },
    },
    "/member-portal/tasks/{id}": {
      patch: {
        tags: ["Member Portal"],
        summary: "Report progress or completion details for an assigned task",
        operationId: "reportMemberTask",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: positiveIntegerSchema }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/MemberTaskReportInput" } } } },
        responses: {
          "200": { description: "Report recorded", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccessResponse" } } } },
          "401": { description: "Unauthorized" },
          "403": { description: "Task does not belong to the member" },
        },
      },
    },
    "/member-portal/consents": {
      patch: {
        tags: ["Member Portal"],
        summary: "Update channel-specific communication consent",
        operationId: "updateMemberCommunicationConsent",
        security: [{ BearerAuth: [] }],
        parameters: [],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/MemberConsentInput" } } } },
        responses: {
          "200": { description: "Preferences updated", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccessResponse" } } } },
          "400": { description: "Invalid preferences" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/admin/access": {
      get: {
        tags: ["Admin Access"],
        summary: "Read effective administrative permissions and territorial scope",
        operationId: "getAdminAccess",
        security: [{ BearerAuth: [] }],
        parameters: [],
        responses: {
          "200": {
            description: "Effective function capabilities and territorial mandate scope",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiSuccessResponse" },
              },
            },
          },
          "401": { description: "Unauthorized" },
          "403": { description: "Missing function permission or active territorial mandate" },
        },
      },
    },
    "/admin/mobilization": {
      get: {
        tags: ["Admin Mobilization"],
        summary: "List territorial events, campaigns and volunteer tasks",
        operationId: "listPoliticalOperations",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "type", in: "query", schema: { type: "string", enum: ["event", "campaign", "volunteer_task"] } },
          { name: "status", in: "query", schema: { type: "string", enum: ["draft", "open", "closed", "archived"] } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
        ],
        responses: {
          "200": { description: "Territorially scoped operations workspace", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccessResponse" } } } },
          "401": { description: "Unauthorized" },
          "403": { description: "Missing mobilization permission or mandate" },
        },
      },
    },
    "/admin/mobilization/actions": {
      post: {
        tags: ["Admin Mobilization"],
        summary: "Create a territorial political operation",
        operationId: "createPoliticalOperation",
        security: [{ BearerAuth: [] }],
        parameters: [],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/PoliticalOperationInput" } } } },
        responses: {
          "201": { description: "Operation created", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccessResponse" } } } },
          "400": { description: "Invalid operation" },
          "403": { description: "Territory outside mandate" },
        },
      },
    },
    "/admin/mobilization/actions/{id}": {
      patch: {
        tags: ["Admin Mobilization"],
        summary: "Update results or lifecycle of an operation",
        operationId: "updatePoliticalOperation",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: positiveIntegerSchema }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/PoliticalOperationUpdateInput" } } } },
        responses: {
          "200": { description: "Operation updated", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccessResponse" } } } },
          "404": { description: "Operation not found in authorized scope" },
          "409": { description: "Optimistic concurrency conflict" },
        },
      },
    },
    "/admin/mobilization/actions/{id}/participants": {
      post: {
        tags: ["Admin Mobilization"],
        summary: "Invite a member or assign a volunteer",
        operationId: "addPoliticalParticipant",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: positiveIntegerSchema }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/PoliticalParticipantInput" } } } },
        responses: {
          "201": { description: "Participant assigned; email is queued only with explicit consent", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccessResponse" } } } },
          "400": { description: "Invalid participant" },
          "403": { description: "Outside authorized territory" },
        },
      },
    },
    "/admin/mobilization/participants/{id}": {
      patch: {
        tags: ["Admin Mobilization"],
        summary: "Record attendance or review activity",
        operationId: "updatePoliticalParticipant",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: positiveIntegerSchema }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/PoliticalParticipantUpdateInput" } } } },
        responses: {
          "200": { description: "Participant updated", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccessResponse" } } } },
          "404": { description: "Participant not found in authorized scope" },
        },
      },
    },
    "/admin/communications/preview": {
      post: {
        tags: ["Admin Communications"],
        summary: "Preview consent-eligible audience as aggregate counts",
        operationId: "previewCommunicationAudience",
        security: [{ BearerAuth: [] }],
        parameters: [],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CommunicationAudienceInput" } } } },
        responses: {
          "200": { description: "Aggregate eligible audience; no personal data returned", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccessResponse" } } } },
          "403": { description: "Audience outside authorized territory" },
        },
      },
    },
    "/admin/communications/dispatches": {
      post: {
        tags: ["Admin Communications"],
        summary: "Create a draft or consent-controlled dispatch",
        operationId: "createCommunicationDispatch",
        security: [{ BearerAuth: [] }],
        parameters: [],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CommunicationDispatchInput" } } } },
        responses: {
          "201": { description: "Dispatch materialized from current explicit consents", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccessResponse" } } } },
          "400": { description: "Invalid or empty audience" },
          "403": { description: "Actual delivery requires national authorization" },
        },
      },
    },
    "/admin/volunteers": {
      get: {
        tags: ["Admin Volunteers"],
        summary: "List all volunteers (admin)",
        description: "Full volunteer list with status and contact info (admin only)",
        operationId: "listAdminVolunteers",
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 300,
              default: 80,
            },
          },
          {
            name: "cursor",
            in: "query",
            description: "Keyset cursor returned by the previous page.",
            schema: {
              type: "string",
            },
          },
          {
            name: "status",
            in: "query",
            description: "Filter by workflow status",
            schema: {
              $ref: "#/components/schemas/VolunteerWorkflowStatus",
            },
          },
          {
            name: "search",
            in: "query",
            description: "Search by volunteer name or email.",
            schema: {
              type: "string",
              maxLength: 220,
            },
          },
          {
            name: "county",
            in: "query",
            description: "Filter by county",
            schema: {
              type: "string",
              maxLength: 120,
            },
          },
          {
            name: "locality",
            in: "query",
            description: "Filter by locality",
            schema: {
              type: "string",
              maxLength: 120,
            },
          },
          {
            name: "skills",
            in: "query",
            description: "Filter by skills text",
            schema: {
              type: "string",
              maxLength: 220,
            },
          },
        ],
        responses: {
          "200": {
            description: "Full volunteer list",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/VolunteerAdminItem",
                  },
                }),
              },
            },
          },
          "401": {
            description: "Unauthorized",
          },
          "403": {
            description: "Insufficient permissions",
          },
        },
      },
    },
    "/admin/volunteers/bulk": {
      delete: {
        tags: ["Admin Volunteers"],
        summary: "Bulk delete volunteers",
        description: "Remove multiple volunteers at once (admin only)",
        operationId: "bulkDeleteAdminVolunteers",
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: volunteerBulkDeleteRequestSchema,
            },
          },
        },
        responses: {
          "200": {
            description: "Volunteers deleted successfully",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  $ref: "#/components/schemas/VolunteerBulkDeleteResponseData",
                }),
              },
            },
          },
          "401": {
            description: "Unauthorized",
          },
          "403": {
            description: "Insufficient permissions",
          },
        },
      },
    },
    "/admin/volunteers/owners": {
      get: {
        tags: ["Admin Volunteers"],
        summary: "List volunteer owners",
        description: "Get list of users managing volunteers (admin only)",
        operationId: "listAdminVolunteerOwners",
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          "200": {
            description: "List of volunteer owners/managers",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/VolunteerOwnerOption",
                  },
                }),
              },
            },
          },
          "401": {
            description: "Unauthorized",
          },
          "403": {
            description: "Insufficient permissions",
          },
        },
      },
    },
    "/admin/volunteers/export.csv": {
      get: {
        tags: ["Admin Volunteers"],
        summary: "Export volunteers as CSV",
        description: "Export full volunteer list in CSV format (admin only)",
        operationId: "exportAdminVolunteersCsv",
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "status",
            in: "query",
            description: "Filter by workflow status",
            schema: {
              $ref: "#/components/schemas/VolunteerWorkflowStatus",
            },
          },
          {
            name: "search",
            in: "query",
            description: "Search by volunteer name or email.",
            schema: {
              type: "string",
              maxLength: 220,
            },
          },
          {
            name: "county",
            in: "query",
            description: "Filter by county",
            schema: {
              type: "string",
              maxLength: 120,
            },
          },
          {
            name: "locality",
            in: "query",
            description: "Filter by locality",
            schema: {
              type: "string",
              maxLength: 120,
            },
          },
          {
            name: "skills",
            in: "query",
            description: "Filter by skills text",
            schema: {
              type: "string",
              maxLength: 220,
            },
          },
        ],
        responses: {
          "200": {
            description: "CSV file with volunteer data",
            content: {
              "text/csv": {
                schema: {
                  type: "string",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
          },
          "403": {
            description: "Insufficient permissions",
          },
        },
      },
    },
    "/admin/volunteers/{id}": {
      get: {
        tags: ["Admin Volunteers"],
        summary: "Get volunteer details",
        description: "Retrieve full volunteer record with history (admin only)",
        operationId: "getAdminVolunteerById",
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: positiveIntegerSchema,
          },
        ],
        responses: {
          "200": {
            description: "Volunteer details",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  $ref: "#/components/schemas/VolunteerAdminItem",
                }),
              },
            },
          },
          "404": {
            description: "Volunteer not found",
          },
          "401": {
            description: "Unauthorized",
          },
          "403": {
            description: "Insufficient permissions",
          },
        },
      },
      delete: {
        tags: ["Admin Volunteers"],
        summary: "Delete volunteer",
        description: "Remove a single volunteer record (admin only)",
        operationId: "deleteAdminVolunteer",
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: positiveIntegerSchema,
          },
        ],
        responses: {
          "200": {
            description: "Volunteer deleted successfully",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  $ref: "#/components/schemas/VolunteerDeleteResponseData",
                }),
              },
            },
          },
          "404": {
            description: "Volunteer not found",
          },
          "401": {
            description: "Unauthorized",
          },
          "403": {
            description: "Insufficient permissions",
          },
        },
      },
    },
    "/admin/volunteers/{id}/workflow": {
      patch: {
        tags: ["Admin Volunteers"],
        summary: "Update volunteer workflow status",
        description: "Change volunteer workflow data using the live admin workflow contract.",
        operationId: "updateAdminVolunteerWorkflow",
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: positiveIntegerSchema,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: volunteerWorkflowUpdateRequestSchema,
            },
          },
        },
        responses: {
          "200": {
            description: "Volunteer status updated",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  $ref: "#/components/schemas/VolunteerWorkflowUpdateResponseData",
                }),
              },
            },
          },
          "404": {
            description: "Volunteer not found",
          },
          "401": {
            description: "Unauthorized",
          },
          "403": {
            description: "Insufficient permissions",
          },
        },
      },
    },
    "/admin/volunteers/workflow/bulk": {
      patch: {
        tags: ["Admin Volunteers"],
        summary: "Bulk update volunteer workflow",
        description: "Update status for multiple volunteers (admin only)",
        operationId: "bulkUpdateAdminVolunteerWorkflow",
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: volunteerBulkWorkflowUpdateRequestSchema,
            },
          },
        },
        responses: {
          "200": {
            description: "Volunteer statuses updated",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  $ref: "#/components/schemas/VolunteerBulkWorkflowUpdateResponseData",
                }),
              },
            },
          },
          "401": {
            description: "Unauthorized",
          },
          "403": {
            description: "Insufficient permissions",
          },
        },
      },
    },
    "/members": {
      get: {
        tags: ["Members"],
        summary: "List members",
        description: "Retrieve organization members list (admin only)",
        operationId: "listMembers",
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "search",
            in: "query",
            schema: {
              type: "string",
              maxLength: 120,
              default: "",
            },
          },
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: [...memberWorkflowStatuses],
            },
          },
          {
            name: "limit",
            in: "query",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 25,
            },
          },
          {
            name: "offset",
            in: "query",
            schema: {
              type: "integer",
              minimum: 0,
              maximum: 5000,
              default: 0,
            },
          },
        ],
        responses: {
          "200": {
            description: "Members list",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/MemberItem",
                  },
                }),
              },
            },
          },
          "401": {
            description: "Unauthorized",
          },
          "403": {
            description: "Insufficient permissions",
          },
        },
      },
    },
    "/organizations": {
      get: {
        tags: ["Organizations"],
        summary: "List organizations",
        description: "Retrieve active party organizations from the territorial registry",
        operationId: "listOrganizations",
        responses: {
          "200": {
            description: "Organizations list",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiSuccessResponse",
                },
              },
            },
          },
        },
      },
    },
    "/admin/organizations": {
      get: {
        tags: ["Territorial Organizations"],
        summary: "List territorial organizations",
        operationId: "listAdminOrganizations",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "search", in: "query", schema: { type: "string", maxLength: 120 } },
          { name: "level", in: "query", schema: { $ref: "#/components/schemas/OrganizationLevel" } },
          { name: "status", in: "query", schema: { $ref: "#/components/schemas/OrganizationStatus" } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, maximum: 10000, default: 0 } },
        ],
        responses: {
          "200": { description: "Territorial registry", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccessResponse" } } } },
          "401": { description: "Unauthorized" },
          "403": { description: "Insufficient permissions" },
        },
      },
      post: {
        tags: ["Territorial Organizations"],
        summary: "Create a real organization or branch",
        operationId: "createAdminOrganization",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/OrganizationWriteInput" } } },
        },
        responses: {
          "201": { description: "Organization created", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccessResponse" } } } },
          "400": { description: "Invalid organization" },
          "403": { description: "Insufficient permissions" },
          "409": { description: "Organization conflict" },
        },
      },
    },
    "/admin/organizations/{id}": {
      get: {
        tags: ["Territorial Organizations"],
        summary: "Get organization, territories, mandates and objectives",
        operationId: "getAdminOrganization",
        security: [{ BearerAuth: [] }],
        parameters: [organizationIdParameter],
        responses: {
          "200": { description: "Organization detail", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccessResponse" } } } },
          "404": { description: "Organization not found" },
        },
      },
      patch: {
        tags: ["Territorial Organizations"],
        summary: "Update organization identity, hierarchy and territories",
        operationId: "updateAdminOrganization",
        security: [{ BearerAuth: [] }],
        parameters: [organizationIdParameter],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/OrganizationPatchInput" } } },
        },
        responses: {
          "200": { description: "Organization updated", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccessResponse" } } } },
          "400": { description: "Invalid organization" },
          "404": { description: "Organization not found" },
          "409": { description: "Organization conflict" },
        },
      },
    },
    "/admin/organizations/{id}/mandates": {
      post: {
        tags: ["Territorial Organizations"],
        summary: "Register a leadership mandate",
        operationId: "createOrganizationMandate",
        security: [{ BearerAuth: [] }],
        parameters: [organizationIdParameter],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/OrganizationMandateInput" } } },
        },
        responses: {
          "201": { description: "Mandate registered", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccessResponse" } } } },
          "400": { description: "Invalid mandate" },
          "404": { description: "Organization not found" },
        },
      },
    },
    "/admin/organizations/{id}/mandates/{childId}": {
      patch: {
        tags: ["Territorial Organizations"],
        summary: "Update or close a leadership mandate",
        operationId: "updateOrganizationMandate",
        security: [{ BearerAuth: [] }],
        parameters: [organizationIdParameter, organizationChildIdParameter],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/OrganizationMandatePatchInput" } } },
        },
        responses: {
          "200": { description: "Mandate updated", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccessResponse" } } } },
          "400": { description: "Invalid mandate" },
          "404": { description: "Mandate not found" },
        },
      },
    },
    "/admin/organizations/{id}/objectives": {
      post: {
        tags: ["Territorial Organizations"],
        summary: "Register an organization objective",
        operationId: "createOrganizationObjective",
        security: [{ BearerAuth: [] }],
        parameters: [organizationIdParameter],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/OrganizationObjectiveInput" } } },
        },
        responses: {
          "201": { description: "Objective registered", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccessResponse" } } } },
          "400": { description: "Invalid objective" },
          "404": { description: "Organization not found" },
        },
      },
    },
    "/admin/organizations/{id}/objectives/{childId}": {
      patch: {
        tags: ["Territorial Organizations"],
        summary: "Update organization objective progress",
        operationId: "updateOrganizationObjective",
        security: [{ BearerAuth: [] }],
        parameters: [organizationIdParameter, organizationChildIdParameter],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/OrganizationObjectivePatchInput" } } },
        },
        responses: {
          "200": { description: "Objective updated", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccessResponse" } } } },
          "400": { description: "Invalid objective" },
          "404": { description: "Objective not found" },
        },
      },
    },
    "/finance": {
      get: {
        tags: ["Finance"],
        summary: "Get finance data",
        description: "Retrieve financial information and reports",
        operationId: "listFinance",
        responses: {
          "200": {
            description: "Finance data",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiSuccessResponse",
                },
              },
            },
          },
        },
      },
    },
    "/elections": {
      get: {
        tags: ["Elections"],
        summary: "Get elections data",
        description: "Retrieve election information and results",
        operationId: "listElections",
        responses: {
          "200": {
            description: "Elections data",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiSuccessResponse",
                },
              },
            },
          },
        },
      },
    },
    "/stats": {
      get: {
        tags: ["Statistics"],
        summary: "Get platform statistics",
        description: "Retrieve aggregated platform statistics",
        operationId: "getStats",
        responses: {
          "200": {
            description: "Platform statistics",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiSuccessResponse",
                },
              },
            },
          },
        },
      },
    },
    "/admin/executive-dashboard": {
      get: {
        tags: ["Executive Dashboard"],
        summary: "Get the executive dashboard",
        description: "Retrieve operational trends, county distribution, conversion, overdue cases, organizations and objectives.",
        operationId: "getExecutiveDashboard",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Executive dashboard data",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  $ref: "#/components/schemas/ExecutiveDashboardData",
                }),
              },
            },
          },
          "401": { description: "Unauthorized" },
          "403": { description: "Insufficient permissions" },
        },
      },
    },
    "/admin/executive-dashboard/targets/{key}": {
      patch: {
        tags: ["Executive Dashboard"],
        summary: "Update an executive target",
        description: "Update an operational target (president and vice-president only).",
        operationId: "updateExecutiveTarget",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "key",
            in: "path",
            required: true,
            schema: {
              type: "string",
              enum: [
                "contact_rate",
                "member_conversion_rate",
                "overdue_cases",
                "active_organizations",
              ],
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ExecutiveTargetUpdateInput",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Executive target updated",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  $ref: "#/components/schemas/ExecutiveTargetUpdateResponseData",
                }),
              },
            },
          },
          "400": { description: "Invalid target" },
          "401": { description: "Unauthorized" },
          "403": { description: "Insufficient permissions" },
          "404": { description: "Target not found" },
        },
      },
    },
    "/admin/members/dashboard": {
      get: {
        tags: ["Admin Members"],
        summary: "Get members dashboard",
        description: "Retrieve admin dashboard for members management (admin only)",
        operationId: "listAdminMembersDashboard",
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "search",
            in: "query",
            schema: {
              type: "string",
              maxLength: 120,
              default: "",
            },
          },
          {
            name: "status",
            in: "query",
            schema: { $ref: "#/components/schemas/MembershipStatus" },
          },
          {
            name: "organizationId",
            in: "query",
            schema: { type: "string", maxLength: 80 },
          },
          {
            name: "limit",
            in: "query",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 25,
            },
          },
          {
            name: "offset",
            in: "query",
            schema: {
              type: "integer",
              minimum: 0,
              maximum: 100000,
              default: 0,
            },
          },
        ],
        responses: {
          "200": {
            description: "Members dashboard data",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  $ref: "#/components/schemas/AdminMembersDashboardData",
                }),
              },
            },
          },
          "401": {
            description: "Unauthorized",
          },
          "403": {
            description: "Insufficient permissions",
          },
        },
      },
    },
    "/admin/members/{id}/actions": {
      post: {
        tags: ["Admin Members"],
        summary: "Apply a membership decision",
        description: "Verify, approve, activate, suspend, reactivate, transfer or terminate a membership with history and audit",
        operationId: "applyMembershipAction",
        security: [{ BearerAuth: [] }],
        parameters: [{
          name: "id",
          in: "path",
          required: true,
          schema: { type: "integer", minimum: 1 },
        }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/MembershipActionInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Membership decision recorded",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  $ref: "#/components/schemas/MembershipActionResponseData",
                }),
              },
            },
          },
          "400": { description: "Invalid decision" },
          "401": { description: "Unauthorized" },
          "403": { description: "Insufficient permissions" },
          "404": { description: "Membership not found" },
          "409": { description: "Invalid or concurrent transition" },
        },
      },
    },
    "/admin/notifications/email-test": {
      post: {
        tags: ["Admin Notifications"],
        summary: "Send test email",
        description: "Send a test email notification (admin only)",
        operationId: "sendAdminEmailTest",
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: adminEmailTestRequestSchema,
            },
          },
        },
        responses: {
          "200": {
            description: "Test email sent successfully",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  $ref: "#/components/schemas/AdminEmailTestResponseData",
                }),
              },
            },
          },
          "400": {
            description: "Invalid email address",
          },
          "401": {
            description: "Unauthorized",
          },
          "403": {
            description: "Insufficient permissions",
          },
        },
      },
    },
    "/admin/audit": {
      get: {
        tags: ["Admin Audit"],
        summary: "List audit logs",
        description: "Retrieve audit trail of administrative actions (admin only)",
        operationId: "listAdminAudit",
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 300,
              default: 80,
            },
          },
          {
            name: "cursor",
            in: "query",
            description: "Keyset cursor for audit pagination.",
            schema: {
              type: "string",
            },
          },
          {
            name: "action",
            in: "query",
            description: "Filter by action type",
            schema: {
              type: "string",
            },
          },
          {
            name: "targetType",
            in: "query",
            description: "Filter by target type",
            schema: {
              type: "string",
            },
          },
          {
            name: "targetId",
            in: "query",
            description: "Filter by target identifier",
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Audit logs",
            content: {
              "application/json": {
                schema: createSuccessResponseSchema({
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/AdminAuditItem",
                  },
                }),
              },
            },
          },
          "401": {
            description: "Unauthorized",
          },
          "403": {
            description: "Insufficient permissions",
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ApiMeta: {
        type: "object",
        required: ["requestId", "timestamp"],
        properties: {
          requestId: {
            type: "string",
            description: "Unique request identifier for tracing",
            example: "550e8400-e29b-41d4-a716-446655440000",
          },
          timestamp: {
            type: "string",
            format: "date-time",
            description: "Server timestamp of response",
            example: "2024-01-15T10:30:45.123Z",
          },
        },
        additionalProperties: true,
      },
      ApiErrorPayload: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: {
            type: "string",
            description: "Error code for programmatic handling",
            example: "INVALID_CREDENTIALS",
          },
          message: {
            type: "string",
            description: "Human-readable error message",
            example: "Email or password is incorrect",
          },
        },
      },
      NewsStatus: {
        type: "string",
        enum: [...newsStatusValues],
      },
      NewsMediaKind: {
        type: "string",
        enum: [...newsMediaKindValues],
      },
      NewsMediaInput: {
        type: "object",
        required: ["assetId", "title", "alt"],
        properties: {
          assetId: positiveIntegerSchema,
          kind: {
            $ref: "#/components/schemas/NewsMediaKind",
          },
          title: {
            type: "string",
            maxLength: 180,
            default: "",
          },
          alt: {
            type: "string",
            maxLength: 240,
            default: "",
          },
        },
        additionalProperties: false,
      },
      NewsMediaItem: {
        type: "object",
        required: ["assetId", "url", "kind", "title", "alt"],
        properties: {
          assetId: {
            type: "string",
          },
          url: {
            type: "string",
          },
          kind: {
            $ref: "#/components/schemas/NewsMediaKind",
          },
          title: {
            type: "string",
          },
          alt: {
            type: "string",
          },
        },
      },
      NewsMediaAsset: {
        type: "object",
        required: [
          "id",
          "publicUrl",
          "originalName",
          "mimeType",
          "sizeBytes",
          "kind",
          "title",
          "alt",
          "createdBy",
          "createdAt",
        ],
        properties: {
          id: {
            type: "string",
          },
          publicUrl: {
            type: "string",
          },
          originalName: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
          sizeBytes: {
            type: "integer",
            minimum: 0,
          },
          kind: {
            $ref: "#/components/schemas/NewsMediaKind",
          },
          title: {
            type: "string",
          },
          alt: {
            type: "string",
          },
          createdBy: {
            type: "string",
            nullable: true,
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      NewsListItem: {
        type: "object",
        required: ["id", "title", "summary", "category", "sourceName", "sourceUrl", "publishedAt", "tags"],
        properties: {
          id: positiveIntegerSchema,
          title: {
            type: "string",
          },
          summary: {
            type: "string",
          },
          category: {
            type: "string",
          },
          sourceName: {
            type: "string",
          },
          sourceUrl: {
            type: "string",
          },
          publishedAt: {
            type: "string",
            format: "date-time",
          },
          tags: {
            type: "array",
            items: {
              type: "string",
            },
          },
        },
      },
      NewsDetailItem: {
        type: "object",
        required: ["id", "title", "summary", "category", "content", "sourceName", "sourceUrl", "publishedAt", "tags", "media"],
        properties: {
          id: positiveIntegerSchema,
          title: {
            type: "string",
          },
          summary: {
            type: "string",
          },
          category: {
            type: "string",
          },
          content: {
            type: "string",
          },
          sourceName: {
            type: "string",
          },
          sourceUrl: {
            type: "string",
          },
          publishedAt: {
            type: "string",
            format: "date-time",
          },
          tags: {
            type: "array",
            items: {
              type: "string",
            },
          },
          media: {
            type: "array",
            items: {
              $ref: "#/components/schemas/NewsMediaItem",
            },
          },
        },
      },
      NewsAdminListItem: {
        type: "object",
        required: ["id", "title", "summary", "category", "sourceName", "sourceUrl", "publishedAt", "tags", "media", "status", "createdAt"],
        properties: {
          id: positiveIntegerSchema,
          title: {
            type: "string",
          },
          summary: {
            type: "string",
          },
          category: {
            type: "string",
          },
          sourceName: {
            type: "string",
          },
          sourceUrl: {
            type: "string",
          },
          publishedAt: {
            type: "string",
            format: "date-time",
          },
          tags: {
            type: "array",
            items: {
              type: "string",
            },
          },
          media: {
            type: "array",
            items: {
              $ref: "#/components/schemas/NewsMediaItem",
            },
          },
          status: {
            $ref: "#/components/schemas/NewsStatus",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      NewsAdminItem: {
        type: "object",
        required: [
          "id",
          "title",
          "summary",
          "category",
          "content",
          "sourceName",
          "sourceUrl",
          "publishedAt",
          "tags",
          "media",
          "status",
          "createdAt",
        ],
        properties: {
          id: positiveIntegerSchema,
          title: {
            type: "string",
          },
          summary: {
            type: "string",
          },
          category: {
            type: "string",
          },
          content: {
            type: "string",
          },
          sourceName: {
            type: "string",
          },
          sourceUrl: {
            type: "string",
          },
          publishedAt: {
            type: "string",
            format: "date-time",
          },
          tags: {
            type: "array",
            items: {
              type: "string",
            },
          },
          media: {
            type: "array",
            items: {
              $ref: "#/components/schemas/NewsMediaItem",
            },
          },
          status: {
            $ref: "#/components/schemas/NewsStatus",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      NewsWriteInput: {
        type: "object",
        required: ["title", "summary", "content"],
        properties: {
          title: {
            type: "string",
            minLength: 3,
            maxLength: 180,
          },
          summary: {
            type: "string",
            minLength: 10,
            maxLength: 320,
          },
          category: {
            type: "string",
            minLength: 2,
            maxLength: 80,
            default: "Comunicat",
          },
          content: {
            type: "string",
            minLength: 10,
            maxLength: 20000,
          },
          sourceName: {
            type: "string",
            maxLength: 160,
          },
          sourceUrl: {
            type: "string",
            maxLength: 1000,
            description: "Link HTTP(S) catre articolul citat. Se completeaza impreuna cu sourceName.",
          },
          publishedAt: {
            type: "string",
            format: "date-time",
            description: "Obligatoriu cand `status=scheduled`.",
          },
          status: {
            allOf: [
              {
                $ref: "#/components/schemas/NewsStatus",
              },
            ],
            default: "published",
          },
          tags: {
            type: "array",
            maxItems: 20,
            items: {
              type: "string",
              minLength: 2,
              maxLength: 40,
            },
            default: [],
          },
          media: {
            type: "array",
            maxItems: 20,
            items: {
              $ref: "#/components/schemas/NewsMediaInput",
            },
            default: [],
          },
        },
        additionalProperties: false,
      },
      UserRole: {
        type: "string",
        enum: [...userRoleValues],
      },
      AuthUser: {
        type: "object",
        required: ["id", "fullName", "email", "role"],
        properties: {
          id: {
            type: "string",
          },
          fullName: {
            type: "string",
          },
          email: {
            type: "string",
            format: "email",
          },
          role: {
            $ref: "#/components/schemas/UserRole",
          },
        },
        additionalProperties: false,
      },
      AuthSignupInput: {
        type: "object",
        required: ["fullName", "email", "password"],
        properties: {
          fullName: {
            type: "string",
            minLength: 2,
            maxLength: 160,
          },
          email: {
            type: "string",
            format: "email",
            maxLength: 180,
          },
          password: {
            type: "string",
            format: "password",
            minLength: 10,
            maxLength: 128,
          },
        },
        additionalProperties: false,
      },
      AuthSigninInput: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            description: "Email complet sau numele de utilizator (partea dinainte de @).",
            minLength: 1,
            maxLength: 180,
            example: "admin",
          },
          password: {
            type: "string",
            format: "password",
            minLength: 1,
            maxLength: 128,
          },
        },
        additionalProperties: false,
      },
      AuthTokenPolicyRefresh: {
        type: "object",
        required: ["enabled", "ttlSeconds", "rotation", "transport", "csrfProtection", "csrfHeader", "cookiePath"],
        properties: {
          enabled: {
            type: "boolean",
          },
          ttlSeconds: {
            type: "integer",
            nullable: true,
          },
          rotation: {
            type: "string",
            enum: ["rotate-on-refresh", "disabled"],
          },
          transport: {
            type: "string",
            enum: ["httpOnly-cookie", "disabled"],
          },
          csrfProtection: {
            type: "string",
            enum: ["double-submit-cookie", "disabled"],
          },
          csrfHeader: {
            type: "string",
            nullable: true,
          },
          cookiePath: {
            type: "string",
            nullable: true,
          },
        },
        additionalProperties: false,
      },
      AuthTokenPolicy: {
        type: "object",
        required: ["accessTokenTtlSeconds", "refreshToken"],
        properties: {
          accessTokenTtlSeconds: {
            type: "integer",
            minimum: 1,
          },
          refreshToken: {
            $ref: "#/components/schemas/AuthTokenPolicyRefresh",
          },
        },
        additionalProperties: false,
      },
      AuthPolicyData: {
        type: "object",
        required: ["tokenPolicy"],
        properties: {
          tokenPolicy: {
            $ref: "#/components/schemas/AuthTokenPolicy",
          },
        },
        additionalProperties: false,
      },
      AuthMessageData: {
        type: "object",
        required: ["message"],
        properties: {
          message: {
            type: "string",
          },
        },
        additionalProperties: false,
      },
      AuthSignupAcceptedData: {
        type: "object",
        required: ["message", "signupAccepted", "nextStep"],
        properties: {
          message: {
            type: "string",
          },
          signupAccepted: {
            type: "boolean",
            enum: [true],
          },
          nextStep: {
            type: "string",
            enum: ["signin"],
          },
        },
        additionalProperties: false,
      },
      AuthSessionData: {
        type: "object",
        required: [
          "message",
          "token",
          "tokenType",
          "expiresInSeconds",
          "accessTokenExpiresAt",
          "tokenPolicy",
          "user",
        ],
        properties: {
          message: {
            type: "string",
          },
          token: {
            type: "string",
          },
          tokenType: {
            type: "string",
            enum: ["Bearer"],
          },
          expiresInSeconds: {
            type: "integer",
            minimum: 1,
          },
          accessTokenExpiresAt: {
            type: "string",
            format: "date-time",
          },
          csrfToken: {
            type: "string",
          },
          refreshExpiresInSeconds: {
            type: "integer",
            minimum: 1,
          },
          refreshTokenExpiresAt: {
            type: "string",
            format: "date-time",
          },
          tokenPolicy: {
            $ref: "#/components/schemas/AuthTokenPolicy",
          },
          user: {
            $ref: "#/components/schemas/AuthUser",
          },
        },
        additionalProperties: false,
      },
      AuthMeData: {
        type: "object",
        required: ["user"],
        properties: {
          user: {
            $ref: "#/components/schemas/AuthUser",
          },
        },
        additionalProperties: false,
      },
      VolunteerWorkflowStatus: {
        type: "string",
        enum: [...volunteerStatusValues],
      },
      VolunteerContactChannel: {
        type: "string",
        enum: [...volunteerContactChannelValues],
      },
      VolunteerPriority: {
        type: "string",
        enum: [...volunteerPriorityValues],
      },
      VolunteerPublicRole: {
        type: "string",
        enum: [...userRoleValues, "FARA_CONT"],
      },
      VolunteerPublicItem: {
        type: "object",
        required: ["id", "fullName", "email", "password", "status", "role"],
        properties: {
          id: {
            type: "string",
          },
          fullName: {
            type: "string",
          },
          email: {
            type: "string",
            format: "email",
          },
          password: {
            type: "string",
            enum: ["protejata", "nesetata"],
          },
          status: {
            $ref: "#/components/schemas/VolunteerWorkflowStatus",
          },
          role: {
            $ref: "#/components/schemas/VolunteerPublicRole",
          },
        },
        additionalProperties: false,
      },
      VolunteerCountyCountItem: {
        type: "object",
        required: ["county", "count"],
        properties: {
          county: {
            type: "string",
          },
          count: {
            type: "integer",
            minimum: 0,
          },
        },
        additionalProperties: false,
      },
      VolunteerSignupInput: {
        type: "object",
        required: ["fullName", "email", "password", "county", "locality", "motivation"],
        properties: {
          fullName: {
            type: "string",
            minLength: 2,
            maxLength: 160,
          },
          email: {
            type: "string",
            format: "email",
            maxLength: 180,
          },
          password: {
            type: "string",
            format: "password",
            minLength: 10,
            maxLength: 128,
          },
          phone: {
            type: "string",
            maxLength: 40,
            default: "",
          },
          county: {
            type: "string",
            minLength: 2,
            maxLength: 120,
          },
          locality: {
            type: "string",
            minLength: 2,
            maxLength: 120,
          },
          skills: {
            type: "string",
            maxLength: 220,
            default: "",
          },
          motivation: {
            type: "string",
            minLength: 10,
            maxLength: 1500,
          },
          captchaToken: {
            type: "string",
            maxLength: 4096,
            default: "",
          },
          website: {
            type: "string",
            maxLength: 2048,
            default: "",
          },
        },
        additionalProperties: false,
      },
      VolunteerSignupResponseData: {
        type: "object",
        required: ["message", "id"],
        properties: {
          message: {
            type: "string",
          },
          id: positiveIntegerSchema,
        },
        additionalProperties: false,
      },
      MobilizationAction: {
        type: "object",
        required: [
          "id", "slug", "type", "title", "summary", "description", "scope", "county", "locality",
          "startsAt", "endsAt", "participationMode", "commitment", "capacity", "responseCount",
        ],
        properties: {
          id: { type: "string" },
          slug: { type: "string" },
          type: { type: "string", enum: ["event", "campaign", "volunteer_task", "petition", "consultation"] },
          title: { type: "string" },
          summary: { type: "string" },
          description: { type: "string" },
          scope: { type: "string", enum: ["national", "local", "online"] },
          county: { type: "string" },
          locality: { type: "string" },
          startsAt: { type: "string", format: "date-time", nullable: true },
          endsAt: { type: "string", format: "date-time", nullable: true },
          participationMode: { type: "string" },
          commitment: { type: "string" },
          capacity: { type: "integer", minimum: 1, nullable: true },
          responseCount: { type: "integer", minimum: 0 },
        },
        additionalProperties: false,
      },
      MobilizationResponseInput: {
        type: "object",
        required: ["fullName", "email", "county", "interests", "privacyConsent"],
        properties: {
          fullName: { type: "string", minLength: 2, maxLength: 160 },
          email: { type: "string", format: "email", maxLength: 180 },
          phone: { type: "string", maxLength: 40, default: "" },
          county: { type: "string", minLength: 2, maxLength: 120 },
          locality: { type: "string", maxLength: 120, default: "" },
          interests: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            items: {
              type: "string",
              enum: ["pensii", "sanatate", "servicii_locale", "combaterea_izolarii", "comunicare", "organizare"],
            },
          },
          availability: {
            type: "string",
            enum: ["", "dimineata", "dupa_amiaza", "seara", "weekend", "flexibil"],
            default: "",
          },
          message: { type: "string", maxLength: 1200, default: "" },
          updatesConsent: { type: "boolean", default: false },
          emailConsent: { type: "boolean", default: false },
          smsConsent: { type: "boolean", default: false },
          whatsappConsent: { type: "boolean", default: false },
          consentVersion: { type: "string", enum: ["mobilizare-v2"], default: "mobilizare-v2" },
          privacyConsent: { type: "boolean", enum: [true] },
          website: { type: "string", maxLength: 2048, default: "" },
        },
        additionalProperties: false,
      },
      MobilizationResponseData: {
        type: "object",
        required: ["accepted", "id"],
        properties: {
          accepted: { type: "boolean" },
          id: { type: "string", nullable: true },
        },
        additionalProperties: false,
      },
      MemberEventResponseInput: {
        type: "object",
        required: ["response"],
        properties: {
          response: { type: "string", enum: ["confirmed", "declined"] },
        },
        additionalProperties: false,
      },
      MemberTaskReportInput: {
        type: "object",
        required: ["status", "report", "hours"],
        properties: {
          status: { type: "string", enum: ["in_progress", "reported"] },
          report: { type: "string", minLength: 5, maxLength: 5000 },
          result: { type: "string", maxLength: 2000, default: "" },
          hours: { type: "number", minimum: 0, maximum: 10000 },
        },
        additionalProperties: false,
      },
      MemberConsentInput: {
        type: "object",
        required: ["emailConsent", "smsConsent", "whatsappConsent"],
        properties: {
          emailConsent: { type: "boolean" },
          smsConsent: { type: "boolean" },
          whatsappConsent: { type: "boolean" },
          phone: { type: "string", maxLength: 40, default: "" },
          interests: {
            type: "array",
            maxItems: 6,
            default: [],
            items: { type: "string", enum: ["pensii", "sanatate", "servicii_locale", "combaterea_izolarii", "comunicare", "organizare"] },
          },
          consentVersion: { type: "string", enum: ["portal-membru-v1"], default: "portal-membru-v1" },
        },
        additionalProperties: false,
      },
      PoliticalOperationInput: {
        type: "object",
        required: ["type", "title", "summary", "objective"],
        properties: {
          type: { type: "string", enum: ["event", "campaign", "volunteer_task"] },
          title: { type: "string", minLength: 3, maxLength: 180 },
          summary: { type: "string", minLength: 10, maxLength: 360 },
          description: { type: "string", maxLength: 5000, default: "" },
          objective: { type: "string", minLength: 5, maxLength: 2000 },
          status: { type: "string", enum: ["draft", "open", "closed", "archived"], default: "draft" },
          visibility: { type: "string", enum: ["public", "members", "internal"], default: "members" },
          organizationId: { type: "string", maxLength: 80, nullable: true },
          coordinatorUserId: { type: "string", pattern: "^[1-9]\\d*$", nullable: true },
          countyIds: { type: "array", maxItems: 42, default: [], items: positiveIntegerSchema },
          startsAt: { type: "string", format: "date-time", nullable: true },
          endsAt: { type: "string", format: "date-time", nullable: true },
          participationMode: { type: "string", maxLength: 120, default: "" },
          commitment: { type: "string", maxLength: 220, default: "" },
          capacity: { type: "integer", minimum: 1, maximum: 1000000, nullable: true },
          targetMetric: { type: "string", maxLength: 120, default: "" },
          targetValue: { type: "number", minimum: 0, maximum: 1000000000, nullable: true },
        },
        additionalProperties: false,
      },
      PoliticalOperationUpdateInput: {
        type: "object",
        required: ["expectedVersion"],
        properties: {
          status: { type: "string", enum: ["draft", "open", "closed", "archived"] },
          resultValue: { type: "number", minimum: 0, maximum: 1000000000, nullable: true },
          resultSummary: { type: "string", maxLength: 5000 },
          expectedVersion: positiveIntegerSchema,
        },
        additionalProperties: false,
      },
      PoliticalParticipantInput: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email", maxLength: 180 },
          dueAt: { type: "string", format: "date-time", nullable: true },
          notes: { type: "string", maxLength: 1200, default: "" },
        },
        additionalProperties: false,
      },
      PoliticalParticipantUpdateInput: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["invited", "confirmed", "declined", "active", "in_progress", "reported", "completed", "cancelled"] },
          attendanceStatus: { type: "string", enum: ["not_applicable", "pending", "present", "absent", "excused"] },
          report: { type: "string", maxLength: 5000 },
          result: { type: "string", maxLength: 3000 },
          hours: { type: "number", minimum: 0, maximum: 10000 },
        },
        additionalProperties: false,
      },
      CommunicationAudienceInput: {
        type: "object",
        required: ["channel"],
        properties: {
          channel: { type: "string", enum: ["email", "sms", "whatsapp"] },
          organizationId: { type: "string", maxLength: 80, nullable: true },
          countyIds: { type: "array", maxItems: 42, default: [], items: positiveIntegerSchema },
          roles: { type: "array", maxItems: 7, default: [], items: { $ref: "#/components/schemas/UserRole" } },
          interests: { type: "array", maxItems: 6, default: [], items: { type: "string", enum: ["pensii", "sanatate", "servicii_locale", "combaterea_izolarii", "comunicare", "organizare"] } },
        },
        additionalProperties: false,
      },
      CommunicationDispatchInput: {
        type: "object",
        required: ["channel", "title", "message"],
        properties: {
          channel: { type: "string", enum: ["email", "sms", "whatsapp"] },
          organizationId: { type: "string", maxLength: 80, nullable: true },
          countyIds: { type: "array", maxItems: 42, default: [], items: positiveIntegerSchema },
          roles: { type: "array", maxItems: 7, default: [], items: { $ref: "#/components/schemas/UserRole" } },
          interests: { type: "array", maxItems: 6, default: [], items: { type: "string", enum: ["pensii", "sanatate", "servicii_locale", "combaterea_izolarii", "comunicare", "organizare"] } },
          title: { type: "string", minLength: 3, maxLength: 180 },
          message: { type: "string", minLength: 10, maxLength: 10000 },
          mode: { type: "string", enum: ["draft", "send"], default: "draft" },
          confirmConsentSelection: { type: "boolean", default: false },
        },
        additionalProperties: false,
      },
      VolunteerAdminRecordSource: {
        type: "string",
        enum: ["volunteer", "user", "both"],
      },
      VolunteerAdminItem: {
        type: "object",
        required: [
          "id",
          "volunteerId",
          "fullName",
          "email",
          "phone",
          "county",
          "locality",
          "skills",
          "motivation",
          "workflowStatus",
          "internalNotes",
          "createdAt",
          "statusUpdatedAt",
          "statusUpdatedByUserId",
          "statusUpdatedByName",
          "statusUpdatedByEmail",
          "ownerUserId",
          "ownerName",
          "ownerEmail",
          "ownerRole",
          "followUpAt",
          "reminderAt",
          "lastContactAt",
          "contactChannel",
          "priority",
          "rejectionReason",
          "tags",
          "skillTags",
          "accountRole",
          "recordSource",
        ],
        properties: {
          id: positiveIntegerSchema,
          volunteerId: {
            type: "integer",
            minimum: 1,
            nullable: true,
          },
          fullName: {
            type: "string",
          },
          email: {
            type: "string",
            format: "email",
          },
          phone: {
            type: "string",
          },
          county: {
            type: "string",
          },
          locality: {
            type: "string",
          },
          skills: {
            type: "string",
          },
          motivation: {
            type: "string",
          },
          workflowStatus: {
            $ref: "#/components/schemas/VolunteerWorkflowStatus",
          },
          internalNotes: {
            type: "string",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
          statusUpdatedAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          statusUpdatedByUserId: {
            type: "string",
            nullable: true,
          },
          statusUpdatedByName: {
            type: "string",
            nullable: true,
          },
          statusUpdatedByEmail: {
            type: "string",
            nullable: true,
          },
          ownerUserId: {
            type: "string",
            nullable: true,
          },
          ownerName: {
            type: "string",
            nullable: true,
          },
          ownerEmail: {
            type: "string",
            nullable: true,
          },
          ownerRole: {
            allOf: [
              {
                $ref: "#/components/schemas/UserRole",
              },
            ],
            nullable: true,
          },
          followUpAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          reminderAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          lastContactAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          contactChannel: {
            allOf: [
              {
                $ref: "#/components/schemas/VolunteerContactChannel",
              },
            ],
            nullable: true,
          },
          priority: {
            allOf: [
              {
                $ref: "#/components/schemas/VolunteerPriority",
              },
            ],
            nullable: true,
          },
          rejectionReason: {
            type: "string",
            nullable: true,
          },
          tags: {
            type: "array",
            items: {
              type: "string",
            },
          },
          skillTags: {
            type: "array",
            items: {
              type: "string",
            },
          },
          accountRole: {
            allOf: [
              {
                $ref: "#/components/schemas/UserRole",
              },
            ],
            nullable: true,
          },
          recordSource: {
            $ref: "#/components/schemas/VolunteerAdminRecordSource",
          },
        },
        additionalProperties: false,
      },
      VolunteerOwnerOption: {
        type: "object",
        required: ["id", "fullName", "email", "role"],
        properties: {
          id: {
            type: "string",
          },
          fullName: {
            type: "string",
          },
          email: {
            type: "string",
            format: "email",
          },
          role: {
            $ref: "#/components/schemas/UserRole",
          },
        },
        additionalProperties: false,
      },
      VolunteerWorkflowUpdateInput: {
        type: "object",
        required: ["status"],
        properties: {
          fullName: {
            type: "string",
            minLength: 2,
            maxLength: 160,
          },
          email: {
            type: "string",
            format: "email",
            maxLength: 180,
          },
          phone: {
            type: "string",
            maxLength: 40,
          },
          motivation: {
            type: "string",
            minLength: 10,
            maxLength: 1500,
          },
          status: {
            $ref: "#/components/schemas/VolunteerWorkflowStatus",
          },
          internalNotes: {
            type: "string",
            maxLength: 5000,
            default: "",
          },
          county: {
            type: "string",
            minLength: 2,
            maxLength: 120,
          },
          locality: {
            type: "string",
            minLength: 2,
            maxLength: 120,
          },
          skills: {
            type: "string",
            maxLength: 220,
          },
          ownerUserId: {
            type: "integer",
            minimum: 1,
            nullable: true,
          },
          followUpAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          reminderAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          lastContactAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          contactChannel: {
            allOf: [
              {
                $ref: "#/components/schemas/VolunteerContactChannel",
              },
            ],
            nullable: true,
          },
          priority: {
            $ref: "#/components/schemas/VolunteerPriority",
          },
          rejectionReason: {
            type: "string",
            maxLength: 2000,
          },
          tags: {
            type: "array",
            maxItems: 12,
            items: {
              type: "string",
              minLength: 1,
              maxLength: 40,
            },
          },
          skillTags: {
            type: "array",
            maxItems: 16,
            items: {
              type: "string",
              minLength: 1,
              maxLength: 40,
            },
          },
        },
        additionalProperties: false,
      },
      VolunteerBulkTargetFilters: {
        type: "object",
        properties: {
          status: {
            $ref: "#/components/schemas/VolunteerWorkflowStatus",
          },
          search: {
            type: "string",
            maxLength: 220,
          },
          county: {
            type: "string",
            maxLength: 120,
          },
          locality: {
            type: "string",
            maxLength: 120,
          },
          skills: {
            type: "string",
            maxLength: 220,
          },
        },
        additionalProperties: false,
      },
      VolunteerBulkTargetIds: {
        type: "object",
        required: ["type", "volunteerIds"],
        properties: {
          type: {
            type: "string",
            enum: ["ids"],
          },
          volunteerIds: {
            type: "array",
            minItems: 1,
            maxItems: 100,
            items: positiveIntegerSchema,
          },
        },
        additionalProperties: false,
      },
      VolunteerBulkTargetByFilters: {
        type: "object",
        required: ["type", "filters"],
        properties: {
          type: {
            type: "string",
            enum: ["filters"],
          },
          filters: {
            $ref: "#/components/schemas/VolunteerBulkTargetFilters",
          },
        },
        additionalProperties: false,
      },
      VolunteerBulkTarget: {
        oneOf: [
          {
            $ref: "#/components/schemas/VolunteerBulkTargetIds",
          },
          {
            $ref: "#/components/schemas/VolunteerBulkTargetByFilters",
          },
        ],
      },
      VolunteerBulkWorkflowUpdateInput: {
        type: "object",
        required: ["status", "target"],
        properties: {
          status: {
            $ref: "#/components/schemas/VolunteerWorkflowStatus",
          },
          target: {
            $ref: "#/components/schemas/VolunteerBulkTarget",
          },
        },
        additionalProperties: false,
      },
      VolunteerBulkDeleteInput: {
        type: "object",
        required: ["target"],
        properties: {
          target: {
            $ref: "#/components/schemas/VolunteerBulkTarget",
          },
        },
        additionalProperties: false,
      },
      VolunteerWorkflowUpdateResponseData: {
        type: "object",
        required: ["message", "volunteer"],
        properties: {
          message: {
            type: "string",
          },
          volunteer: {
            $ref: "#/components/schemas/VolunteerAdminItem",
          },
        },
        additionalProperties: false,
      },
      VolunteerBulkWorkflowUpdateResponseData: {
        type: "object",
        required: [
          "message",
          "updatedCount",
          "skippedCount",
          "missingCount",
          "updatedVolunteerIds",
          "skippedVolunteerIds",
          "missingVolunteerIds",
        ],
        properties: {
          message: {
            type: "string",
          },
          updatedCount: {
            type: "integer",
            minimum: 0,
          },
          skippedCount: {
            type: "integer",
            minimum: 0,
          },
          missingCount: {
            type: "integer",
            minimum: 0,
          },
          updatedVolunteerIds: {
            type: "array",
            items: positiveIntegerSchema,
          },
          skippedVolunteerIds: {
            type: "array",
            items: positiveIntegerSchema,
          },
          missingVolunteerIds: {
            type: "array",
            items: positiveIntegerSchema,
          },
        },
        additionalProperties: false,
      },
      VolunteerBulkDeleteResponseData: {
        type: "object",
        required: ["message", "deletedCount", "missingCount", "deletedVolunteerIds", "missingVolunteerIds"],
        properties: {
          message: {
            type: "string",
          },
          deletedCount: {
            type: "integer",
            minimum: 0,
          },
          missingCount: {
            type: "integer",
            minimum: 0,
          },
          deletedVolunteerIds: {
            type: "array",
            items: positiveIntegerSchema,
          },
          missingVolunteerIds: {
            type: "array",
            items: positiveIntegerSchema,
          },
        },
        additionalProperties: false,
      },
      VolunteerDeleteResponseData: {
        type: "object",
        required: ["message", "id"],
        properties: {
          message: {
            type: "string",
          },
          id: positiveIntegerSchema,
        },
        additionalProperties: false,
      },
      MemberItem: {
        type: "object",
        required: ["id", "fullName", "email", "county", "locality", "status", "role", "createdAt"],
        properties: {
          id: {
            type: "string",
          },
          fullName: {
            type: "string",
          },
          email: {
            type: "string",
            format: "email",
          },
          county: {
            type: "string",
          },
          locality: {
            type: "string",
          },
          status: {
            type: "string",
            enum: [...memberWorkflowStatuses],
          },
          role: {
            $ref: "#/components/schemas/UserRole",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
        },
        additionalProperties: false,
      },
      OrganizationLevel: {
        type: "string",
        enum: ["national", "county", "local"],
      },
      OrganizationStatus: {
        type: "string",
        enum: ["forming", "active", "inactive", "dissolved"],
      },
      OrganizationTerritoryInput: {
        type: "object",
        required: ["type"],
        properties: {
          type: { type: "string", enum: ["national", "county", "locality"] },
          countyId: { type: "integer", minimum: 1, nullable: true },
          locality: { type: "string", maxLength: 160, default: "" },
        },
        additionalProperties: false,
      },
      OrganizationWriteInput: {
        type: "object",
        required: ["code", "name", "level", "status", "territories"],
        properties: {
          code: { type: "string", minLength: 2, maxLength: 80 },
          name: { type: "string", minLength: 3, maxLength: 180 },
          level: { $ref: "#/components/schemas/OrganizationLevel" },
          status: { $ref: "#/components/schemas/OrganizationStatus" },
          parentId: { type: "string", maxLength: 80, nullable: true },
          membersCount: { type: "integer", minimum: 0, default: 0 },
          officialEmail: { type: "string", format: "email", maxLength: 180 },
          phone: { type: "string", maxLength: 40 },
          headquarters: { type: "string", maxLength: 260 },
          foundedAt: { type: "string", format: "date", nullable: true },
          territories: {
            type: "array",
            minItems: 1,
            maxItems: 50,
            items: { $ref: "#/components/schemas/OrganizationTerritoryInput" },
          },
        },
        additionalProperties: false,
      },
      OrganizationPatchInput: {
        type: "object",
        minProperties: 1,
        properties: {
          code: { type: "string", minLength: 2, maxLength: 80 },
          name: { type: "string", minLength: 3, maxLength: 180 },
          level: { $ref: "#/components/schemas/OrganizationLevel" },
          status: { $ref: "#/components/schemas/OrganizationStatus" },
          parentId: { type: "string", maxLength: 80, nullable: true },
          membersCount: { type: "integer", minimum: 0 },
          officialEmail: { type: "string", format: "email", maxLength: 180 },
          phone: { type: "string", maxLength: 40 },
          headquarters: { type: "string", maxLength: 260 },
          foundedAt: { type: "string", format: "date", nullable: true },
          territories: {
            type: "array",
            minItems: 1,
            maxItems: 50,
            items: { $ref: "#/components/schemas/OrganizationTerritoryInput" },
          },
        },
        additionalProperties: false,
      },
      OrganizationMandateInput: {
        type: "object",
        required: ["fullName", "positionTitle", "startedAt"],
        properties: {
          userId: { type: "integer", minimum: 1, nullable: true },
          fullName: { type: "string", minLength: 3, maxLength: 160 },
          positionTitle: { type: "string", minLength: 2, maxLength: 120 },
          startedAt: { type: "string", format: "date" },
          endedAt: { type: "string", format: "date", nullable: true },
          status: { type: "string", enum: ["planned", "active", "completed", "suspended"], default: "active" },
        },
        additionalProperties: false,
      },
      OrganizationMandatePatchInput: {
        type: "object",
        minProperties: 1,
        properties: {
          userId: { type: "integer", minimum: 1, nullable: true },
          fullName: { type: "string", minLength: 3, maxLength: 160 },
          positionTitle: { type: "string", minLength: 2, maxLength: 120 },
          startedAt: { type: "string", format: "date" },
          endedAt: { type: "string", format: "date", nullable: true },
          status: { type: "string", enum: ["planned", "active", "completed", "suspended"] },
        },
        additionalProperties: false,
      },
      OrganizationObjectiveInput: {
        type: "object",
        required: ["title", "targetValue", "dueDate"],
        properties: {
          title: { type: "string", minLength: 3, maxLength: 180 },
          description: { type: "string", maxLength: 3000 },
          metricName: { type: "string", maxLength: 120 },
          targetValue: { type: "number", minimum: 0 },
          currentValue: { type: "number", minimum: 0, default: 0 },
          unit: { type: "string", minLength: 1, maxLength: 40, default: "număr" },
          dueDate: { type: "string", format: "date" },
          status: { type: "string", enum: ["planned", "in_progress", "achieved", "at_risk", "cancelled"], default: "planned" },
        },
        additionalProperties: false,
      },
      OrganizationObjectivePatchInput: {
        type: "object",
        minProperties: 1,
        properties: {
          title: { type: "string", minLength: 3, maxLength: 180 },
          description: { type: "string", maxLength: 3000 },
          metricName: { type: "string", maxLength: 120 },
          targetValue: { type: "number", minimum: 0 },
          currentValue: { type: "number", minimum: 0 },
          unit: { type: "string", minLength: 1, maxLength: 40 },
          dueDate: { type: "string", format: "date" },
          status: { type: "string", enum: ["planned", "in_progress", "achieved", "at_risk", "cancelled"] },
        },
        additionalProperties: false,
      },
      ExecutiveDashboardSummary: {
        type: "object",
        required: [
          "applicationsTotal",
          "applicationsLast30Days",
          "contactedTotal",
          "uncontactedCases",
          "membersTotal",
          "contactRate",
          "memberConversionRate",
          "overdueCases",
          "activeOrganizations",
          "countiesWithoutResponsible",
        ],
        properties: {
          applicationsTotal: { type: "integer", minimum: 0 },
          applicationsLast30Days: { type: "integer", minimum: 0 },
          contactedTotal: { type: "integer", minimum: 0 },
          uncontactedCases: { type: "integer", minimum: 0 },
          membersTotal: { type: "integer", minimum: 0 },
          contactRate: { type: "number", minimum: 0, maximum: 100 },
          memberConversionRate: { type: "number", minimum: 0, maximum: 100 },
          overdueCases: { type: "integer", minimum: 0 },
          activeOrganizations: { type: "integer", minimum: 0 },
          countiesWithoutResponsible: { type: "integer", minimum: 0 },
        },
        additionalProperties: false,
      },
      ExecutiveDashboardTrend: {
        type: "object",
        required: ["month", "applications", "contacted", "members"],
        properties: {
          month: { type: "string", format: "date" },
          applications: { type: "integer", minimum: 0 },
          contacted: { type: "integer", minimum: 0 },
          members: { type: "integer", minimum: 0 },
        },
        additionalProperties: false,
      },
      ExecutiveDashboardCounty: {
        type: "object",
        required: ["county", "applications", "contacted", "members", "organizers", "overdue", "hasResponsible"],
        properties: {
          county: { type: "string" },
          applications: { type: "integer", minimum: 0 },
          contacted: { type: "integer", minimum: 0 },
          members: { type: "integer", minimum: 0 },
          organizers: { type: "integer", minimum: 0 },
          overdue: { type: "integer", minimum: 0 },
          hasResponsible: { type: "boolean" },
        },
        additionalProperties: false,
      },
      ExecutiveDashboardWorkflow: {
        type: "object",
        required: ["status", "count"],
        properties: {
          status: { $ref: "#/components/schemas/VolunteerWorkflowStatus" },
          count: { type: "integer", minimum: 0 },
        },
        additionalProperties: false,
      },
      ExecutiveDashboardObjective: {
        type: "object",
        required: [
          "key",
          "label",
          "targetValue",
          "currentValue",
          "unit",
          "direction",
          "status",
          "progressPercent",
          "updatedAt",
        ],
        properties: {
          key: {
            type: "string",
            enum: ["contact_rate", "member_conversion_rate", "overdue_cases", "active_organizations"],
          },
          label: { type: "string" },
          targetValue: { type: "number", minimum: 0 },
          currentValue: { type: "number", minimum: 0 },
          unit: { type: "string", enum: ["percent", "count"] },
          direction: { type: "string", enum: ["at_least", "at_most"] },
          status: { type: "string", enum: ["achieved", "on_track", "at_risk"] },
          progressPercent: { type: "number", minimum: 0, maximum: 100 },
          updatedAt: { type: "string", format: "date-time" },
        },
        additionalProperties: false,
      },
      ExecutiveDashboardDefinitions: {
        type: "object",
        required: ["contactRate", "memberConversionRate", "overdueCases", "activeOrganizations", "uncontactedCases", "countiesWithoutResponsible", "trends"],
        properties: {
          contactRate: { type: "string" },
          memberConversionRate: { type: "string" },
          overdueCases: { type: "string" },
          activeOrganizations: { type: "string" },
          uncontactedCases: { type: "string" },
          countiesWithoutResponsible: { type: "string" },
          trends: { type: "string" },
        },
        additionalProperties: false,
      },
      ExecutiveDashboardData: {
        type: "object",
        required: ["generatedAt", "summary", "trends", "counties", "workflow", "objectives", "countiesWithoutResponsible", "definitions"],
        properties: {
          generatedAt: { type: "string", format: "date-time" },
          summary: { $ref: "#/components/schemas/ExecutiveDashboardSummary" },
          trends: {
            type: "array",
            items: { $ref: "#/components/schemas/ExecutiveDashboardTrend" },
          },
          counties: {
            type: "array",
            items: { $ref: "#/components/schemas/ExecutiveDashboardCounty" },
          },
          workflow: {
            type: "array",
            items: { $ref: "#/components/schemas/ExecutiveDashboardWorkflow" },
          },
          countiesWithoutResponsible: {
            type: "array",
            items: { type: "string" },
          },
          objectives: {
            type: "array",
            items: { $ref: "#/components/schemas/ExecutiveDashboardObjective" },
          },
          definitions: { $ref: "#/components/schemas/ExecutiveDashboardDefinitions" },
        },
        additionalProperties: false,
      },
      ExecutiveTargetUpdateInput: {
        type: "object",
        required: ["targetValue"],
        properties: {
          targetValue: { type: "number", minimum: 0, maximum: 100000 },
        },
        additionalProperties: false,
      },
      ExecutiveTarget: {
        type: "object",
        required: ["key", "label", "targetValue", "unit", "direction", "updatedAt"],
        properties: {
          key: {
            type: "string",
            enum: ["contact_rate", "member_conversion_rate", "overdue_cases", "active_organizations"],
          },
          label: { type: "string" },
          targetValue: { type: "number", minimum: 0 },
          unit: { type: "string", enum: ["percent", "count"] },
          direction: { type: "string", enum: ["at_least", "at_most"] },
          updatedAt: { type: "string", format: "date-time" },
        },
        additionalProperties: false,
      },
      ExecutiveTargetUpdateResponseData: {
        type: "object",
        required: ["message", "target"],
        properties: {
          message: { type: "string" },
          target: { $ref: "#/components/schemas/ExecutiveTarget" },
        },
        additionalProperties: false,
      },
      MembershipStatus: {
        type: "string",
        enum: ["supporter", "application", "verified", "approved", "active", "suspended", "terminated"],
      },
      MembershipAction: {
        type: "string",
        enum: ["verify", "approve", "activate", "suspend", "reactivate", "transfer", "terminate"],
      },
      MembershipOrganization: {
        type: "object",
        required: ["id", "code", "name", "level", "status"],
        properties: {
          id: { type: "string" },
          code: { type: "string" },
          name: { type: "string" },
          level: { type: "string" },
          status: { type: "string" },
        },
        additionalProperties: false,
      },
      MembershipEvent: {
        type: "object",
        required: ["id", "action", "previousStatus", "nextStatus", "previousOrganizationId", "nextOrganizationId", "reason", "effectiveAt", "actorName"],
        properties: {
          id: { type: "string" },
          action: { type: "string" },
          previousStatus: { allOf: [{ $ref: "#/components/schemas/MembershipStatus" }], nullable: true },
          nextStatus: { $ref: "#/components/schemas/MembershipStatus" },
          previousOrganizationId: { type: "string", nullable: true },
          nextOrganizationId: { type: "string", nullable: true },
          reason: { type: "string" },
          effectiveAt: { type: "string", format: "date-time" },
          actorName: { type: "string", nullable: true },
        },
        additionalProperties: false,
      },
      AdminMembershipRow: {
        type: "object",
        required: ["id", "userId", "volunteerId", "fullName", "email", "role", "membershipStatus", "memberNumber", "organization", "approvalOrganization", "county", "locality", "applicationAt", "verifiedAt", "approvedAt", "activatedAt", "approvalBody", "suspendedAt", "endedAt", "statusReason", "version", "createdAt", "updatedAt", "history", "availableActions"],
        properties: {
          id: { type: "string" },
          userId: { type: "string", nullable: true },
          volunteerId: { type: "string", nullable: true },
          fullName: { type: "string" },
          email: { type: "string", format: "email" },
          role: { $ref: "#/components/schemas/UserRole" },
          membershipStatus: { $ref: "#/components/schemas/MembershipStatus" },
          memberNumber: { type: "string", nullable: true },
          organization: { allOf: [{ $ref: "#/components/schemas/MembershipOrganization" }], nullable: true },
          approvalOrganization: { allOf: [{ $ref: "#/components/schemas/MembershipOrganization" }], nullable: true },
          county: { type: "string" },
          locality: { type: "string" },
          applicationAt: { type: "string", format: "date-time" },
          verifiedAt: { type: "string", format: "date-time", nullable: true },
          approvedAt: { type: "string", format: "date-time", nullable: true },
          activatedAt: { type: "string", format: "date-time", nullable: true },
          approvalBody: { type: "string" },
          suspendedAt: { type: "string", format: "date-time", nullable: true },
          endedAt: { type: "string", format: "date-time", nullable: true },
          statusReason: { type: "string" },
          version: { type: "integer", minimum: 1 },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          history: { type: "array", items: { $ref: "#/components/schemas/MembershipEvent" } },
          availableActions: { type: "array", items: { $ref: "#/components/schemas/MembershipAction" } },
        },
        additionalProperties: false,
      },
      AdminMembersDashboardSummary: {
        type: "object",
        required: ["total", "supporters", "applications", "verified", "approved", "active", "suspended", "terminated", "organizers", "unassigned"],
        properties: {
          total: { type: "integer", minimum: 0 },
          supporters: { type: "integer", minimum: 0 },
          applications: { type: "integer", minimum: 0 },
          verified: { type: "integer", minimum: 0 },
          approved: { type: "integer", minimum: 0 },
          active: { type: "integer", minimum: 0 },
          suspended: { type: "integer", minimum: 0 },
          terminated: { type: "integer", minimum: 0 },
          organizers: { type: "integer", minimum: 0 },
          unassigned: { type: "integer", minimum: 0 },
        },
        additionalProperties: false,
      },
      AdminMembersDashboardFilters: {
        type: "object",
        required: ["search", "status", "organizationId"],
        properties: {
          search: { type: "string" },
          status: { allOf: [{ $ref: "#/components/schemas/MembershipStatus" }], nullable: true },
          organizationId: { type: "string", nullable: true },
        },
        additionalProperties: false,
      },
      AdminMembersDashboardPagination: {
        type: "object",
        required: ["total", "limit", "offset", "hasPrevious", "hasNext"],
        properties: {
          total: { type: "integer", minimum: 0 },
          limit: { type: "integer", minimum: 1 },
          offset: { type: "integer", minimum: 0 },
          hasPrevious: { type: "boolean" },
          hasNext: { type: "boolean" },
        },
        additionalProperties: false,
      },
      AdminMembersDashboardData: {
        type: "object",
        required: ["generatedAt", "summary", "rows", "organizations", "pagination", "filters"],
        properties: {
          generatedAt: { type: "string", format: "date-time" },
          summary: { $ref: "#/components/schemas/AdminMembersDashboardSummary" },
          rows: { type: "array", items: { $ref: "#/components/schemas/AdminMembershipRow" } },
          organizations: { type: "array", items: { $ref: "#/components/schemas/MembershipOrganization" } },
          pagination: { $ref: "#/components/schemas/AdminMembersDashboardPagination" },
          filters: { $ref: "#/components/schemas/AdminMembersDashboardFilters" },
        },
        additionalProperties: false,
      },
      MembershipActionInput: {
        type: "object",
        required: ["action", "expectedVersion"],
        properties: {
          action: { $ref: "#/components/schemas/MembershipAction" },
          organizationId: { type: "string", minLength: 1, maxLength: 80 },
          approvalOrganizationId: { type: "string", minLength: 1, maxLength: 80 },
          reason: { type: "string", maxLength: 1200, default: "" },
          effectiveAt: { type: "string", format: "date-time" },
          expectedVersion: { type: "integer", minimum: 1 },
        },
        additionalProperties: false,
      },
      MembershipActionResponseData: {
        type: "object",
        required: ["message", "membership"],
        properties: {
          message: { type: "string" },
          membership: { $ref: "#/components/schemas/AdminMembershipRow" },
        },
        additionalProperties: false,
      },
      AdminEmailTestInput: {
        type: "object",
        properties: {
          to: {
            type: "string",
            format: "email",
            maxLength: 180,
          },
          subject: {
            type: "string",
            minLength: 3,
            maxLength: 180,
          },
          message: {
            type: "string",
            minLength: 5,
            maxLength: 5000,
          },
        },
        additionalProperties: false,
      },
      AdminEmailTestResponseData: {
        type: "object",
        required: ["message", "to", "sentAt"],
        properties: {
          message: {
            type: "string",
          },
          to: {
            type: "string",
            format: "email",
          },
          sentAt: {
            type: "string",
            format: "date-time",
          },
        },
        additionalProperties: false,
      },
      AdminAuditItem: {
        type: "object",
        required: ["id", "actorUserId", "actorEmail", "actorRole", "action", "targetType", "targetId", "details", "createdAt"],
        properties: {
          id: {
            type: "string",
          },
          actorUserId: {
            type: "string",
            nullable: true,
          },
          actorEmail: {
            type: "string",
          },
          actorRole: {
            type: "string",
          },
          action: {
            type: "string",
          },
          targetType: {
            type: "string",
          },
          targetId: {
            type: "string",
          },
          details: {
            type: "object",
            additionalProperties: true,
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      ApiSuccessResponse: {
        type: "object",
        required: ["data", "error", "meta"],
        properties: {
          data: {
            description: "Response payload - type depends on endpoint",
            oneOf: [
              {
                type: "object",
              },
              {
                type: "array",
                items: {},
              },
              {
                type: "string",
              },
              {
                type: "number",
              },
              {
                type: "boolean",
              },
              {
                nullable: true,
                example: null,
              },
            ],
          },
          error: {
            nullable: true,
            description: "Always null for success responses",
            example: null,
          },
          meta: {
            $ref: "#/components/schemas/ApiMeta",
          },
        },
      },
      ApiErrorResponse: {
        type: "object",
        required: ["data", "error", "meta"],
        properties: {
          data: {
            nullable: true,
            description: "Always null for error responses",
            example: null,
          },
          error: {
            $ref: "#/components/schemas/ApiErrorPayload",
          },
          meta: {
            $ref: "#/components/schemas/ApiMeta",
          },
        },
      },
    },
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT access token obtained from /auth/signin or /auth/refresh",
      },
    },
  },
  tags: [
    {
      name: "Health",
      description: "Service health check endpoints for monitoring and orchestration",
    },
    {
      name: "Monitoring",
      description: "Monitoring and metrics endpoints",
    },
    {
      name: "Authentication",
      description: "User authentication, authorization, and session management",
    },
    {
      name: "News",
      description: "News articles management",
    },
    {
      name: "News Media",
      description: "Media asset uploads and management for news articles",
    },
    {
      name: "Volunteers",
      description: "Public volunteer listing and registration",
    },
    {
      name: "Mobilization",
      description: "Public events, campaigns, tasks, petitions, consultations and participation responses",
    },
    {
      name: "Admin Volunteers",
      description: "Administrator functions for volunteer management",
    },
    {
      name: "Members",
      description: "Organization members listing",
    },
    {
      name: "Organizations",
      description: "Public territorial organization registry",
    },
    {
      name: "Territorial Organizations",
      description: "Administrative registry for branches, territories, leadership mandates and objectives",
    },
    {
      name: "Finance",
      description: "Financial data and reports",
    },
    {
      name: "Elections",
      description: "Election information and results",
    },
    {
      name: "Statistics",
      description: "Platform-wide statistics and aggregations",
    },
    {
      name: "Admin Members",
      description: "Administrator functions for members management",
    },
    {
      name: "Admin Notifications",
      description: "Administrative notification functions",
    },
    {
      name: "Admin Audit",
      description: "Administrative audit log viewing",
    },
    {
      name: "Meta",
      description: "Metadata and reference data endpoints",
    },
  ],
  externalDocs: {
    description: "PCS Platform Documentation",
    url: "https://pcpens.online",
  },
};
