import type { PrismaTx } from "../../lib/prismaTransaction.js";

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

export type VolunteerPublicRole =
  | "SUSTINATOR"
  | "ADERENT"
  | "MEMBRU"
  | "CONSILIER"
  | "SECRETAR"
  | "VICEPRESEDINTE"
  | "PRESEDINTE"
  | "FARA_CONT";

export type VolunteerInsertRow = {
  id: number;
};

export type ExistingVolunteerRow = {
  id: number;
};

export type ExistingUserAuthRow = {
  passwordHash: string;
};

export type VolunteerPublicRow = {
  id: string;
  fullName: string;
  email: string;
  password: "protejata" | "nesetata";
  status: VolunteerWorkflowStatus;
  role: VolunteerPublicRole;
};

export type VolunteerCountyCountRow = {
  county: string;
  count: number;
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
  ownerRole: Exclude<VolunteerPublicRole, "FARA_CONT"> | null;
  followUpAt: string | null;
  reminderAt: string | null;
  lastContactAt: string | null;
  contactChannel: VolunteerContactChannel | null;
  priority: VolunteerPriority | null;
  rejectionReason: string | null;
  tags: string[];
  skillTags: string[];
  accountRole: Exclude<VolunteerPublicRole, "FARA_CONT"> | null;
  recordSource: "volunteer" | "user" | "both";
};

export type VolunteerOwnerOption = {
  id: string;
  fullName: string;
  email: string;
  role: Exclude<VolunteerPublicRole, "FARA_CONT">;
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
};

export type CaptchaVerifyResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  score?: number;
  "error-codes"?: unknown;
};

export type CaptchaVerificationResult = {
  valid: boolean;
  reason: string;
  hostname: string;
  action: string;
  score: number | null;
  errorCodes: string[];
};
