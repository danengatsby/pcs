import type { UserRole } from "./authToken.js";

export const adminProfileNames = ["leadership", "secretariat", "communications", "treasury", "parliamentary", "arbitration"] as const;
export type AdminProfile = typeof adminProfileNames[number];

export const adminProfileLabels: Record<AdminProfile, string> = {
  leadership: "Conducere și organizare", secretariat: "Secretariat", communications: "Comunicare",
  treasury: "Trezorerie", parliamentary: "Grup parlamentar", arbitration: "Arbitraj",
};

export const adminCapabilities = [
  "workspace.read", "recruitment.read", "recruitment.export", "recruitment.manage", "recruitment.delete",
  "membership.read", "membership.validate", "membership.lifecycle", "organization.read", "organization.create",
  "organization.update", "organization.mandate", "organization.objective", "congress.read", "congress.manage", "congress.vote",
  "arbitration.read", "arbitration.manage", "arbitration.adjudicate", "executive.read", "executive.targets",
  "mobilization.read", "mobilization.manage", "communication.preview", "communication.dispatch",
  "content.read", "content.write", "audit.read", "notifications.test", "finance.read", "finance.manage", "parliamentary.read", "parliamentary.manage",
] as const;
export type AdminCapability = typeof adminCapabilities[number];

// Profiles replace the political role's permissions; they never add unrelated
// registries. Treasury and parliamentary operations require explicit assignment.
export const profileCapabilities: Record<AdminProfile, readonly AdminCapability[]> = {
  leadership: adminCapabilities.filter((capability) => !["arbitration.", "finance.", "parliamentary."].some((prefix) => capability.startsWith(prefix))),
  secretariat: ["workspace.read", "recruitment.read", "recruitment.export", "recruitment.manage", "membership.read", "membership.validate", "organization.read", "organization.objective", "congress.read", "congress.manage", "congress.vote", "mobilization.read", "mobilization.manage"],
  communications: ["workspace.read", "content.read", "content.write", "communication.preview", "communication.dispatch", "notifications.test"],
  treasury: ["workspace.read", "finance.read", "finance.manage"],
  parliamentary: ["workspace.read", "parliamentary.read", "parliamentary.manage"],
  arbitration: ["workspace.read", "arbitration.read", "arbitration.manage", "arbitration.adjudicate"],
};

export function defaultAdminCapabilities(role: UserRole): readonly AdminCapability[] {
  if (role === "PRESEDINTE") { return profileCapabilities.leadership; }
  if (role === "SECRETAR") { return profileCapabilities.secretariat; }
  if (role === "VICEPRESEDINTE") {
    return profileCapabilities.leadership.filter((capability) => !["audit.read", "notifications.test", "executive.targets", "organization.create", "organization.mandate", "communication.dispatch"].includes(capability));
  }
  if (role === "CONSILIER") {
    return ["workspace.read", "recruitment.read", "membership.read", "organization.read", "congress.read", "mobilization.read"];
  }
  return [];
}
