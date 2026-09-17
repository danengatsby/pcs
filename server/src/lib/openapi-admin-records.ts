import { treasuryCategories, treasuryKinds, treasuryStatuses } from "../modules/treasury/treasury.schema.js";
import { parliamentaryChambers, parliamentaryKinds, parliamentaryStatuses } from "../modules/parliamentary/parliamentary.schema.js";

const text = (maxLength: number, minLength = 0) => ({ type: "string", minLength, maxLength });
const enumeration = (values: readonly string[]) => ({ type: "string", enum: values });
const date = { type: "string", format: "date" };
const version = { type: "integer", minimum: 1 };
const requestId = { type: "string", format: "uuid" };
const object = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const treasury = {
  organizationId: { ...text(80, 1), nullable: true }, kind: enumeration(treasuryKinds), category: enumeration(treasuryCategories),
  amount: { type: "string", pattern: "^(0|[1-9]\\d{0,8})(\\.\\d{1,2})?$", description: "Positive RON decimal; at most two decimal places. Stored as integer bani." },
  occurredOn: date, description: text(500, 5), reference: text(180, 3),
};
const parliamentary = {
  title: text(240, 5), kind: enumeration(parliamentaryKinds), chamber: enumeration(parliamentaryChambers), reference: text(100),
  sourceUrl: { ...text(2000), description: "Empty or HTTPS URL without credentials." }, description: text(10000, 10),
  assignedTo: { type: "string", pattern: "^[1-9]\\d{0,14}$", nullable: true }, dueOn: { ...date, nullable: true },
};
export const administrativeRecordsSchemas = {
  TreasuryCreateInput: object({ ...treasury, requestId }), TreasuryUpdateInput: object({ ...treasury, version }),
  TreasuryPostInput: object({ version, confirmed: { type: "boolean", enum: [true] } }),
  TreasuryVoidInput: object({ version, reason: text(2000, 10) }),
  ParliamentaryCreateInput: object({ ...parliamentary, requestId }), ParliamentaryUpdateInput: object({ ...parliamentary, version }),
  ParliamentaryTransitionInput: object({ version, status: enumeration(parliamentaryStatuses), reason: text(2000, 10) }),
};
const pageParameters = [
  { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } },
  { name: "offset", in: "query", schema: { type: "integer", minimum: 0, maximum: 10000, default: 0 } },
  { name: "search", in: "query", schema: text(120) },
];
function operation(operationId: string, summary: string, capability: string, options: { body?: string; id?: boolean; created?: boolean; parameters?: unknown[] } = {}) {
  return {
    operationId, summary, tags: ["Administrative Records"], security: [{ BearerAuth: [] }],
    description: `Requires ${capability}, an individual MFA session and an active national mandate. Records are internal; changes are audited.`,
    parameters: [...(options.parameters ?? []), ...(options.id ? [{ name: "id", in: "path", required: true, schema: requestId }] : [])],
    ...(options.body ? { requestBody: { required: true, content: { "application/json": { schema: { $ref: `#/components/schemas/${options.body}` } } } } } : {}),
    responses: {
      [options.created ? "201" : "200"]: { description: "Success", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccessResponse" } } } },
      "400": { description: "Invalid input or assignee" }, "401": { description: "Authentication and MFA required" },
      "403": { description: "Duty profile or national mandate required" }, "404": { description: "Record not found" },
      "409": { description: "Stale version, conflicting request ID or invalid transition" },
    },
  };
}
export const administrativeRecordsPaths = {
  "/admin/treasury/entries": {
    get: operation("listTreasuryEntries", "List treasury entries with posted totals across all matching pages", "finance.read", { parameters: [...pageParameters,
      { name: "kind", in: "query", schema: enumeration(treasuryKinds) }, { name: "status", in: "query", schema: enumeration(treasuryStatuses) }, { name: "year", in: "query", schema: { type: "integer", minimum: 2000, maximum: 2100 } },
    ] }),
    post: operation("createTreasuryEntry", "Create a draft; repeated identical requestId is idempotent", "finance.manage", { body: "TreasuryCreateInput", created: true }),
  },
  "/admin/treasury/entries/{id}": { patch: operation("updateTreasuryEntry", "Edit a draft with optimistic concurrency", "finance.manage", { body: "TreasuryUpdateInput", id: true }) },
  "/admin/treasury/entries/{id}/post": { post: operation("postTreasuryEntry", "Confirm a draft and include it in totals", "finance.manage", { body: "TreasuryPostInput", id: true }) },
  "/admin/treasury/entries/{id}/void": { post: operation("voidTreasuryEntry", "Void an entry with a retained reason; never delete it", "finance.manage", { body: "TreasuryVoidInput", id: true }) },
  "/admin/treasury/entries/{id}/history": { get: operation("treasuryEntryHistory", "Read the last 50 attributed treasury changes", "finance.read", { id: true }) },
  "/admin/parliamentary/items": {
    get: operation("listParliamentaryItems", "List parliamentary work, responsible people and deadlines", "parliamentary.read", { parameters: [...pageParameters,
      { name: "status", in: "query", schema: enumeration(parliamentaryStatuses) }, { name: "chamber", in: "query", schema: enumeration(parliamentaryChambers) }, { name: "pending", in: "query", schema: { type: "string", enum: ["true", "false"], default: "false" } },
    ] }),
    post: operation("createParliamentaryItem", "Create an internal work item with an idempotent request ID", "parliamentary.manage", { body: "ParliamentaryCreateInput", created: true }),
  },
  "/admin/parliamentary/assignees": { get: operation("listParliamentaryAssignees", "List named people with active national parliamentary duties", "parliamentary.read") },
  "/admin/parliamentary/items/{id}": { patch: operation("updateParliamentaryItem", "Edit open parliamentary work with a version check", "parliamentary.manage", { body: "ParliamentaryUpdateInput", id: true }) },
  "/admin/parliamentary/items/{id}/status": { post: operation("transitionParliamentaryItem", "Record a justified stage change without submitting documents externally", "parliamentary.manage", { body: "ParliamentaryTransitionInput", id: true }) },
  "/admin/parliamentary/items/{id}/history": { get: operation("parliamentaryItemHistory", "Read the last 50 attributed parliamentary changes", "parliamentary.read", { id: true }) },
};
