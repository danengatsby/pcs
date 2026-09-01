export type MemberRole =
  | "SUSTINATOR"
  | "ADERENT"
  | "MEMBRU"
  | "CONSILIER"
  | "SECRETAR"
  | "VICEPRESEDINTE"
  | "PRESEDINTE";

export type MemberWorkflowStatus = "nou" | "validat" | "contactat" | "activ";

const leadershipRoles = new Set<MemberRole>(["CONSILIER", "SECRETAR", "VICEPRESEDINTE", "PRESEDINTE"]);

export function isOrganizerRole(role: MemberRole): boolean {
  return leadershipRoles.has(role);
}

export function mapWorkflowToRole(status: MemberWorkflowStatus): MemberRole {
  if (status === "activ") {
    return "MEMBRU";
  }
  if (status === "contactat" || status === "validat") {
    return "ADERENT";
  }
  return "SUSTINATOR";
}

export function normalizeMemberRole(
  value: string | null | undefined,
  fallbackStatus?: MemberWorkflowStatus | null
): MemberRole {
  const normalized = (value ?? "").trim().toUpperCase();
  if (normalized === "SUSTINATOR") {
    return "SUSTINATOR";
  }
  if (normalized === "ADERENT") {
    return "ADERENT";
  }
  if (normalized === "MEMBRU") {
    return "MEMBRU";
  }
  if (normalized === "CONSILIER") {
    return "CONSILIER";
  }
  if (normalized === "SECRETAR") {
    return "SECRETAR";
  }
  if (normalized === "VICEPRESEDINTE") {
    return "VICEPRESEDINTE";
  }
  if (normalized === "PRESEDINTE") {
    return "PRESEDINTE";
  }

  if (fallbackStatus) {
    return mapWorkflowToRole(fallbackStatus);
  }

  return "SUSTINATOR";
}
