import assert from "node:assert/strict";
import test from "node:test";
import type { ZodTypeAny } from "zod";
import { getApiRouteDefinitions } from "../../appCore/apiRouteRegistry.js";
import { packageVersion } from "../../lib/buildInfo.js";
import { openApiSpec } from "../../lib/openapi-spec.js";
import { emailTestSchema } from "../../modules/admin/admin.shared.js";
import { refreshCsrfHeaderName } from "../../modules/auth/types.js";
import { signinSchema, signupSchema } from "../../modules/auth/validation.js";
import { memberWorkflowStatuses } from "../../modules/members/members.schema.js";
import {
  membershipActionSchema,
  membershipActions,
  membershipStatuses,
} from "../../modules/members/adminDashboard.schema.js";
import { updateExecutiveTargetSchema } from "../../modules/executiveDashboard/executiveDashboard.schema.js";
import { expiryUpdateSchema } from "../../modules/executiveDashboard/interventions.schema.js";
import { mobilizationResponseSchema } from "../../modules/mobilization/mobilization.schema.js";
import {
  memberConsentSchema,
  memberEventResponseSchema,
  memberTaskReportSchema,
} from "../../modules/memberPortal/memberPortal.schema.js";
import {
  addPoliticalParticipantSchema,
  createPoliticalOperationSchema,
  updatePoliticalOperationSchema,
  updatePoliticalParticipantSchema,
} from "../../modules/politicalOperations/politicalOperations.schema.js";
import {
  communicationAudienceSchema,
  createCommunicationDispatchSchema,
} from "../../modules/communications/communications.schema.js";
import {
  createOrganizationMandateSchema,
  createOrganizationObjectiveSchema,
  createOrganizationSchema,
  updateOrganizationMandateSchema,
  updateOrganizationObjectiveSchema,
  updateOrganizationSchema,
} from "../../modules/organizations/organizations.schema.js";
import { newsWriteSchema } from "../../modules/news/schema.js";
import { newsMediaKindValues, newsStatusValues } from "../../modules/news/types.js";
import { volunteerSchema, workflowUpdateSchema } from "../../modules/volunteers/schema.js";
import {
  volunteerContactChannelValues,
  volunteerPriorityValues,
  volunteerStatusValues,
} from "../../modules/volunteers/types.js";

type OpenApiOperation = {
  parameters?: Array<{ name: string; schema?: Record<string, unknown> }>;
  security?: Array<Record<string, string[]>>;
  responses?: Record<string, unknown>;
  requestBody?: {
    content?: Record<string, { schema?: Record<string, unknown> }>;
  };
};

type OpenApiComponentSchema = {
  required?: string[];
  properties?: Record<string, unknown>;
  additionalProperties?: boolean;
  enum?: string[];
};

const httpMethods = new Set(["get", "post", "put", "patch", "delete"]);

test("openapi contract: administrative task counts are authenticated and contain no individual records", () => {
  const operation = readOperation("/admin/tasks", "get");
  assert.deepEqual(operation.security, [{ BearerAuth: [] }]);
  assert.deepEqual(operation.parameters, []);
  const schema = openApiSpec.components.schemas.AdminTasks;
  assert.deepEqual(schema.required, ["generatedAt", "counts", "total"]);
  assert.deepEqual(Object.keys(schema.properties.counts.properties).sort(), ["arbitration", "congresses", "members", "mobilization", "organizations", "volunteers"]);
  for (const path of ["/admin/congresses", "/admin/arbitration/cases"]) {
    assert.deepEqual(readOperation(path, "get").security, [{ BearerAuth: [] }]);
    assert.deepEqual(readOperation(path, "post").security, [{ BearerAuth: [] }]);
  }
});

function normalizeRoutePath(path: string): string {
  return path.replace(/^\/api/, "").replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function readOperation(path: string, method: string): OpenApiOperation {
  const paths = openApiSpec.paths as Record<string, Record<string, OpenApiOperation>>;
  const operation = paths[path]?.[method];
  assert.ok(operation, `Missing OpenAPI operation for ${method.toUpperCase()} ${path}`);
  return operation;
}

function unwrapObjectSchemaShape(schema: unknown): {
  shape: () => Record<string, ZodTypeAny>;
} {
  const candidate = schema as {
    _def?: {
      shape?: () => Record<string, ZodTypeAny>;
      schema?: unknown;
      innerType?: unknown;
      sourceType?: unknown;
      out?: unknown;
    };
  };

  const directShape = candidate._def?.shape;
  if (typeof directShape === "function") {
    return {
      shape: directShape as () => Record<string, ZodTypeAny>,
    };
  }

  const nestedSchema = candidate._def?.schema
    ?? candidate._def?.innerType
    ?? candidate._def?.sourceType
    ?? candidate._def?.out;

  if (nestedSchema) {
    return unwrapObjectSchemaShape(nestedSchema);
  }

  assert.fail("Expected Zod object schema shape.");
}

function unwrapNewsWriteObjectSchema(): {
  shape: () => Record<string, ZodTypeAny>;
} {
  return unwrapObjectSchemaShape(newsWriteSchema);
}

function readComponentSchema(name: string): OpenApiComponentSchema {
  const schemas = openApiSpec.components.schemas as Record<string, OpenApiComponentSchema>;
  const schema = schemas[name];
  assert.ok(schema, `Missing OpenAPI component schema ${name}`);
  return schema;
}

function assertComponentMatchesZodObject(componentName: string, schema: unknown): void {
  const component = readComponentSchema(componentName);
  const zodShape = unwrapObjectSchemaShape(schema).shape();
  const zodPropertyNames = Object.keys(zodShape).sort();
  const zodRequiredProperties = Object.entries(zodShape)
    .filter(([, propertySchema]) => !propertySchema.isOptional())
    .map(([name]) => name)
    .sort();

  assert.deepEqual(Object.keys(component.properties ?? {}).sort(), zodPropertyNames);
  assert.deepEqual([...(component.required ?? [])].sort(), zodRequiredProperties);
  assert.equal(component.additionalProperties, false);
}

function assertParameterNames(path: string, method: string, expectedNames: string[]): void {
  const operation = readOperation(path, method);
  assert.deepEqual(operation.parameters?.map((parameter) => parameter.name) ?? [], expectedNames);
}

function assertRequestBodyRef(path: string, method: string, ref: string): void {
  const operation = readOperation(path, method);
  assert.equal(
    operation.requestBody?.content?.["application/json"]?.schema?.$ref,
    ref
  );
}

function assertPositiveIntegerPathParameter(path: string, method: string): void {
  const operation = readOperation(path, method);
  const parameter = operation.parameters?.[0];
  assert.equal(parameter?.schema?.type, "integer");
  assert.equal(parameter?.schema?.minimum, 1);
}

test("openapi contract: spec should cover the same runtime API routes", () => {
  const runtimeRoutes = getApiRouteDefinitions().map((route) => ({
    method: route.method.toLowerCase(),
    path: normalizeRoutePath(route.url),
  }));

  const documentedRoutes = Object.entries(openApiSpec.paths as Record<string, Record<string, unknown>>)
    .flatMap(([path, pathItem]) => Object.keys(pathItem)
      .filter((method) => httpMethods.has(method))
      .map((method) => ({ method, path })));

  const missingFromSpec = runtimeRoutes.filter((route) => !documentedRoutes.some(
    (candidate) => candidate.method === route.method && candidate.path === route.path
  ));
  const extraInSpec = documentedRoutes.filter((route) => !runtimeRoutes.some(
    (candidate) => candidate.method === route.method && candidate.path === route.path
  ));

  assert.deepEqual(missingFromSpec, []);
  assert.deepEqual(extraInSpec, []);
});

test("openapi contract: spec version should match package version metadata", () => {
  assert.equal(openApiSpec.info.version, packageVersion);
});

test("openapi contract: auth request schemas should match live zod schemas", () => {
  assertComponentMatchesZodObject("AuthSignupInput", signupSchema);
  assertComponentMatchesZodObject("AuthSigninInput", signinSchema);
});

test("openapi contract: volunteer and admin write schemas should match live zod schemas", () => {
  assertComponentMatchesZodObject("VolunteerSignupInput", volunteerSchema);
  assertComponentMatchesZodObject("VolunteerWorkflowUpdateInput", workflowUpdateSchema);
  assertComponentMatchesZodObject("AdminEmailTestInput", emailTestSchema);

  const schemas = openApiSpec.components.schemas as Record<string, { enum?: string[] }>;
  assert.deepEqual(schemas.VolunteerWorkflowStatus.enum, [...volunteerStatusValues]);
  assert.deepEqual(schemas.VolunteerContactChannel.enum, [...volunteerContactChannelValues]);
  assert.deepEqual(schemas.VolunteerPriority.enum, [...volunteerPriorityValues]);
});

test("openapi contract: mobilization response schema and endpoints match the public API", () => {
  assertComponentMatchesZodObject("MobilizationResponseInput", mobilizationResponseSchema);
  assertParameterNames("/mobilization/actions", "get", []);
  assertParameterNames("/mobilization/actions/{slug}/responses", "post", ["slug"]);
  assertRequestBodyRef(
    "/mobilization/actions/{slug}/responses",
    "post",
    "#/components/schemas/MobilizationResponseInput"
  );
});

test("openapi contract: political operations, member portal and consent schemas match runtime", () => {
  assertComponentMatchesZodObject("MemberEventResponseInput", memberEventResponseSchema);
  assertComponentMatchesZodObject("MemberTaskReportInput", memberTaskReportSchema);
  assertComponentMatchesZodObject("MemberConsentInput", memberConsentSchema);
  assertComponentMatchesZodObject("PoliticalOperationInput", createPoliticalOperationSchema);
  assertComponentMatchesZodObject("PoliticalOperationUpdateInput", updatePoliticalOperationSchema);
  assertComponentMatchesZodObject("PoliticalParticipantInput", addPoliticalParticipantSchema);
  assertComponentMatchesZodObject("PoliticalParticipantUpdateInput", updatePoliticalParticipantSchema);
  assertComponentMatchesZodObject("CommunicationAudienceInput", communicationAudienceSchema);
  assertComponentMatchesZodObject("CommunicationDispatchInput", createCommunicationDispatchSchema);

  assertParameterNames("/member-portal", "get", []);
  assertPositiveIntegerPathParameter("/member-portal/events/{id}/response", "post");
  assertPositiveIntegerPathParameter("/member-portal/tasks/{id}", "patch");
  assertParameterNames("/member-portal/consents", "patch", []);
  assertParameterNames("/admin/mobilization", "get", ["actionId", "type", "status", "limit"]);
  assertParameterNames("/admin/mobilization/actions", "post", []);
  assertPositiveIntegerPathParameter("/admin/mobilization/actions/{id}", "patch");
  assertPositiveIntegerPathParameter("/admin/mobilization/actions/{id}/participants", "post");
  assertPositiveIntegerPathParameter("/admin/mobilization/participants/{id}", "patch");
  assertParameterNames("/admin/communications/preview", "post", []);
  assertParameterNames("/admin/communications/dispatches", "post", []);
});

test("openapi contract: executive interventions expose scoped pagination and explicit expiration edits", () => {
  assertParameterNames("/admin/executive-dashboard/interventions", "get", ["limit", "offset", "kind"]);
  assertParameterNames("/admin/executive-dashboard/expirations", "get", ["limit", "offset", "record"]);
  assertComponentMatchesZodObject("ExecutiveExpirationUpdate", expiryUpdateSchema);
  for (const path of ["/admin/executive-dashboard/interventions", "/admin/executive-dashboard/expirations"]) {
    assert.deepEqual(readOperation(path, "get").security, [{ BearerAuth: [] }]);
  }
});

test("openapi contract: auth endpoints should expose implemented parameters and bodies", () => {
  assertParameterNames("/auth/signup", "post", ["X-Rate-Limit-Identifier"]);
  assertParameterNames("/auth/signin", "post", ["X-Rate-Limit-Identifier"]);
  assertParameterNames("/auth/refresh", "post", [refreshCsrfHeaderName]);
  assertParameterNames("/auth/signout", "post", [refreshCsrfHeaderName]);
  assertParameterNames("/auth/logout", "post", [refreshCsrfHeaderName]);
  assertParameterNames("/auth/revoke-all", "post", []);
  assertParameterNames("/auth/policy", "get", []);
  assertParameterNames("/auth/me", "get", []);

  assertRequestBodyRef("/auth/signup", "post", "#/components/schemas/AuthSignupInput");
  assertRequestBodyRef("/auth/signin", "post", "#/components/schemas/AuthSigninInput");
  assert.equal(readOperation("/auth/refresh", "post").requestBody, undefined);
});

test("openapi contract: volunteer endpoints should expose implemented parameters and bodies", () => {
  assertParameterNames("/volunteers/counties", "get", []);
  assertParameterNames("/meta/counties", "get", []);
  const paths = openApiSpec.paths as Record<string, Record<string, OpenApiOperation>>;
  assert.equal(paths["/volunteers"]?.get, undefined);
  assert.equal(paths["/volunteers/by-county"], undefined);
  const schemas = openApiSpec.components.schemas as Record<string, unknown>;
  assert.equal(schemas.VolunteerPublicItem, undefined);
  assert.equal(schemas.VolunteerCountyCountItem, undefined);
  assert.equal(schemas.VolunteerPublicRole, undefined);
  assertParameterNames("/admin/volunteers", "get", ["limit", "cursor", "status", "search", "county", "locality", "skills"]);
  assertParameterNames("/admin/volunteers/export.csv", "get", ["status", "search", "county", "locality", "skills"]);
  assertParameterNames("/admin/volunteers/owners", "get", []);
  assertParameterNames("/admin/volunteers/workflow/bulk", "patch", []);
  assertParameterNames("/admin/volunteers/bulk", "delete", []);

  assertPositiveIntegerPathParameter("/admin/volunteers/{id}", "get");
  assertPositiveIntegerPathParameter("/admin/volunteers/{id}", "delete");
  assertPositiveIntegerPathParameter("/admin/volunteers/{id}/workflow", "patch");

  assertRequestBodyRef("/volunteers", "post", "#/components/schemas/VolunteerSignupInput");
  assertRequestBodyRef("/admin/volunteers/{id}/workflow", "patch", "#/components/schemas/VolunteerWorkflowUpdateInput");
  assertRequestBodyRef("/admin/volunteers/workflow/bulk", "patch", "#/components/schemas/VolunteerBulkWorkflowUpdateInput");
  assertRequestBodyRef("/admin/volunteers/bulk", "delete", "#/components/schemas/VolunteerBulkDeleteInput");
});

test("openapi contract: public statistics describe suppression and rounding without personal fields", () => {
  assertParameterNames("/stats", "get", []);
  const stats = openApiSpec.components.schemas.PublicStatsData;
  assert.deepEqual(stats.required, ["volunteers", "news"]);
  assert.equal(stats.additionalProperties, false);
  assert.deepEqual(Object.keys(stats.properties).sort(), ["news", "volunteers"]);
  assert.equal(stats.properties.volunteers.minimum, 10);
  assert.equal(stats.properties.volunteers.multipleOf, 10);
  assert.equal(stats.properties.volunteers.nullable, true);
});

test("openapi contract: members and admin endpoints should expose implemented parameters and bodies", () => {
  assertParameterNames("/admin/access", "get", []);
  assertParameterNames("/members", "get", ["search", "status", "limit", "offset"]);
  assertParameterNames("/admin/executive-dashboard", "get", []);
  assertParameterNames("/admin/executive-dashboard/targets/{key}", "patch", ["key"]);
  assertParameterNames("/admin/members/dashboard", "get", ["search", "status", "organizationId", "limit", "offset"]);
  assertPositiveIntegerPathParameter("/admin/members/{id}/actions", "post");
  assertParameterNames("/admin/organizations", "get", ["search", "level", "status", "limit", "offset"]);
  assertParameterNames("/admin/organizations", "post", []);
  assertParameterNames("/admin/organizations/{id}", "get", ["id"]);
  assertParameterNames("/admin/organizations/{id}", "patch", ["id"]);
  assertParameterNames("/admin/organizations/{id}/mandates", "post", ["id"]);
  assertParameterNames("/admin/organizations/{id}/mandates/{childId}", "patch", ["id", "childId"]);
  assertParameterNames("/admin/organizations/{id}/objectives", "post", ["id"]);
  assertParameterNames("/admin/organizations/{id}/objectives/{childId}", "patch", ["id", "childId"]);
  assertParameterNames("/admin/audit", "get", ["limit", "cursor", "action", "targetType", "targetId"]);
  assertParameterNames("/admin/notifications/email-test", "post", []);
  assertRequestBodyRef("/admin/notifications/email-test", "post", "#/components/schemas/AdminEmailTestInput");
  assertRequestBodyRef(
    "/admin/executive-dashboard/targets/{key}",
    "patch",
    "#/components/schemas/ExecutiveTargetUpdateInput"
  );
  assertRequestBodyRef("/admin/members/{id}/actions", "post", "#/components/schemas/MembershipActionInput");
  assertComponentMatchesZodObject("MembershipActionInput", membershipActionSchema);
  const componentSchemas = openApiSpec.components.schemas as Record<string, OpenApiComponentSchema>;
  assert.deepEqual(componentSchemas.MembershipStatus?.enum, [...membershipStatuses]);
  assert.deepEqual(componentSchemas.MembershipAction?.enum, [...membershipActions]);
  assertComponentMatchesZodObject("ExecutiveTargetUpdateInput", updateExecutiveTargetSchema);
  assertRequestBodyRef("/admin/organizations", "post", "#/components/schemas/OrganizationWriteInput");
  assertRequestBodyRef("/admin/organizations/{id}", "patch", "#/components/schemas/OrganizationPatchInput");
  assertRequestBodyRef("/admin/organizations/{id}/mandates", "post", "#/components/schemas/OrganizationMandateInput");
  assertRequestBodyRef("/admin/organizations/{id}/mandates/{childId}", "patch", "#/components/schemas/OrganizationMandatePatchInput");
  assertRequestBodyRef("/admin/organizations/{id}/objectives", "post", "#/components/schemas/OrganizationObjectiveInput");
  assertRequestBodyRef("/admin/organizations/{id}/objectives/{childId}", "patch", "#/components/schemas/OrganizationObjectivePatchInput");
  assertComponentMatchesZodObject("OrganizationWriteInput", createOrganizationSchema);
  assertComponentMatchesZodObject("OrganizationPatchInput", updateOrganizationSchema);
  assertComponentMatchesZodObject("OrganizationMandateInput", createOrganizationMandateSchema);
  assertComponentMatchesZodObject("OrganizationMandatePatchInput", updateOrganizationMandateSchema);
  assertComponentMatchesZodObject("OrganizationObjectiveInput", createOrganizationObjectiveSchema);
  assertComponentMatchesZodObject("OrganizationObjectivePatchInput", updateOrganizationObjectiveSchema);

  const membersOperation = readOperation("/members", "get");
  assert.deepEqual(membersOperation.security, [{ BearerAuth: [] }]);
  assert.ok(membersOperation.responses?.["401"]);
  assert.ok(membersOperation.responses?.["403"]);
  const statusParameter = membersOperation.parameters?.find((parameter) => parameter.name === "status");
  assert.deepEqual(statusParameter?.schema?.enum, [...memberWorkflowStatuses]);
});

test("openapi contract: news write payload should match the live zod schema", () => {
  const newsWriteInput = (
    openApiSpec.components.schemas as Record<string, {
      required?: string[];
      properties?: Record<string, unknown>;
      additionalProperties?: boolean;
    }>
  ).NewsWriteInput;

  assert.ok(newsWriteInput);

  const zodShape = unwrapNewsWriteObjectSchema().shape();
  const zodPropertyNames = Object.keys(zodShape).sort();
  const zodRequiredProperties = Object.entries(zodShape)
    .filter(([, schema]) => !schema.isOptional())
    .map(([name]) => name)
    .sort();

  assert.deepEqual(Object.keys(newsWriteInput.properties ?? {}).sort(), zodPropertyNames);
  assert.deepEqual([...(newsWriteInput.required ?? [])].sort(), zodRequiredProperties);
  assert.equal(newsWriteInput.additionalProperties, false);

  const schemas = openApiSpec.components.schemas as Record<string, { enum?: string[] }>;
  assert.deepEqual(schemas.NewsStatus.enum, [...newsStatusValues]);
  assert.deepEqual(schemas.NewsMediaKind.enum, [...newsMediaKindValues]);

  const createOperation = readOperation("/news", "post");
  const updateOperation = readOperation("/news/{id}", "put");

  assert.equal(
    createOperation.requestBody?.content?.["application/json"]?.schema?.$ref,
    "#/components/schemas/NewsWriteInput"
  );
  assert.equal(
    updateOperation.requestBody?.content?.["application/json"]?.schema?.$ref,
    "#/components/schemas/NewsWriteInput"
  );
});

test("openapi contract: news endpoints should expose the implemented query and path parameters", () => {
  const publicList = readOperation("/news", "get");
  const adminList = readOperation("/news/admin/list", "get");
  const mediaList = readOperation("/news/media/library", "get");
  const publicDetail = readOperation("/news/{id}", "get");
  const adminDetail = readOperation("/news/admin/{id}", "get");
  const mediaDelete = readOperation("/news/media/library/{assetId}", "delete");
  const mediaUpload = readOperation("/news/media/upload", "post");

  assert.deepEqual(
    publicList.parameters?.map((parameter) => parameter.name),
    ["limit", "cursor", "mode", "offset"]
  );
  assert.deepEqual(
    adminList.parameters?.map((parameter) => parameter.name),
    ["limit", "cursor"]
  );
  assert.deepEqual(
    mediaList.parameters?.map((parameter) => parameter.name),
    ["limit"]
  );

  for (const operation of [publicDetail, adminDetail, mediaDelete]) {
    const parameter = operation.parameters?.[0];
    assert.equal(parameter?.schema?.type, "integer");
    assert.equal(parameter?.schema?.minimum, 1);
  }

  const mediaUploadProperties = mediaUpload.requestBody?.content?.["multipart/form-data"]?.schema?.properties;
  assert.deepEqual(Object.keys(mediaUploadProperties ?? {}).sort(), ["alt", "file", "kind", "title"]);
});
