# OpenTelemetry + Jaeger Tracing Implementation

> Note: the current server setup provides OpenTelemetry traces for HTTP, `pg`, and Redis. Older N+1 detection notes in this document describe a removed experiment and should not be treated as active runtime behavior.

## Overview

This document describes the distributed tracing setup for the PCS application using OpenTelemetry and Jaeger. The implementation enables end-to-end visibility into application performance across client and server.

## Architecture

```
┌─────────────────────┐
│    React Client     │
│  (Web Telemetry)    │
└──────────┬──────────┘
           │
           │ OTLP HTTP
           │
┌──────────▼──────────┐         ┌──────────────────┐
│   Node.js Server    │────────→│  Jaeger Collector│
│  (OTEL Tracing)     │         │  (Port 4317/4318)│
└─────────────────────┘         └────────┬─────────┘
           │                             │
           │ (via OpenTelemetry)         │
           │                             │
           └────────────────────────────┘
                    ↓
           ┌────────────────────┐
           │  Jaeger Backend    │
           │  Storage (Memory)  │
           └────────┬───────────┘
                    │
           ┌────────▼───────────┐
           │   Jaeger UI        │
           │ (Port 16686)       │
           └────────────────────┘
```

## Features

### 1. Server-Side Tracing
- **HTTP Instrumentation**: Automatic tracing of Express/Fastify requests
- **Database Tracing**: Prisma ORM query tracking with OpenTelemetry `pg` instrumentation
- **Redis Tracing**: Request tracking for cache operations
- **Custom Spans**: Manual span creation for complex operations

### 2. N+1 Query Detection
Automatic pattern detection for common N+1 problems:
- Simple SELECT by ID repeated in loops
- SELECT by field value patterns
- List operations followed by cascading detail queries

### 3. Client-Side Tracing
- **Fetch/XHR Instrumentation**: Automatic HTTP request tracking
- **Page Navigation**: Route change tracking
- **User Interactions**: Click and form submission tracking
- **Component Renders**: Performance metrics for React components

## Setup

### Prerequisites
- Docker Compose
- Node.js 20+
- npm workspace support

### 1. Start Jaeger Backend

```bash
# Using docker-compose with monitoring profile
docker-compose --profile monitoring up -d jaeger

# Verify Jaeger is running
curl http://localhost:16686/api/health
```

### 2. Enable Tracing in Environment

**For Local Development:**

```bash
# .env or .env.development
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

**For Client:**

Create or update `.env` in the `client` directory:

```bash
VITE_OTEL_ENABLED=true
VITE_OTEL_EXPORTER_URL=http://localhost:4318/v1/traces
```

### 3. Install Dependencies

```bash
npm install --workspace server
npm install --workspace client
```

### 4. Build and Run

```bash
# Using development servers
npm run dev --workspace server
npm run dev --workspace client

# OR using production build
npm run build --workspace server
npm run start --workspace server
```

## Usage

### Viewing Traces in Jaeger UI

1. Open browser: http://localhost:16686
2. Select service from dropdown:
   - `pcs-server` - Backend traces
   - `pcs-client` - Frontend traces
3. Click "Find Traces" to load recent traces
4. Click on a trace to view details

### Understanding Trace Timeline

Each trace shows:
- **Trace ID**: Unique identifier for complete request
- **Span ID**: Individual operation within trace
- **Duration**: Total and per-operation timing
- **Tags**: Metadata about the span
- **Events**: Important moments (queries, errors, etc.)

### N+1 Query Detection

#### How It Works

1. **Query Collection**: Each database operation with Prisma is tracked
2. **Pattern Normalization**: Queries are normalized (parameters replaced with placeholders)
3. **Duplicate Detection**: Identical query patterns are counted
4. **Severity Assignment**:
   - Low: 5-10 duplicate patterns
   - Medium: 11-20 duplicate patterns
   - High: 20+ duplicate patterns

#### Example N+1 Problem

**Bad Pattern (N+1):**
```typescript
// Loads 1 list query + N individual queries
const users = await prisma.user.findMany();
for (const user of users) {
  const profile = await prisma.profile.findUnique({
    where: { userId: user.id } // This repeats for each user!
  });
}
```

**What You'll See in Logs:**
```
N+1 query patterns detected
url: /api/users
totalQueries: 51
uniqueQueries: 2
suspiciousPatterns: [
  {
    query: "SELECT profile FROM profile WHERE userId = $N",
    count: 50,
    severity: "high"
  }
]
```

**Better Pattern (Using Relationships):**
```typescript
// Single query with include
const users = await prisma.user.findMany({
  include: { profile: true }
});
```

#### Finding N+1 Issues

1. Check server logs for "N+1 query patterns detected" warnings
2. Or check Jaeger traces for spans with high query counts:
   - Click on a trace
   - Look for `db.query_count` attribute
   - Compare with `db.unique_queries` - if count >> unique, likely N+1

### Custom Instrumentation

#### Adding Spans to Your Code

```typescript
import { trace } from '@opentelemetry/api';

export async function complexOperation() {
  const tracer = trace.getTracer('my-app', '1.0.0');

  return tracer.startActiveSpan('complex-operation', async (span) => {
    try {
      span.setAttributes({
        'operation.type': 'data-processing',
        'batch.size': 100,
      });

      // Your code here
      const result = await processData();

      span.addEvent('processing_complete', {
        'result.count': result.length,
      });

      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: 'ERROR' });
      throw error;
    }
  });
}
```

#### Client-Side Tracking

```typescript
import { trackUserAction, trackPageNavigation } from '@/lib/telemetry';

// Track navigation
useEffect(() => {
  trackPageNavigation('NewsDetail', location.pathname);
}, [location.pathname]);

// Track user actions
function handleSubmit(data: FormData) {
  trackUserAction('form_submit', {
    form_name: 'contact',
    field_count: Object.keys(data).length,
  });
  // Your submit code
}
```

## Production Deployment

### Configuration

For production, configure Jaeger to export to a centralized backend:

```bash
# .env.production
OTEL_ENABLED=true

# Send traces to centralized Jaeger collector
OTEL_EXPORTER_OTLP_ENDPOINT=https://jaeger-collector.example.com/v1/traces

# Adjust sampling based on traffic volume
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1  # Sample 10% of traces
```

### Resource Allocation

**Server Memory**: OpenTelemetry adds ~50-100MB per container
**Network**: ~100KB per 1000 traces
**Storage**: Depends on retention policy (default: 7 days)

### Performance Impact

- **Latency**: < 1ms per request (minimal)
- **Throughput**: Negligible impact with batch processor
- **CPU**: ~5-10% overhead for high-traffic applications

## Troubleshooting

### Traces Not Appearing in Jaeger UI

1. **Check Jaeger is running:**
   ```bash
   curl http://localhost:16686/api/health
   ```

2. **Verify tracing is enabled:**
   ```bash
   # Check logs
   docker-compose logs jaeger
   ```

3. **Check environment variables:**
   ```bash
   env | grep OTEL
   ```

4. **Verify network connectivity:**
   ```bash
   # From server container
   curl http://jaeger:4318/v1/traces -X POST
   ```

### Detailed Query Analysis Not Available

1. Verify OpenTelemetry is enabled with `OTEL_ENABLED=true`
2. Confirm traces are reaching the collector endpoint
3. Remember that the current runtime does not include a Prisma-aware request-level N+1 detector

### High Memory Usage

1. Reduce sampling rate: `OTEL_TRACES_SAMPLER_ARG=0.01` (1%)
2. Enable batch processing (default): reduced memory overhead
3. Lower collector batch size if needed

## Performance Tips

### 1. Sampling
Don't trace everything in production:
```bash
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1  # 10% of traces
```

### 2. Filtering
Skip internal/health endpoints:
```typescript
// In telemetry.ts
requestHook: (_span, { request }) => {
  if (request.url?.includes('/health')) {
    return false;  // Don't trace this endpoint
  }
}
```

### 3. Batch Processing
Already configured with batch span processor - adjusts automatically

### 4. Query Filtering
Sensitive queries are automatically sanitized:
- Passwords, tokens, secrets are replaced with `***`
- Long values are truncated

## Metrics Available

### Server Metrics
- `http.method` - HTTP method (GET, POST, etc.)
- `http.status_code` - Response status
- `http.target` - Request URL
- `http.response_content_length` - Response size
- `db.operation` - Database operation (query, insert, update, etc.)
- `db.query_count` - Total queries in request
- `db.unique_queries` - Distinct query patterns

### Client Metrics
- `page.name` - Current page name
- `page.path` - Current route path
- `action.name` - User action name
- `component.name` - React component name
- `http.request.method` - Fetch/XHR method
- `http.response.status_code` - Response status

## Next Steps

1. **Extend Service**: Add tracing to custom services/libraries
2. **Alerting**: Configure alerts based on trace metrics (high latency, error rates)
3. **Correlation**: Link traces to logs using Trace ID
4. **Custom Exporters**: Export to alternative backends (Datadog, New Relic, etc.)

## References

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [OpenTelemetry Node.js](https://opentelemetry.io/docs/instrumentation/js/getting-started/nodejs/)
- [OpenTelemetry Web](https://opentelemetry.io/docs/instrumentation/js/getting-started/)
