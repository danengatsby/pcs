import { strongPasswordPattern } from "./passwordPolicy.js";

const token = { type: "string", pattern: "^[A-Za-z0-9_-]{43}$", writeOnly: true };
const object = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
export const adminActivationSchemas = {
  AdminActivationPreviewInput: object({ token }),
  AdminActivationCompleteInput: object({ token, password: { type: "string", minLength: 10, maxLength: 128, pattern: strongPasswordPattern.source, writeOnly: true }, mfaCode: { type: "string", pattern: "^\\d{6}$", writeOnly: true } }),
  AdminActivationPreviewData: object({ fullName: { type: "string" }, email: { type: "string", format: "email" }, secret: { type: "string" }, qrDataUrl: { type: "string" }, expiresAt: { type: "string", format: "date-time" } }),
};

function operation(operationId: string, summary: string, input: string, output: string) {
  return {
    operationId, summary, tags: ["Authentication"], security: [],
    description: "Requires an unexpired operator-issued 256-bit invitation. Only initial activation is supported. Responses use Cache-Control: private, no-store. The capability is sent in the JSON body, never as a URL query parameter.",
    requestBody: { required: true, content: { "application/json": { schema: { $ref: `#/components/schemas/${input}` } } } },
    responses: {
      "200": { description: "Success", content: { "application/json": { schema: { type: "object", required: ["data", "error", "meta"], properties: { data: { $ref: `#/components/schemas/${output}` }, error: { nullable: true }, meta: { $ref: "#/components/schemas/ApiMeta" } } } } } },
      "400": { description: "Invalid input" }, "403": { description: "Invalid, expired, used invitation or incorrect TOTP" }, "429": { description: "Too many attempts" },
    },
  };
}
export const adminActivationPaths = {
  "/auth/admin-activation/preview": { post: operation("previewAdminActivation", "Prepare initial administrator activation", "AdminActivationPreviewInput", "AdminActivationPreviewData") },
  "/auth/admin-activation/complete": { post: operation("completeAdminActivation", "Choose a password, confirm TOTP and start the personal session; consumes the invitation", "AdminActivationCompleteInput", "AuthSessionData") },
};
