# PCS Platform - Comprehensive Workspace Analysis

**Project**: Full-stack political party (PCS) platform
**Tech Stack**: Node.js + PostgreSQL + React + TypeScript
**Architecture**: Monorepo with Express/Fastify dual adapters
**Analysis Date**: April 2026

---

## 1. PERFORMANCE OPTIMIZATIONS

### Bundle Size Management ✅
- **Frontend chunking strategy** (Vite):
  - Separate vendor chunks: `react-vendor`, `router-vendor`, `query-vendor`
  - Manual chunk partitioning by npm package groups
  - React ecosystem (~react, react-dom, scheduler) isolated
  - React Router (~@remix-run/router, history) isolated
  - TanStack Query separated from general vendors
  - Generic vendor chunk for remaining dependencies

- **Build hardening**:
  - `emptyOutDir: true` - cleans stale bundles before build
  - No source maps in production (`sourcemap: false`)
  - Deterministic TypeScript compilation (`tsc -b`)

### Lazy Loading & Route Splitting ✅
- **Implemented**:
  - Routes use `React.lazy()` with `Suspense` fallback
  - All page components lazy-loaded (HomePage, NewsListPage, AdminDashboard, etc.)
  - Custom `lazyNamed()` wrapper for named imports from lazy chunks
  - Route-based code splitting ensures smaller initial bundles

### Caching Strategy ⭐ **Well-Implemented**
- **Static assets** (versioned by build hash):
  - `Cache-Control: public, max-age=31536000, immutable` (1 year)
  - Long-term caching with hash-based busting

- **HTML & API responses**:
  - `Cache-Control: no-store` (forces revalidation)
  - Prevents stale content issues

- **Dynamic assets** (CSS, images):
  - `Cache-Control: public, max-age=3600` (1 hour)
  - Balance between freshness and efficiency

### Potential Optimization Gaps ⚠️
- No mention of compression middleware (gzip/brotli) configuration
- No CDN layer configuration visible
- No service worker or offline-first strategy
- Image optimization (WebP, AVIF) not clearly configured

---

## 2. SECURITY CONSIDERATIONS

### Authentication & Authorization ⭐ **Comprehensive**

**Token Management**:
- JWT access tokens via `jose` library (standard crypto, not external services)
- Refresh token rotation with CSRF protection
- Dual-cookie strategy:
  - `pcs_refresh_token` (HttpOnly, path-restricted)
  - `pcs_refresh_csrf` (CSRF token for double-submit validation)
  - CSRF header: `x-csrf-token`
- Token hashing in database (not stored raw)
- Token revocation tracking via `AuthRevokedToken` table
- Refresh token rotation chain (`rotatedFromId`, `rotatedToId`)
- Session tracking (userAgent, ipAddress) for suspicious activity detection

**Password Security**:
- Scrypt hashing with 64-byte output and 16-byte salt
- Timing-safe comparison for password verification
- No plaintext storage
- Strong password policy:
  - Minimum 10 characters
  - Maximum 128 characters
  - Complex requirements (pattern-based validation with Zod)
- Dummy password hash to prevent timing attacks on non-existent users

**Authorization**:
- Role-based access control (roles: user, admin, etc.)
- Path-based guards (auth required vs. public)
- Example: Admin-only news endpoints with request validation

### CORS & Security Headers ⭐ **Excellent**

**Content Security Policy (CSP)**:
```
default-src 'self'
base-uri 'self'
form-action 'self'
object-src 'none'
frame-ancestors 'self'
img-src 'self' data: https:
font-src 'self' https: data:
style-src 'self' https:
script-src 'self' https://challenges.cloudflare.com
frame-src 'self' https://challenges.cloudflare.com
connect-src 'self' https://challenges.cloudflare.com
script-src-attr 'none'
```

**Additional Headers** (via Helmet):
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-DNS-Prefetch-Control: off`
- `X-XSS-Protection: 0`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`
- `Origin-Agent-Cluster: ?1`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: [restrictive defaults]`

**CORS Configuration**:
- Configurable via `CORS_ORIGIN` environment variable
- Supports specific origins (not `*` by default)
- Credentials flag configurable
- Non-browser requests (missing Origin) are rejected

### Data Validation ⭐ **Well-Structured**

**Server-side validation**:
- `Zod` for schema validation (type-safe)
- Separate schema files (`.schema.ts`) per module
- Examples:
  - `adminMembersDashboardQuerySchema`
  - `listMembersQuerySchema`
  - Auth validation (sign in/up)
  - Volunteer workflow, news creation/update
- `safeParse()` pattern for graceful error handling
- Type inference from schemas (`z.infer<typeof schema>`)

**Input Sanitization**:
- Email header sanitization (prevents CRLF injection in emails)
- File upload validation (MIME type detection via file signature)
- ClamAV integration for malware scanning (Docker service available)

### CAPTCHA Implementation ✅

**Cloudflare Turnstile**:
- Mode-switchable (`CAPTCHA_MODE=disabled` for testing)
- Verification with hostname and action validation
- Score-based evaluation (configurable min score)
- Dedicated test coverage (`captchaVerification.test.ts`)
- Uniform response message to prevent account enumeration

### Potential Security Concerns ⚠️

1. **Sensitive Log Redaction**:
   - Authorization headers and cookies are redacted in logs (good)
   - But ensure `no-console` rule is enforced (mentioned as "mostly" enforced)

2. **File Upload Security**:
   - News media cleanup runs separately (potential race conditions)
   - ClamAV availability not guaranteed (can be disabled)

3. **SQL Injection**:
   - Prisma ORM provides primary defense
   - No raw SQL queries visible, but manual migration scripts exist

4. **HTTPS Enforcement**:
   - `forceHttpsUpgrade` flag exists but appears optional
   - In production, HSTS should be enforced

5. **Admin Audit Trail**:
   - OutBox pattern implemented but delay tolerance not documented
   - Admin actions logged to `AdminAuditLog` table

---

## 3. TESTING COVERAGE

### Test Infrastructure ⭐ **Comprehensive**

**Testing Pyramid**:
```
E2E (Playwright)           - Browser testing
├─ Full-stack (fullstack.spec.ts)
└─ API-only (playwright.config.ts)

Integration Tests (Node)   - Database, real services
├─ Auth (auth.integration.test.ts)
├─ Volunteers
├─ News
└─ Rate limiting (Redis fallback)

Unit Tests (Node)          - Pure functions
├─ Auth tokens (authToken.test.ts)
├─ CAPTCHA verification (captchaVerification.test.ts)
├─ Media MIME detection (mediaMime.test.ts)
├─ Redis rate limiting (redisRateLimit.test.ts)

Contract Tests (helpers/)  - Cross-adapter validation
└─ Express/Fastify parity (fastifyParity.integration.test.ts)
```

**Testing Frameworks**:
- **Server**: Node's built-in `test` module (no external framework)
- **Client**: Vitest + React Testing Library
- **E2E**: Playwright
- **Test runners**:
  - `npm run test:unit` - Unit tests only
  - `npm run test:integration` - Integration (DB required)
  - `npm run test:integration:redis` - Redis-specific flows
  - `npm run test:e2e` - API E2E tests
  - `npm run test:e2e:browser` - Browser E2E tests
  - `npm run test:e2e:browser:fullstack` - Full stack tests with DB setup

**Test Environment Configuration**:
- Vitest config: `jsdom` environment, CSS support
- Setup file: `src/test/setup.ts`
- Test utilities: `dbTestUtils.ts` with test data builders
- Playwright settings:
  - Preview server on port 4010 for E2E
  - Vite preview with test environment variables
  - DB migration for each test run
  - Full-stack tests ignore regular E2E tests

### Test Coverage Analysis ✅

**Well-Tested Areas**:
1. **Authentication**:
   - Token creation/verification roundtrip
   - Token tampering detection
   - Bearer token parsing
   - Sign in/up validation
   - CSRF protection
   - Token refresh with rotation

2. **Authorization**:
   - Admin news endpoint guards
   - Role-based access control
   - Unauthorized request rejection

3. **Data Validation**:
   - CAPTCHA verification (valid/invalid actions, scores)
   - Media file validation (signatures, MIME types)
   - Volunteer submission validation
   - News create/update validation

4. **Rate Limiting**:
   - Auth rate limiting
   - Volunteer signup rate limiting
   - Redis fallback mechanism
   - Database rate limiter cleanup

5. **API Contracts**:
   - Express/Fastify adapter parity
   - Route registration consistency

### Gaps in Coverage ⚠️

1. **Client-side**:
   - Only one test file found: `RequireAuth.test.tsx`
   - React Query hooks largely untested
   - Component rendering and interactions minimally tested
   - No snapshot tests observed

2. **Integration**:
   - Email outbox worker not explicitly tested
   - Admin audit outbox worker not explicitly tested
   - News media cleanup script not tested

3. **Performance/Load**:
   - No load testing or stress testing mentioned
   - No bundle size regression tests

4. **Security**:
   - No security audit test suite
   - No OWASP top 10 validation tests (beyond injection via Prisma)

---

## 4. ERROR HANDLING & LOGGING

### Error Handling Architecture ⭐ **Well-Structured**

**Error Taxonomy**:

```typescript
class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode; // SCREAMING_SNAKE_CASE
}
```

**Canonical Error Codes** (50+ defined):
- **Generic**: `INTERNAL_ERROR`, `NOT_FOUND`, `BAD_REQUEST`, `PAYLOAD_INVALID`
- **Rate Limiting**: `RATE_LIMITED`, `AUTH_RATE_LIMITED`, `VOLUNTEER_RATE_LIMITED`
- **Auth**: `AUTH_UNAUTHORIZED`, `AUTH_FORBIDDEN`, `AUTH_CSRF_INVALID`, `INVALID_CREDENTIALS`
- **Volunteers**: `VOLUNTEER_VALIDATION_FAILED`, `VOLUNTEER_EMAIL_EXISTS`, `VOLUNTEER_CAPTCHA_INVALID`
- **News**: `NEWS_NOT_FOUND`, `NEWS_CREATE_VALIDATION_FAILED`, `NEWS_MEDIA_INFECTED`
- **Media**: `NEWS_MEDIA_FILE_TOO_LARGE`, `NEWS_MEDIA_SCAN_TIMEOUT`, `NEWS_MEDIA_SCAN_FAILED`

**Error Handling Flow**:
1. Handler throws `AppError` or other exception
2. Express/Fastify error middleware catches it
3. Database errors (constraint violations, etc.) mapped to HTTP responses
4. JSON parser errors handled separately
5. Unhandled errors logged as `INTERNAL_SERVER_ERROR`

### Logging Strategy ⭐ **Comprehensive**

**Logger**: Pino (structured JSON logging)

**Configuration**:
- ISO timestamp format (`isoTime`)
- Configurable log level (via `LOG_LEVEL` env var)
- Sensitive data redaction:
  - `req.headers.authorization` ❌
  - `req.headers.cookie` ❌
  - `res.headers['set-cookie']` ❌
  - Paths automatically redacted from all logs

**HTTP Logging**:
- Custom log level based on status code:
  - ≥500: `error`
  - ≥400: `warn`
  - <400: `info`
- Request ID tracking (`x-request-id` header)
- Request latency measurement (nanosecond precision)
- Path normalization for metrics

**Log Output Examples**:
- Auth failures: code, status, error details
- Database conflicts: constraint name, conflict details
- Business errors: code, status, message
- Refresh token failures tracked separately

**Logging in Workers**:
- Admin audit outbox: info on successful passes, errors on failure
- Email notification outbox: similar pattern
- Cleanup scripts: error condition logging

### Monitoring & Metrics 🔍

**Prometheus Metrics**:
- Auth failure counts (per error code and path)
- Email failure counts
- Refresh token failure counts
- HTTP request duration (histogram, per route)
- Metrics endpoint: `/api/metrics` (Bearer token protected)

**Metrics Bearer Token**:
- Configured via `METRICS_BEARER_TOKEN` env var
- Prevents unauthorized metric exfiltration

### Potential Improvements ⚠️

1. **No correlation IDs across async operations** (outbox workers, emails)
2. **Rate limit failures not fully logged** (just metrics)
3. **Database query logging** mentioned as development-only, but no query logging visible
4. **Stacktrace detail** in error logs could vary based on environment

---

## 5. CODE QUALITY & MAINTAINABILITY

### Organization & Architecture ⭐ **Domain-Driven**

**Server Structure**:
```
server/src/
├── modules/              # Feature/domain modules
│   ├── admin/           # Admin-specific handlers
│   ├── auth/            # Authentication
│   ├── elections/       # Elections data
│   ├── finance/         # Finance data
│   ├── members/         # Members registry
│   ├── news/            # News management
│   ├── organizations/   # Organizations data
│   ├── stats/           # Statistics
│   └── volunteers/      # Volunteer CRM
├── appCore/             # App initialization, routes, middleware
├── fastify/             # Fastify adapter
├── lib/                 # Shared utilities
├── shared/              # Shared types/constants
├── scripts/             # Operational scripts
└── tests/               # Test organization
    ├── unit/
    ├── integration/
    ├── e2e/
    ├── contract/
    └── helpers/
```

**Client Structure**:
```
client/src/
├── app/                 # App shell, routing, providers
├── features/            # Feature modules
├── components/          # Reusable UI components
├── hooks/               # Custom React hooks
├── lib/                 # Utilities
├── services/            # API services
├── types/               # TypeScript types
├── utils/               # General utilities
├── react/               # React-specific utilities
└── test/                # Test setup
```

### Naming Conventions ✅

**TypeScript**:
- PascalCase: Classes, types, interfaces, components
- camelCase: Functions, variables, properties
- SCREAMING_SNAKE_CASE: Constants, error codes

**Files**:
- `.controller.ts` - HTTP handlers
- `.service.ts` - Business logic
- `.repository.ts` - Data access layer
- `.schema.ts` - Zod validation schemas
- `.types.ts` or `.d.ts` - Type definitions
- `.middleware.ts` - Middleware handlers
- `.integration.test.ts` / `.unit.test.ts` - Test files

### Code Quality Enforcement ⭐ **Strict**

**Linting**:
- ESLint with zero-warning policy (`--max-warnings=0`)
- TypeScript strict mode
- Mandatory rules:
  - `curly` (always require braces)
  - `eqeqeq` (strict equality)
  - `@typescript-eslint/no-explicit-any` (forbid `any` type)
- `no-console` enforced in app code (exception: scripts)
- React hooks rules enforced

**Build Process**:
- TypeScript compilation with type checking
- Pre-commit linting (recommended via `npm run verify`)
- `npm run lint:fix` available for auto-fixes

**Type Safety**:
- Full TypeScript everywhere (`.ts`, `.tsx`)
- No `.js` files except config
- Path aliases for cleaner imports:
  - `@app` → `src/app`
  - `@features` → `src/features`
  - `@react` → `src/react`
  - `@components` → `src/components`
  - `@lib` → `src/lib`

### API Route Registry Pattern ⭐ **Excellent Design**

**Single Source of Truth**:
- All API routes defined in `server/src/appCore/apiRouteRegistry.ts`
- Express and Fastify consume the same registry
- Eliminates drift between adapters
- No separate Express Router files for API routes

**Registry Contains**:
- Endpoint paths and methods
- Middleware attachments
- Auth/role guards
- Conditional route logic
- Adapter-specific logic isolated in `expressCompat.ts` and `registerRoutes.ts`

**Enforcement**:
- Integration test: `app.integration.test.ts` (Express parity)
- Integration test: `fastifyParity.integration.test.ts` (Fastify parity)
- Dead code cleanup: Router files without registry entries removed

### Dependency Management ✅

**Shared Dependencies**:
- React overrides in root `package.json` (18.3.1)
- React Router DOM (v6)
- TanStack React Query (v5)
- Zod for validation
- Fastify, Express for servers
- Prisma for ORM
- Pino for logging
- José for JWT
- Helmet for security headers

**Development**:
- Separate npm workspaces for `server` and `client`
- Concurrent dev: `npm run dev` (server + client)
- Concurrently package for orchestration

### Code Duplication ⚠️

- **Schema files**: Each module has its own schema (good)
- **Type files**: Module-specific types (good)
- **Middleware**: Some duplication between handlers
- **Repository patterns**: Consistent but large (room for DRY improvements)

### Documentation 📚

**In-code**:
- Comments on complex logic (error mapping, token rotation)
- Module READMEs mentioned but not all present
- Sparse inline documentation

**External Documentation**:
- `docs/api-routing.md` - API endpoint pattern
- `docs/runbook.production.md` - Deployment guide
- Root `README.md` - Quick start

---

## 6. DATABASE SCHEMA & RELATIONSHIPS

### Schema Overview 🏗️

**Core Tables**:

| Table | Purpose | Key Columns |
|-------|---------|------------|
| `users` | Accounts with roles | id, email, passwordHash, role, createdAt |
| `auth_refresh_tokens` | Session tracking | id, tokenHash, csrfTokenHash, userId, expiresAt, revokedAt, rotatedFromId, rotatedToId, userAgent, ipAddress |
| `auth_revoked_tokens` | Token blacklist | jti, expiresAt, revokedAt |
| `counties` | Geographic regions | id, name, normalizedName |
| `volunteers` | CRM entries | id, fullName, email, phone, countyId, skills, workflowStatus, internalNotes, ownerUserId, crmPriority, crmTags, skillTags |
| `news` | News articles | id, title, summary, category, content, status, tags, publishedAt |
| `news_media_assets` | Media files | id, storagePath, publicUrl, mimeType, sizeBytes, kind, createdBy |
| `news_media_links` | Article-media join | id, newsId, assetId, kind, sortOrder |
| `rate_limit_entries` | Rate limit tracking | scope, keyHash, windowStart, hits, updatedAt |
| `admin_audit_log` | Admin action log | id, actorUserId, action, targetType, targetId, details, createdAt |
| `notification_email_outbox` | Email queue | id, action, payload, status, attemptCount, lastError, sentAt |
| `admin_audit_outbox` | Admin action queue | Similar to email outbox |

### Relationships 🔗

**User Relations**:
- `User` ↔ `AuthRefreshToken` (1:many)
- `User` ↔ `Volunteer` ("VolunteerOwner", 1:many optional)
- `User` ↔ `Volunteer` ("VolunteerStatusUpdatedBy", 1:many optional)
- `User` ↔ `AdminAuditLog` ("AdminAuditActor", 1:many optional)
- `User` → `NewsMediaAsset` (1:many optional, createdBy)

**Volunteer Relations**:
- `Volunteer` ← `County` (many:1, countyId)
- `Volunteer` → `User` ("VolunteerOwner", optional)
- `Volunteer` → `User` ("VolunteerStatusUpdatedBy", optional)

**News Relations**:
- `News` ← `NewsMediaLink` (1:many)
- `NewsMediaAsset` ← `NewsMediaLink` (1:many)
- `NewsMediaAsset` → `User` ("createdBy", optional)

### Data Integrity ⭐

**Constraints**:
- Primary keys (auto-increment or UUID)
- Foreign keys with cascade/restrict/set-null delete rules
- Unique constraints:
  - `users.email` (implicit via auth)
  - `counties.name` and `counties.normalizedName`
  - `news_media_assets.storagePath` and `news_media_assets.publicUrl`
  - `auth_refresh_tokens.tokenHash`
  - `news_media_links.{newsId, assetId}` (composite unique)

**Soft Deletes**:
- News media assets: `deletedAt` timestamp
- Cleanup script respects soft delete

### Performance Considerations 🔍

**Indexes**:
- BigInt PKs (64-bit) for users/assets (no overflow concerns)
- `countyId` FK should be indexed (for volunteer queries)
- `windowStart` in rate limit entries (for cleanup)
- `status` in outbox tables (for worker filtering)
- Consider index on `volunteers.workflow_status`

**Outbox Pattern**:
- `NotificationEmailOutbox` and `AdminAuditOutbox` for reliable delivery
- Attempt count tracking with max attempts (6 default)
- Lock mechanism via `lockedAt` timestamp
- Message deduplication not visible (potential issue)

**JSON Columns**:
- `news.tags` (JSONB)
- `volunteers.crmTags`, `volunteers.skillTags` (JSONB arrays)
- `admin_audit_log.details`, outbox tables `payload` (JSONB)
- Built-in Postgres JSONB operators available

### Potential Issues ⚠️

1. **No explicit created_at index** on `admin_audit_log` (could slow pagination)
2. **No migration versioning visible** - custom migration script in `lib/migrations.ts`
3. **Soft delete performance** - queries must check `deletedAt IS NULL`
4. **Rate limit entry cleanup** - runs as manual script, could grow unbounded

---

## 7. API ENDPOINT PATTERNS & CONSISTENCY

### Routing Architecture ⭐ **Centralized**

**Single Registry Pattern**:
- File: `server/src/appCore/apiRouteRegistry.ts`
- No distributed Router files
- Middleware attached per-route
- Auth guards declarative

### Endpoint Categories

**Health & Monitoring**:
- `GET /api/health/live` - Liveness probe
- `GET /api/health/ready` - Readiness probe
- `GET /api/metrics` - Prometheus metrics (Bearer token auth)

**Authentication**:
- `POST /api/auth/signup` - Create user account
- `POST /api/auth/signin` - Login
- `POST /api/auth/refresh` - Get new access token (CSRF protected)
- `POST /api/auth/signout` - Logout (revoke tokens)
- Rate limited: `AUTH_RATE_LIMIT_MAX` env var

**Public Data**:
- `GET /api/news` - News list (pagination)
- `GET /api/news/:id` - News detail
- `GET /api/volunteers/counties` - County list
- `GET /api/volunteers/public` - Public volunteer dashboard (anonymous)

**Volunteers**:
- `POST /api/volunteers` - Register volunteer (CAPTCHA required)
- `GET /api/volunteers/:id` - Volunteer detail (auth required)
- `PATCH /api/volunteers/:id` - Update volunteer (admin/owner)
- Rate limited: `VOLUNTEER_RATE_LIMIT_MAX` env var

**Admin News**:
- `POST /api/news` - Create article (admin)
- `GET /api/news/admin/list` - Admin news list
- `PATCH /api/news/:id` - Update article (admin)
- `DELETE /api/news/:id` - Delete article (admin)
- Media upload: `POST /api/news/media` (ClamAV scan)

**Admin Volunteers**:
- `GET /api/volunteers/admin/list` - Volunteer list (admin)
- `PATCH /api/volunteers/:id/workflow` - Update status (admin)
- `DELETE /api/volunteers/:id` - Delete volunteer (admin)
- `PATCH /api/volunteers/bulk/workflow` - Bulk status update
- `DELETE /api/volunteers/bulk` - Bulk delete

**Admin Members**:
- `GET /api/members` - Member registry (search, pagination)
- `GET /api/members/dashboard` - Dashboard stats

**Other Admin**:
- `POST /api/admin/email-test` - Send test email
- Audit log endpoints (implied but not detailed)

### Response Format Consistency ✅

**Success Responses**:
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Responses**:
```json
{
  "success": false,
  "error": {
    "code": "AUTH_UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

**API Envelope Pattern**:
- Consistent error structure
- Error codes are canonical (no ad-hoc strings)
- HTTP status aligned with codes (400, 401, 403, 404, 409, 429, 500)

### Query Parameters & Pagination 📄

**List Endpoints**:
- `limit` - Items per page (default unstated, likely 20-50)
- `offset` - Skip count (not cursor-based)
- `search` - Text search
- `status` - Filter by status
- Cursor-based pagination mentioned for:
  - Volunteers: `VOLUNTEERS_CURSOR_INVALID`
  - News: `NEWS_CURSOR_INVALID`
  - Admin audit: `ADMIN_AUDIT_CURSOR_INVALID`

### Validation & Error Codes ✅

**Input Validation**:
- Zod schemas for all inputs
- Status codes:
  - 201 (created likely not visible)
  - 400 (bad request)
  - 401 (unauthorized)
  - 403 (forbidden)
  - 404 (not found)
  - 409 (conflict - unique constraint)
  - 429 (rate limited)
  - 500 (server error)

**Business Validation Errors**:
- `PAYLOAD_INVALID` - JSON invalid
- `AUTH_SIGNUP_VALIDATION_FAILED` - Bad signup data
- `NEWS_CREATE_VALIDATION_FAILED` - Bad news data
- `VOLUNTEER_VALIDATION_FAILED` - Bad volunteer data

### Potential Issues ⚠️

1. **Pagination inconsistency**: Offset-based in some places, cursor-based in others (unused error codes?)
2. **No API versioning** visible (v1, v2, etc.)
3. **No batch endpoints** for bulk operations beyond volunteers
4. **Response time SLA** not documented
5. **Deprecation strategy** not visible

---

## 8. FRONTEND STATE MANAGEMENT & DATA FETCHING

### State Management Architecture ⭐ **React Query Focused**

**Primary Tool**: TanStack React Query v5 (`@tanstack/react-query`)

**Data Flow**:
```
useQuery/useMutation
    ↓
API Service Layer
    ↓
Fetch API (browser built-in)
    ↓
Server (Express/Fastify)
```

### Query Hooks Pattern ✅

**Examples Found**:
- `useAdminMembersDashboard` - Fetches dashboard stats with cursor pagination
- `useAdminVolunteerDetails` - Fetches individual volunteer
- `useBulkUpdateVolunteerWorkflow` - Bulk workflow updates
- `useBulkDeleteVolunteer` - Bulk volunteer deletes
- `useVolunteerOwners` - Static owner list
- `useNewsById` - News detail with caching

**Features Implemented**:
- `keepPreviousData` - Smooth pagination
- Query client cache invalidation on mutations
- Error handling in mutations
- Type-safe responses (TypeScript generics)
- Stale data prevention (background refetch)

### API Service Layer 📡

**File**: `client/src/services/README.md` (structure exists but content minimal)

**Likely API Methods**:
- `getNewsList()`
- `getNewsDetail(id)`
- `getVolunteersList()`
- `createVolunteer(data)`
- `signIn(credentials)`
- `signOut()`
- Admin endpoints for news/volunteers

### State Patterns 🔄

**Context API Usage**:
- Authentication context (demo: `RequireAuth.test.tsx`)
- Likely global auth state for:
  - Current user
  - Access token
  - Refresh token (localStorage or memory)
  - Auth loading state

**Local State**:
- Form state (likely useState)
- UI state (modals, dropdowns)
- Filter/sort state

### Testing Strategy ✅

**Test File**:
- `RequireAuth.test.tsx` - Tests auth guard
- Uses Vitest with React Testing Library
- Tests that:
  - Loading state shown while restoring auth
  - Redirects unauthenticated users
  - Allows authenticated users access

### Potential Gaps ⚠️

1. **Limited test coverage** for custom hooks
2. **No Redux or Zustand** - entirely Query-based (single source of truth)
3. **Token refresh strategy** not visible in analysis
4. **Offline support** not confirmed
5. **Cache invalidation strategy** inferred but not explicit

---

## 9. INFRASTRUCTURE & DEPLOYMENT

### Containerization ✅

**Docker Compose Services**:
- `postgres:16-alpine` - Primary database
- `redis:7-alpine` - Optional caching layer (testing profile)
- `prometheus:v2.54.1` - Metrics collection (monitoring profile)
- `grafana:11.3.0` - Dashboarding (monitoring profile)
- `news_media_cleanup` - Scheduled maintenance (maintenance profile)
- `clamav` - Virus scanning (available)

**Profiles**:
- Base: postgres (always)
- `cache`: redis
- `monitoring`: prometheus + grafana
- `maintenance`: cleanup scripts
- `testing`: redis for integration tests

### Environment Configuration 🔧

**Critical Variables**:
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - development, test, production
- `CORS_ORIGIN` - Allowed origins
- `CORS_CREDENTIALS` - Cookie attribute
- `CAPTCHA_MODE` - disabled, cloudflare
- `CAPTCHA_SITE_KEY`, `CAPTCHA_SECRET_KEY` - Turnstile
- `AUTH_REFRESH_ENABLED` - Token refresh toggle
- `AUTH_REFRESH_STORE` - redis or database
- `AUTH_RATE_LIMIT_MAX` - Per-minute limit
- `VOLUNTEER_RATE_LIMIT_MAX` - Per-minute limit
- `EMAIL_NOTIFICATIONS_ENABLED` - Email toggle
- `PORT` - Server port (default 4000)
- `POSTGRES_PORT` - Docker port mapping
- `REDIS_PORT` - Docker port mapping
- `GRAFANA_PORT` - Docker port mapping
- `REDIS_URL` - For Redis backend
- `METRICS_BEARER_TOKEN` - Prometheus auth

### Process Management ⭐

**PM2 Configuration**:
```javascript
apps: [{
  name: "pcs-server",
  script: "server/dist/index.js",
  exec_mode: "fork",
  instances: 1,
  autorestart: true,
  restart_delay: 5000,
  min_uptime: "10s",
  kill_timeout: 20000,
  max_memory_restart: "512M"
}]
```

**Features**:
- Single process fork mode (no clustering)
- Auto-restart on failure (5s delay)
- Memory limit: 512MB (restart threshold)
- Graceful shutdown: 20 second timeout

### Build & Deployment Pipeline ✅

**Pre-deploy**:
```bash
npm ci                # Install exact versions
npm run lint         # Strict linting
npm run build        # TypeScript + Vite build
npm run test:integration  # Integration tests
```

**Build Hardening** 🔒:
- Clean `client/dist` before build (no stale bundles)
- No source maps in production
- Deterministic output (`rm -rf dist && tsc`)

**Deployment**:
```bash
npm ci
npm run build
pm2 startOrRestart ecosystem.config.cjs
```

**Post-deploy Smoke Tests**:
```bash
curl http://127.0.0.1:4000/api/health/live    # Liveness
curl http://127.0.0.1:4000/api/health/ready   # Readiness
curl http://127.0.0.1:4000/api/metrics        # Metrics
```

### Database Migrations 🔄

**Migration System**:
- Custom Node script: `server/src/scripts/migrateDb.ts`
- Version tracking in `schema_migrations` table
- SQL-based migrations stored in `server/sql/migrations/`
- Seed script: `seedDb.ts` (demo data)

**Initialization**:
```bash
npm run db:init      # Run migrations
npm run db:seed      # Load demo data
```

### Operational Scripts 📋

**Available Commands**:
- `npm run db:migrate` - Run pending migrations
- `npm run db:seed` - Load seed data
- `npm run news:cleanup-media` - Clean old media (7d default)
- `npm run auth:cleanup-tokens` - Revoke expired tokens
- `npm run auth:promote-admin` - Grant admin role
- `npm run auth:demote-admin` - Revoke admin role
- `npm run email:outbox-worker` - Process email queue

### Potential Deployment Concerns ⚠️

1. **Single PM2 instance** - No load balancing or clustering
2. **Memory limit** (512MB) - May be tight for large operations
3. **No rolling deployment** strategy visible
4. **Database backup** strategy not documented
5. **Redis not required** - Graceful degradation assumed

---

## 10. MONITORING & OBSERVABILITY

### Metrics Collection ⭐ **Prometheus-Ready**

**Prometheus Integration**:
- Scrape endpoint: `/api/metrics`
- Authentication: Bearer token (`METRICS_BEARER_TOKEN`)
- Format: Prometheus text format
- Scrape interval: 15 seconds
- Evaluation interval: 30 seconds

### Metrics Collected 📊

**Implemented**:
1. **Authentication Metrics**:
   - `auth_failures_total[route, code]` - Auth failure count
   - `refresh_failures_total[route, code]` - Token refresh failures
   - Per-error-code tracking

2. **Email Metrics**:
   - `email_failures_total[reason]` - Email failure count

3. **HTTP Metrics**:
   - `http_request_duration_seconds[route]` - Request duration histogram
   - Latency observation in nanoseconds, converted to seconds

### Alert Rules 📢

**File**: `monitoring/prometheus/alerts.pcs.yml`
- Rules defined but content not visible in analysis
- Likely includes:
  - High error rate threshold
  - High latency threshold
  - Service down detection

### Dashboards 📈

**Grafana Integration**:
- Dashboard provisioning via `monitoring/grafana/provisioning/`
- Dashboard files in `monitoring/grafana/dashboards/`
- JSON API overview in `pcs-api-overview.json`
- Admin credentials via secret file

### Logging Strategy 🔍

**Log Aggregation**:
- Pino JSON logs to stdout
- Can be piped to:
  - ELK stack (Elasticsearch, Logstash, Kibana)
  - Datadog
  - Splunk
  - CloudWatch
  - Other collectors

**Log Format**:
- ISO timestamp
- Log level (info, warn, error)
- Request ID (for correlation)
- Structured fields (code, status, err)

### Health Checks 💚

**Endpoints**:
- `GET /api/health/live` - Process alive?
- `GET /api/health/ready` - Accept traffic?

### Observability Gaps ⚠️

1. **Distributed tracing** (OpenTelemetry) not visible
2. **Application Performance Monitoring (APM)** not configured
3. **Custom business metrics** not defined (volunteer signups, news publishes)
4. **Frontend metrics** (performance, errors) not integrated
5. **Database query logging** only in development
6. **Alert threshold values** not documented
7. **Metric retention** policy not specified
8. **Dashboard documentation** not visible

---

## SUMMARY SCORECARD

| Area | Score | Notes |
|------|-------|-------|
| **Performance** | 7.5/10 | Good bundling, caching. Missing compression, CDN, image optimization. |
| **Security** | 9/10 | Excellent crypto, CORS, CSP, auth. Minor: HTTPS enforcement, audit delay tolerance. |
| **Testing** | 8/10 | Strong server tests. Weak client tests. Good E2E. No security/load testing. |
| **Error Handling** | 9/10 | Canonical codes, structured logging, good instrumentation. |
| **Code Quality** | 9/10 | Strong architecture, type-safe, centralized routing. Minor: documentation. |
| **Database** | 8.5/10 | Clean schema, good relationships. Missing indexes, migration versioning. |
| **API Design** | 8.5/10 | Consistent format, pagination confusion, no versioning. |
| **Frontend State** | 8/10 | React Query well-used. Limited testing. Offline strategy unclear. |
| **Infrastructure** | 8.5/10 | Good containerization, process management. Single instance, minimal load testing. |
| **Monitoring** | 7.5/10 | Prometheus, Grafana, health checks. Missing distributed tracing, APM, custom metrics. |

**Overall**: 8.2/10 - **Production-Ready with Strong Fundamentals**

---

## RECOMMENDATIONS (Priority Order)

### 🔴 High Priority
1. **Increase client-side test coverage** - Add React Query hook tests, component integration tests
2. **Add security test suite** - OWASP validation, injection tests, auth edge cases
3. **Implement distributed tracing** - OpenTelemetry for cross-service correlation
4. **Document cache invalidation strategy** - Explicit patterns for React Query
5. **Add database indexes** - Analyze query patterns, add missing indexes

### 🟡 Medium Priority
1. **Add compression middleware** - gzip/brotli for responses
2. **Implement load testing** - k6 or JMeter for performance baseline
3. **Add custom business metrics** - Signup success rate, news engagement
4. **Document migration versioning** - Explicit version control strategy
5. **Implement API versioning** - v1/, v2/ paths for backward compatibility

### 🟢 Low Priority
1. **Add service worker** - Offline support, PWA features
2. **Implement image optimization** - WebP, AVIF with fallbacks
3. **Add sourcemap generation** - For production debugging (securely)
4. **Expand monitoring dashboard** - More detailed business metrics
5. **Document deployment playbook** - Rollback procedures, runbooks

---

## APPENDIX: Key Files Reference

**Server**:
- Authentication: `server/src/modules/auth/`
- Error handling: `server/src/lib/errors.ts`, `server/src/appCore/errorHandler.ts`
- Logging: `server/src/lib/logger.ts`
- Routing: `server/src/appCore/apiRouteRegistry.ts`
- Middleware: `server/src/appCore/middleware.ts`
- Rate limiting: `server/src/lib/rateLimit.ts`
- Database: `server/prisma/schema.prisma`

**Client**:
- API services: `client/src/services/`
- Hooks: `client/src/features/**/hooks/`
- Routing: `client/src/app/routes.tsx`
- Auth provider: `client/src/app/providers.tsx`

**Infrastructure**:
- Compose: `docker-compose.yml`
- PM2: `ecosystem.config.cjs`
- Prometheus: `monitoring/prometheus/prometheus.local.yml`
- Grafana: `monitoring/grafana/provisioning/`
- Monitored: `monitoring/grafana/dashboards/`

**Documentation**:
- API routing: `docs/api-routing.md`
- Production: `docs/runbook.production.md`

---

*Analysis completed: April 2026 | PCS Platform v2.0.0*
