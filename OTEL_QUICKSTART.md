# OpenTelemetry + Jaeger - Quick Start Guide

> Note: the server currently exports standard OpenTelemetry traces for HTTP, `pg`, and Redis. The older request-level N+1 detector has been removed because it did not observe Prisma queries reliably.

## 📋 Prerequisites

- Docker & Docker Compose running
- Node.js 20+ installed
- npm workspaces support (already configured)

## 🚀 Quick Start (5 minutes)

### Step 1: Start Jaeger Backend

```bash
cd /var/www/pcs
docker-compose --profile monitoring up -d jaeger
```

Verify it's running:
```bash
curl http://localhost:16686/api/health
# Expected response: empty (status 204)
```

### Step 2: Create `.env` for Server Tracing

Create or update `/var/www/pcs/server/.env`:

```bash
# Add these lines to enable tracing
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

### Step 3: Create `.env` for Client Tracing

Create `/var/www/pcs/client/.env`:

```bash
# Client-side tracing
VITE_OTEL_ENABLED=true
VITE_OTEL_EXPORTER_URL=http://localhost:4318/v1/traces
```

### Step 4: Build the Application

```bash
# Build server
npm run build --workspace server

# Build client
npm run build --workspace client
```

### Step 5: Run the Application

#### Option A: Development Mode (Recommended for testing)

```bash
# Terminal 1: Start server
npm run dev --workspace server

# Terminal 2: Start client
npm run dev --workspace client
```

#### Option B: Production Build

```bash
# Terminal 1: Start production server
npm run start --workspace server

# Terminal 2: Serve client via server (it's a SPA, already included)
# (Server provides client via the SPA fallback route)
```

### Step 6: Generate Traffic

Open browser and interact with the application:
```
http://localhost:5173  # Vite dev server (development mode)
or
http://localhost:5000  # Express server (production mode)
```

Actions to generate traces:
- Click navigation links
- Load pages with API calls (News page, Contact form, Admin areas)
- Submit forms

### Step 7: View Traces in Jaeger UI

1. Open: http://localhost:16686
2. Select service: `pcs-server` or `pcs-client`
3. Click "Find Traces"
4. Click on a trace to view details

## 🔍 What to Look For

### Server Traces (`pcs-server`)

- **HTTP Requests**: Each page load or API call appears as a trace
  - Attributes show: method, status code, URL path
  - Duration shows request latency

- **Database Queries**: Each query shows as an event
  - Look for `prisma_query` events
  - Attributes show: action (SELECT/INSERT/UPDATE), model, duration

- **N+1 Patterns**: Check logs and span events
  - Server logs show "N+1 query patterns detected" warnings
  - Traces show suspicious_pattern_count in span events

### Client Traces (`pcs-client`)

- **Page Loads**: Navigation events
  - `page_view_*` spans show page navigation
  - Attributes: page name, path, URL

- **HTTP Requests**: Fetch/XHR calls
  - Shows request method and response status
  - Timing breakdown for each request

- **User Interactions**: Clicks and form submissions
  - `user_action_*` spans for tracked actions

## 📊 Example Trace Analysis

### Finding an N+1 Problem

1. In Jaeger UI, click on a trace for **pcs-server**
2. Look for span with high `db.query_count` (e.g., 50) but low `db.unique_queries` (e.g., 2)
3. Click on the span to see events
4. Find `n1_queries_detected` event
5. Check server logs for detailed pattern info

### Example Output (Server Logs)

```
N+1 query patterns detected
url: /api/news/details
totalQueries: 51
uniqueQueries: 2
suspiciousPatterns: [
  {
    query: "SELECT ... FROM news_category WHERE id = $N",
    count: 50,
    severity: "high"
  }
]
```

This means: "50 similar queries for categories, but only 2 unique query types - likely loading a category for each news item!"

## 🛠️ Troubleshooting

### Traces Not Appearing

**Check 1: Is Jaeger running?**
```bash
docker-compose ps | grep jaeger
# Should show pcs-jaeger container running
```

**Check 2: Is tracing enabled?**
```bash
grep OTEL_ENABLED server/.env client/.env
# Should show: OTEL_ENABLED=true or VITE_OTEL_ENABLED=true
```

**Check 3: Are packages installed?**
```bash
ls node_modules/@opentelemetry/
# Should show many packages
```

### High CPU/Memory Usage

**Solution**: reduce trace volume in `.env` or disable tracing temporarily:
```bash
OTEL_ENABLED=false
```

### "Cannot reach Jaeger" Error

**Solution**: Verify docker network:
```bash
docker-compose down
docker-compose --profile monitoring up -d jaeger
```

## 📈 Performance Configuration

### For Production

Update `.env`:
```bash
# Reduce sampling to 10% of requests
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1

# Skip health checks
# (Already configured in telemetry.ts)
```

### For Heavy Load

```bash
# Batch span processor settings (automatic)
# Collects 500 spans before sending
# Flushes every 5 seconds

# Adjust if needed by modifying server/src/lib/telemetry.ts
```

## 🔗 Useful Links

- **Jaeger UI**: http://localhost:16686
- **Jaeger API Health**: http://localhost:16686/api/health
- **OTLP Receiver**: http://localhost:4317 (gRPC) or http://localhost:4318 (HTTP)

## 💡 Tips & Tricks

### Filter Traces by Endpoint

In Jaeger UI:
1. Select service and time range
2. Add tag filter: `http.target = /api/news`
3. Click "Find Traces"

### Export Trace

Click trace → JSON icon to see raw trace data

### Search by Error

1. Select service
2. Select "Tags" tab
3. Filter: `error.type = *`
4. Find Traces

## 📝 Next Steps

1. **Set Up Alerts**: Configure alerts based on:
   - High latency (> 1000ms)
   - Error rate (> 1%)
   - N+1 query patterns

2. **Custom Instrumentation**: Add tracing to your domain logic:
   ```typescript
   import { trace } from '@opentelemetry/api';

   const tracer = trace.getTracer('my-app');
   const span = tracer.startActiveSpan('my-operation', (span) => {
     // Your code
     span.end();
   });
   ```

3. **Production Deployment**:
   - Export to centralized Jaeger instance
   - Configure retention policies
   - Set up dashboards

4. **Performance Testing**:
   - Use Jaeger traces to validate optimization efforts
   - Compare before/after latency metrics

## 🎯 Mission: Debug Production Issues End-to-End

With OpenTelemetry + Jaeger, you can now:

✅ **Trace entire request** from client click → network → server → database → response
✅ **Identify bottlenecks** with millisecond-level timing
✅ **Detect N+1 queries** automatically with pattern matching
✅ **Correlate errors** across client and server
✅ **Replay requests** for development/testing

---

**Questions?** Check `OTEL_JAEGER_GUIDE.md` for detailed documentation.
