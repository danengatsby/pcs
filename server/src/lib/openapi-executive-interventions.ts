import { interventionKinds, expirySources } from "../modules/executiveDashboard/interventions.schema.js";

const count = { type: "integer", minimum: 0 };
const pagination = [
  { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
  { name: "offset", in: "query", schema: { ...count, maximum: 100000, default: 0 } },
];
const success = (data: Record<string, unknown>) => ({ description: "Private, territorially scoped data", content: { "application/json": { schema: {
  type: "object", required: ["data", "error", "meta"], properties: { data, error: { nullable: true }, meta: { $ref: "#/components/schemas/ApiMeta" } },
} } } });
export const executiveInterventionSchemas = {
  ExecutiveInterventions: {
    type: "object", required: ["generatedAt", "rows", "counts", "total", "limit", "offset", "expiryCoverage"], additionalProperties: false,
    properties: {
      generatedAt: { type: "string", format: "date-time" }, total: count, limit: count, offset: count,
      counts: { type: "object", additionalProperties: false, properties: Object.fromEntries(interventionKinds.map((key) => [key, count])) },
      expiryCoverage: { type: "object", required: ["tracked", "missing", "windowDays"], properties: { tracked: count, missing: count, windowDays: { type: "integer", enum: [30] } } },
      rows: { type: "array", items: { type: "object", required: ["key", "kind", "title", "context", "priority", "dueAt", "href", "targetId", "parentId"], properties: {
        key: { type: "string" }, kind: { type: "string", enum: interventionKinds }, title: { type: "string" }, context: { type: "string" },
        priority: { type: "string", enum: ["critical", "high", "normal"] }, dueAt: { type: "string", format: "date-time", nullable: true },
        href: { type: "string" }, targetId: { type: "string" }, parentId: { type: "string", nullable: true },
      } } },
    },
  },
  ExecutiveExpirationUpdate: {
    type: "object", required: ["expiresOn", "expectedExpiresOn"], additionalProperties: false,
    properties: { expiresOn: { type: "string", format: "date", nullable: true }, expectedExpiresOn: { type: "string", format: "date", nullable: true } },
  },
};
export const executiveInterventionPaths = {
  "/admin/executive-dashboard/interventions": { get: {
    operationId: "listExecutiveInterventions", tags: ["Executive Dashboard"], summary: "List prioritized operational interventions before statistics",
    description: "Requires executive.read. Source capabilities and territory apply to each queue. More than 48h uncontacted; current active mandates; overdue unfinished objectives; draft/open events without coordinator; reported activity without subsequent review; explicit record expirations within 30 calendar days UTC, including expired records. Counts are computed before pagination.",
    security: [{ BearerAuth: [] }], parameters: [...pagination, { name: "kind", in: "query", schema: { type: "string", enum: interventionKinds } }],
    responses: { "200": success({ $ref: "#/components/schemas/ExecutiveInterventions" }), "400": { description: "Invalid filter" }, "401": { description: "Unauthorized" }, "403": { description: "Executive capability and active mandate required" } },
  } },
  "/admin/executive-dashboard/expirations": { get: {
    operationId: "listExecutiveExpirations", tags: ["Executive Dashboard"], summary: "Read explicit expiration metadata, including records with no recorded date",
    security: [{ BearerAuth: [] }], parameters: [...pagination, { name: "record", in: "query", schema: { type: "string", pattern: "^(document|mandate_decision|congress_decision|arbitration_decision):[1-9][0-9]*$" } }],
    responses: { "200": success({ type: "object", required: ["rows", "total", "canManage", "limit", "offset"], properties: {
      total: count, limit: count, offset: count, record: { type: "string" }, canManage: { type: "boolean" },
      rows: { type: "array", items: { type: "object", required: ["source", "id", "title", "expiresOn"], properties: { source: { type: "string", enum: expirySources }, id: { type: "string" }, title: { type: "string" }, expiresOn: { type: "string", format: "date", nullable: true } } } },
    } }), "400": { description: "Invalid filter" }, "401": { description: "Unauthorized" }, "403": { description: "Executive capability required" } },
  } },
  "/admin/executive-dashboard/expirations/{source}/{id}": { patch: {
    operationId: "updateExecutiveExpiration", tags: ["Executive Dashboard"], summary: "Record an explicit expiration date with audit and optimistic concurrency",
    description: "Requires executive.targets (national presidency). Null means no recorded deadline, not unlimited validity. Does not change publication or legal effect.",
    security: [{ BearerAuth: [] }], parameters: [{ name: "source", in: "path", required: true, schema: { type: "string", enum: expirySources } }, { name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[1-9][0-9]*$" } }],
    requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ExecutiveExpirationUpdate" } } } },
    responses: { "200": success({ type: "object", properties: { source: { type: "string" }, id: { type: "string" }, expiresOn: { type: "string", format: "date", nullable: true } } }), "400": { description: "Invalid date or input" }, "401": { description: "Unauthorized" }, "403": { description: "National target-management capability required" }, "404": { description: "Record outside authorized registry" }, "409": { description: "Concurrent expiration update" } },
  } },
};
