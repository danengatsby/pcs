export const adminDirectLoginSchemas = {
  AdminDirectLoginInput: { type: "object", additionalProperties: false, required: ["token"], properties: {
    token: { type: "string", pattern: "^[A-Za-z0-9_-]{43}$", writeOnly: true },
  } },
};
export const adminDirectLoginPaths = {
  "/auth/admin-direct-login": { post: {
    operationId: "redeemAdminDirectLogin", tags: ["Authentication"], security: [],
    summary: "Consume a personal operator-issued link and enter administration directly",
    description: "Requires a one-use, 256-bit capability issued by a server operator for an already activated account. Expires after 30 minutes. This is an audited alternative to password plus TOTP, not a TOTP verification. Responses use Cache-Control: private, no-store. Send the capability only in the JSON body.",
    requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AdminDirectLoginInput" } } } },
    responses: {
      "200": { description: "Personal administrative session", content: { "application/json": { schema: { type: "object", required: ["data", "error", "meta"], properties: {
        data: { $ref: "#/components/schemas/AuthSessionData" }, error: { nullable: true }, meta: { $ref: "#/components/schemas/ApiMeta" },
      } } } } },
      "400": { description: "Invalid input" }, "403": { description: "Invalid, expired, consumed or revoked link" }, "429": { description: "Too many attempts" },
    },
  } },
};
