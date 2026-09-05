import type { PrismaTx } from "../../lib/prismaTransaction.js";
import type { UserRole } from "../../lib/authToken.js";

export const volunteerStatusValues = ["nou", "validat", "contactat", "activ"] as const;
export const volunteerContactChannelValues = [
  "telefon",
  "email",
  "whatsapp",
  "telegram",
  "facebook",
  "intalnire",
  "altul",
] as const;
export const volunteerPriorityValues = ["scazuta", "medie", "ridicata", "critica"] as const;

export type VolunteerWorkflowStatus = (typeof volunteerStatusValues)[number];
export type VolunteerContactChannel = (typeof volunteerContactChannelValues)[number];
export type VolunteerPriority = (typeof volunteerPriorityValues)[number];

export const volunteerManagedAccountRoles = ["SUSTINATOR", "ADERENT", "MEMBRU"] as const;
export type VolunteerManagedAccountRole = (typeof volunteerManagedAccountRoles)[number];

export function mapVolunteerStatusToAccountRole(
  _status: VolunteerWorkflowStatus
): VolunteerManagedAccountRole {
  // Workflow-ul CRM descrie activitatea voluntarului, nu calitatea politică.
  // Rolurile ADERENT/MEMBRU sunt acordate exclusiv prin registrul de membri.
  return "SUSTINATOR";
}

export type VolunteerInsertRow = {
  id: number;
};

export type ExistingVolunteerRow = {
  id: number;
};

export type ExistingUserAuthRow = {
  id: number;
  passwordHash: string;
};

export type VolunteerAdminRow = {
  id: number;
  volunteerId: number | null;
  fullName: string;
  email: string;
  phone: string;
  county: string;
  locality: string;
  skills: string;
  motivation: string;
  workflowStatus: VolunteerWorkflowStatus;
  internalNotes: string;
  createdAt: string;
  statusUpdatedAt: string | null;
  statusUpdatedByUserId: string | null;
  statusUpdatedByName: string | null;
  statusUpdatedByEmail: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerRole: UserRole | null;
  followUpAt: string | null;
  reminderAt: string | null;
  lastContactAt: string | null;
  contactChannel: VolunteerContactChannel | null;
  priority: VolunteerPriority | null;
  rejectionReason: string | null;
  tags: string[];
  skillTags: string[];
  accountRole: UserRole | null;
  recordSource: "volunteer" | "user" | "both";
};

export type VolunteerOwnerOption = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
};

export type VolunteerCountRow = {
  count: string;
};

export type VolunteerCursor = {
  createdAt: string;
  id: number;
};

export type VolunteerListFilters = {
  status: VolunteerWorkflowStatus | null;
  searchValue: string | null;
  countyValue: string | null;
  localityValue: string | null;
  skillsValue: string | null;
};

export type QueryRunner = {
  volunteer: PrismaTx["volunteer"];
  user: PrismaTx["user"];
  membershipRecord: PrismaTx["membershipRecord"];
  membershipEvent: PrismaTx["membershipEvent"];
};
