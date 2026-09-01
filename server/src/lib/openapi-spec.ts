/**
 * OpenAPI 3.0 Specification for PCP Platform API
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
    title: "PCP Platform API",
    version: packageVersion,
    description:
      "Romanian political platform API for news, volunteers, members, and administration management",
    contact: {
      name: "PCP Development Team",
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
        description: "Register a new PCP account using the live signup contract.",
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
        description: "Retrieve list of partner or affiliated organizations",
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
            name: "limit",
            in: "query",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 50,
              default: 12,
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
        required: ["id", "title", "summary", "category", "publishedAt", "tags"],
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
        required: ["id", "title", "summary", "category", "content", "publishedAt", "tags", "media"],
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
        required: ["id", "title", "summary", "category", "publishedAt", "tags", "media", "status", "createdAt"],
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
            format: "email",
            maxLength: 180,
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
      AdminDashboardMember: {
        type: "object",
        required: ["id", "fullName", "email", "role", "createdAt"],
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
          createdAt: {
            type: "string",
            format: "date-time",
          },
        },
        additionalProperties: false,
      },
      AdminDashboardGroup: {
        type: "object",
        required: ["label", "count", "rows"],
        properties: {
          label: {
            type: "string",
          },
          count: {
            type: "integer",
            minimum: 0,
          },
          rows: {
            type: "array",
            items: {
              $ref: "#/components/schemas/AdminDashboardMember",
            },
          },
        },
        additionalProperties: false,
      },
      AdminMembersDashboardSummary: {
        type: "object",
        required: ["total", "aderenti", "membri", "organizatori"],
        properties: {
          total: {
            type: "integer",
            minimum: 0,
          },
          aderenti: {
            type: "integer",
            minimum: 0,
          },
          membri: {
            type: "integer",
            minimum: 0,
          },
          organizatori: {
            type: "integer",
            minimum: 0,
          },
        },
        additionalProperties: false,
      },
      AdminMembersDashboardFilters: {
        type: "object",
        required: ["search", "limit"],
        properties: {
          search: {
            type: "string",
          },
          limit: {
            type: "integer",
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
      AdminMembersDashboardData: {
        type: "object",
        required: ["summary", "groups", "filters"],
        properties: {
          summary: {
            $ref: "#/components/schemas/AdminMembersDashboardSummary",
          },
          groups: {
            type: "object",
            required: ["aderenti", "membri", "organizatori"],
            properties: {
              aderenti: {
                $ref: "#/components/schemas/AdminDashboardGroup",
              },
              membri: {
                $ref: "#/components/schemas/AdminDashboardGroup",
              },
              organizatori: {
                $ref: "#/components/schemas/AdminDashboardGroup",
              },
            },
            additionalProperties: false,
          },
          filters: {
            $ref: "#/components/schemas/AdminMembersDashboardFilters",
          },
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
      name: "Admin Volunteers",
      description: "Administrator functions for volunteer management",
    },
    {
      name: "Members",
      description: "Organization members listing",
    },
    {
      name: "Organizations",
      description: "Partner and affiliated organizations",
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
    description: "PCP Platform Documentation",
    url: "https://pcp.ro/docs",
  },
};
