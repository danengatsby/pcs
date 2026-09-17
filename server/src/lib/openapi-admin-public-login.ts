export const adminPublicLoginPaths = {
  "/auth/admin-public-login": { post: {
    operationId: "openPublicAdminSession", tags: ["Authentication"], security: [],
    summary: "Open the shared public administrative account without credentials",
    description: "Available only when AUTH_PUBLIC_ADMIN_ENABLED is explicitly enabled. Anyone can obtain administrative access as Administrator public PCS. No personal identity, password, link or TOTP is accepted or required. Actions belong to the shared public actor. Responses use Cache-Control: private, no-store.",
    responses: {
      "200": { description: "Shared public administrative session", content: { "application/json": { schema: {
        type: "object", required: ["data", "error", "meta"], properties: {
          data: { $ref: "#/components/schemas/AuthSessionData" }, error: { nullable: true }, meta: { $ref: "#/components/schemas/ApiMeta" },
        },
      } } } },
      "403": { description: "Public access disabled or shared account unavailable" },
      "429": { description: "Too many requests" },
    },
  } },
};
