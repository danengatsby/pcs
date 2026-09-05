// Administrative governance endpoints. Authorization is enforced by the shared route registry.
const text = (maxLength: number, minLength = 0) => ({ type: "string", minLength, maxLength });
const date = { type: "string", format: "date-time", nullable: true };
const id = { type: "integer", minimum: 1 };
const organization = text(80, 1);
const object = (properties: Record<string, unknown>, required: string[]) => ({ type: "object", additionalProperties: false, properties, required });
function operation(operationId: string, summary: string, capability: string, body?: Record<string, unknown>, parameters: string[] = [], created = false) {
  return {
    operationId, summary, tags: ["Admin Governance"], description: `Requires ${capability} and an active territorial mandate.`,
    security: [{ BearerAuth: [] }],
    parameters: parameters.map((name) => ({ name, in: "path", required: true, schema: id })),
    ...(body ? { requestBody: { required: true, content: { "application/json": { schema: body } } } } : {}),
    responses: {
      [created ? "201" : "200"]: { description: "Success", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccessResponse" } } } },
      "400": { description: "Invalid input" }, "401": { description: "Unauthorized" },
      "403": { description: "Capability or territorial mandate required" }, "404": { description: "Record unavailable in authorized scope" },
      "409": { description: "Invalid procedure, transition, quorum or incompatibility" },
    },
  };
}
export const governanceAdminPaths = {
  "/congresses/{id}/results": {
    get: {
      operationId: "getCongressResults", summary: "Read aggregate results for a validated congress", tags: ["Congress"],
      security: [], parameters: [{ name: "id", in: "path", required: true, schema: id }],
      responses: { "200": { description: "Aggregate candidacy results; empty until congress validation", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccessResponse" } } } } },
    },
  },
  "/admin/congresses": {
    get: operation("listCongresses", "List congresses in authorized organizations", "congress.read"),
    post: operation("createCongress", "Create a draft congress", "congress.manage", object({
      organizationId: organization, title: text(180, 5), purpose: { type: "string", enum: ["ordinary", "extraordinary", "founding"] },
      startsAt: { ...date, nullable: false }, endsAt: { ...date, nullable: false }, quorum: id,
    }, ["organizationId", "title", "purpose", "startsAt", "endsAt", "quorum"]), [], true),
  },
  "/admin/congresses/{id}/delegates": { post: operation("addCongressDelegate", "Register a delegate", "congress.manage", object({
    userId: { ...id, nullable: true }, fullName: text(160, 3), organizationId: organization, selectedBy: text(180),
  }, ["fullName", "organizationId"]), ["id"], true) },
  "/admin/congresses/{id}/candidacies": { post: operation("addCongressCandidacy", "Register a candidacy", "congress.manage", object({
    candidateUserId: { ...id, nullable: true }, candidateName: text(160, 3), office: text(120, 2),
  }, ["candidateName", "office"]), ["id"], true) },
  "/admin/congresses/{id}/candidacies/{candidacyId}/validate": { post: operation("validateCongressCandidacy", "Validate a candidacy", "congress.manage", undefined, ["id", "candidacyId"]) },
  "/admin/congresses/{id}/delegates/{delegateId}/check-in": { post: operation("checkInCongressDelegate", "Check in an eligible delegate", "congress.manage", undefined, ["id", "delegateId"]) },
  "/admin/congresses/{id}/status": { post: operation("transitionCongress", "Open, close or validate a congress", "congress.manage", object({ status: { type: "string", enum: ["open", "closed", "validated"] } }, ["status"]), ["id"]) },
  "/admin/congresses/{id}/votes": { post: operation("castCongressVote", "Cast the authenticated delegate's vote", "congress.vote", object({ candidacyId: id, choice: { type: "string", enum: ["yes", "no", "abstain"] } }, ["candidacyId", "choice"]), ["id"]) },
  "/admin/arbitration/cases": {
    get: operation("listArbitrationCases", "List arbitration cases in authorized scope", "arbitration.read"),
    post: operation("createArbitrationCase", "Register a confidential case", "arbitration.manage", object({
      organizationId: { ...organization, nullable: true }, caseType: { type: "string", enum: ["disciplinary", "member_dispute", "competence", "election", "other"] },
      subject: text(180, 5), facts: text(20000, 20), legalBasis: text(5000), responseDueAt: date,
    }, ["caseType", "subject", "facts"]), [], true),
  },
  "/admin/arbitration/cases/{id}/parties": { post: operation("addArbitrationParty", "Register a party", "arbitration.manage", object({ userId: { ...id, nullable: true }, fullName: text(160, 3), partyRole: { type: "string", enum: ["claimant", "respondent", "witness"] } }, ["fullName", "partyRole"]), ["id"], true) },
  "/admin/arbitration/cases/{id}/evidence": { post: operation("addArbitrationEvidence", "Register evidence", "arbitration.manage", object({ title: text(180, 3), documentPath: text(320, 1), description: text(5000) }, ["title", "documentPath"]), ["id"], true) },
  "/admin/arbitration/cases/{id}/conflicts": { post: operation("declareArbitrationConflict", "Declare an arbitrator conflict", "arbitration.manage", object({ arbitratorUserId: id, reason: text(5000, 10) }, ["arbitratorUserId", "reason"]), ["id"], true) },
  "/admin/arbitration/cases/{id}/decision": { post: operation("decideArbitrationCase", "Record a reasoned decision", "arbitration.adjudicate", object({ outcome: { type: "string", enum: ["upheld", "rejected", "partially_upheld", "dismissed"] }, reasoning: text(20000, 20) }, ["outcome", "reasoning"]), ["id"]) },
  "/admin/arbitration/cases/{id}/appeals": { post: operation("appealArbitrationCase", "Appeal a decided case", "arbitration.manage", object({ grounds: text(20000, 20), dueAt: date }, ["grounds"]), ["id"], true) },
};
