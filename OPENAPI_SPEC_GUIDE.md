# PCS Platform API Documentation Guide

The PCS API exposes a static OpenAPI 3.0 document and Swagger UI from the running server. The contract is maintained in code, checked against the runtime route registry, and served with the same URLs on both HTTP adapters.

## Runtime Defaults

- Default dev API origin: `http://localhost:4000`
- Default adapter: `fastify`
- Supported adapters: `fastify`, `express`
- Adapter selection: `HTTP_SERVER_ADAPTER`
- Docs routes:
  - `GET /api-docs`
  - `GET /api-docs/`
  - `GET /api-docs.json`

If you override `PORT`, replace `4000` in the examples below.

## Where The Spec Lives

Core files:

- `server/src/lib/openapi-spec.ts`: static OpenAPI contract
- `server/src/lib/buildInfo.ts`: package/build metadata reused by the spec version
- `server/src/lib/swaggerUI.ts`: shared Swagger UI HTML and static asset wiring
- `server/src/app.ts`: Express docs integration through `setupSwaggerUI(app)`
- `server/src/fastifyServer.ts`: Fastify docs integration with the same public paths
- `server/src/tests/contract/openapi.contract.test.ts`: route/spec and schema contract checks

The OpenAPI version is not hardcoded separately anymore; it is sourced from the repo package version metadata.

## Accessing The Docs

### Swagger UI

Open:

```text
http://localhost:4000/api-docs/
```

Canonical behavior:

- `/api-docs` redirects to `/api-docs/`
- `/api-docs/` serves the Swagger UI
- `/api-docs.json` serves the raw OpenAPI JSON

### Raw Specification

```bash
curl http://localhost:4000/api-docs.json | jq
```

## Architecture Notes

### Static Contract

The spec is defined manually in `server/src/lib/openapi-spec.ts`. It is not generated from decorators or runtime reflection.

This gives you:

- explicit control over request/response schemas
- stable output for Swagger UI and client generation
- contract review in code review alongside route changes

### Adapter Parity

The runtime routes come from `server/src/appCore/apiRouteRegistry.ts`. Both adapters consume the same registry:

- Express via `server/src/appCore/routes.ts`
- Fastify via `server/src/fastify/registerRoutes.ts`

The docs endpoints are also available on both adapters, and parity is checked in:

- `server/src/tests/integration/app.integration.test.ts`
- `server/src/tests/integration/fastifyParity.integration.test.ts`

### Version Source

`openApiSpec.info.version` is sourced from package metadata via `server/src/lib/buildInfo.ts`, so the published contract version stays aligned with the application version declared in `package.json`.

## Authentication Model

Protected endpoints use Bearer access tokens:

```bash
Authorization: Bearer <accessToken>
```

Current runtime behavior:

- `POST /api/auth/signin` returns the access token payload in the response body
- refresh state is cookie-based when refresh auth is enabled
- `POST /api/auth/refresh` returns a new access token
- the refresh flow uses double-submit CSRF protection and the header advertised by `GET /api/auth/policy`

Example:

```bash
curl -X POST http://localhost:4000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

Typical successful payload shape:

```jsonc
{
  "data": {
    "message": "Autentificare reusita.",
    "token": "eyJhbGc...",
    "tokenType": "Bearer",
    "expiresInSeconds": "<configured access token TTL>",
    "accessTokenExpiresAt": "ISO8601",
    "csrfToken": "optional-when-refresh-enabled",
    "refreshExpiresInSeconds": "<configured refresh token TTL>",
    "refreshTokenExpiresAt": "ISO8601",
    "tokenPolicy": {
      "...": "see GET /api/auth/policy"
    },
    "user": {
      "id": "1",
      "email": "user@example.com",
      "role": "ADERENT"
    }
  },
  "error": null,
  "meta": {
    "requestId": "uuid",
    "timestamp": "ISO8601"
  }
}
```

## Response Envelope

All JSON endpoints follow the same envelope:

### Success

```json
{
  "data": {},
  "error": null,
  "meta": {
    "requestId": "uuid",
    "timestamp": "ISO8601"
  }
}
```

### Error

```json
{
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "ISO8601"
  }
}
```

## Using The Spec

### Swagger UI

1. Open `http://localhost:4000/api-docs/`
2. Expand an endpoint group
3. Click `Try it out`
4. Submit a request
5. Review the generated request, headers, and response envelope

### cURL

```bash
# Public endpoint
curl http://localhost:4000/api/stats

# Authenticated endpoint
curl http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Admin endpoint
curl http://localhost:4000/api/admin/volunteers \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Postman / Insomnia

Import:

```text
http://localhost:4000/api-docs.json
```

Then:

1. Authenticate with `POST /api/auth/signin`
2. Reuse the returned access token for protected routes
3. If you test refresh flows, preserve cookies and send the CSRF header

### REST Client (VS Code)

```http
@baseUrl = http://localhost:4000/api
@token = eyJhbGc...

### Sign In
POST {{baseUrl}}/auth/signin
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

### Current User
GET {{baseUrl}}/auth/me
Authorization: Bearer {{token}}
```

## Client Generation

Export the spec and generate SDKs:

```bash
curl http://localhost:4000/api-docs.json > openapi.json

openapi-generator generate -i openapi.json -g typescript-axios -o client/generated
openapi-generator generate -i openapi.json -g python -o sdk-python
openapi-generator generate -i openapi.json -g go -o sdk-go
```

## Maintenance Workflow

When a route changes:

1. Update `server/src/appCore/apiRouteRegistry.ts`
2. Update `server/src/lib/openapi-spec.ts`
3. If request payloads change, align them with the live schema definitions
4. Rebuild the server with `npm run build`
5. Run the OpenAPI contract tests and integration tests for docs exposure

Current contract checks cover:

- route parity with the runtime registry
- `news` payload/schema alignment with the live Zod schema
- OpenAPI version alignment with package metadata
- docs endpoint exposure on both adapters

## Troubleshooting

### Swagger UI does not load

1. Verify the API is running at `http://localhost:4000/api/health`
2. Confirm the selected adapter booted successfully
3. Rebuild the server with `npm run build`
4. Check the browser console and server logs

### An endpoint is missing from the docs

1. Confirm the route exists in `server/src/appCore/apiRouteRegistry.ts`
2. Confirm the corresponding path/method exists in `server/src/lib/openapi-spec.ts`
3. Rebuild and refresh `http://localhost:4000/api-docs/`

### TypeScript complains about Swagger UI types

The project currently depends on `@types/swagger-ui-express` in the server workspace. If typings drift after an upgrade, re-check `server/package.json` and reinstall dependencies.

## Related Docs

- `OPENAPI_QUICKSTART.md`
- `README.md`
- `docs/api-routing.md`
- `docs/runbook.production.md`

## Maintenance Principle

Do not duplicate volatile values in prose when the code already owns them. For this repo, that means:

- use the runtime default port `4000` in examples
- mention `HTTP_SERVER_ADAPTER` instead of documenting only one adapter
- source the OpenAPI version from package metadata
- avoid hardcoding endpoint counts or package versions in the docs
