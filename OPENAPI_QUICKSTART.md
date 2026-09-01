# OpenAPI Specification Quick Reference

## Access Points

Default development runtime after `npm run dev`:

- API origin: `http://localhost:4000`
- Default adapter: `fastify`
- Adapter override: `HTTP_SERVER_ADAPTER=express` or `HTTP_SERVER_ADAPTER=fastify`

The same documentation routes are exposed by both adapters:

| URL | Purpose |
|-----|---------|
| `http://localhost:4000/api-docs` | Redirect to the canonical Swagger UI URL |
| `http://localhost:4000/api-docs/` | Interactive Swagger UI documentation |
| `http://localhost:4000/api-docs.json` | Raw OpenAPI 3.0 specification (JSON) |

If you run the server on another `PORT`, replace `4000` in the examples below.

## Runtime Alignment

The spec is static and maintained in code:

- `server/src/lib/openapi-spec.ts`
- version is sourced from `package.json` through `server/src/lib/buildInfo.ts`
- Express exposes docs through `setupSwaggerUI(app)` in `server/src/app.ts`
- Fastify exposes the same docs paths in `server/src/fastifyServer.ts`

Contract guards:

- `server/src/tests/contract/openapi.contract.test.ts` checks route parity with `getApiRouteDefinitions()`
- the same contract test also checks that the OpenAPI version matches package metadata
- integration tests verify `/api-docs`, `/api-docs/` and `/api-docs.json` on both adapters

Notes:

- `/api/metrics` is documented only when metrics are enabled in runtime config
- the spec `servers` entry is `/api`, so generated clients use the API base path, not the docs path
- exact package versions live in `server/package.json`; they are not duplicated here

## Implementation Files

| File | Purpose |
|------|---------|
| `server/src/lib/openapi-spec.ts` | Static OpenAPI 3.0 contract |
| `server/src/lib/buildInfo.ts` | Package/build metadata used by the spec version |
| `server/src/lib/swaggerUI.ts` | Shared Swagger UI HTML/assets integration |
| `server/src/app.ts` | Express adapter integration |
| `server/src/fastifyServer.ts` | Fastify adapter integration |
| `server/src/tests/contract/openapi.contract.test.ts` | Route/spec and schema contract guards |

## Response Envelope

Success responses:

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

Error responses:

```json
{
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Description"
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "ISO8601"
  }
}
```

## Authentication

Protected endpoints use Bearer access tokens:

```bash
Authorization: Bearer <accessToken>
```

Current auth flow:

- `POST /api/auth/signin` returns the access token payload in the response body
- when refresh auth is enabled, refresh state is transported with `HttpOnly` cookies on `/api/auth`
- `POST /api/auth/refresh` returns a new access token and requires the CSRF header described by `GET /api/auth/policy`

## Testing the API

### Swagger UI

```text
1. Open http://localhost:4000/api-docs/
2. Select an endpoint
3. Click "Try it out"
4. Execute the request
```

### cURL

```bash
# Read the raw OpenAPI spec
curl http://localhost:4000/api-docs.json | jq

# Public endpoint
curl http://localhost:4000/api/stats \
  -H "Accept: application/json"

# Protected endpoint
curl http://localhost:4000/api/admin/volunteers \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Postman

```text
1. Import http://localhost:4000/api-docs.json
2. Choose OpenAPI 3.0
3. Authenticate with POST /api/auth/signin
4. Reuse the returned access token on protected requests
```

### REST Client (VS Code)

```http
@baseUrl = http://localhost:4000/api

### Get health
GET {{baseUrl}}/health/live

### List volunteers
GET {{baseUrl}}/volunteers
```

## Common Endpoints

Public:

```text
GET    /api/health/live
GET    /api/health/ready
GET    /api/health
GET    /api/news
GET    /api/volunteers
GET    /api/volunteers/counties
GET    /api/members
GET    /api/stats
POST   /api/volunteers
POST   /api/auth/signin
POST   /api/auth/signup
```

Protected/Admin:

```text
GET    /api/auth/me
GET    /api/auth/policy
POST   /api/auth/refresh
POST   /api/auth/revoke-all
GET    /api/admin/volunteers
GET    /api/admin/members/dashboard
GET    /api/news/admin/list
POST   /api/news
POST   /api/news/media/upload
GET    /api/admin/audit
```

## Client Generation

Generate a TypeScript client from the running spec:

```bash
npx openapi-generator-cli generate \
  -i http://localhost:4000/api-docs.json \
  -g typescript-axios \
  -o client/generated
```

## Maintenance

When routes change:

1. Update `server/src/appCore/apiRouteRegistry.ts`
2. Update `server/src/lib/openapi-spec.ts`
3. Run `npm run build`
4. Run the contract tests that validate the OpenAPI spec

See `OPENAPI_SPEC_GUIDE.md` for the longer maintenance and integration notes.
