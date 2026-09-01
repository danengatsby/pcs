import { escapeCsvCell } from "../../lib/csv.js";
import {
  type VolunteerAdminRow,
  type VolunteerCursor,
  type VolunteerListFilters,
  type VolunteerWorkflowStatus,
  volunteerStatusValues,
} from "./types.js";

const defaultPublicVolunteersLimit = 300;
const maxPublicVolunteersLimit = 1000;

export function parsePublicVolunteersLimit(raw: unknown): number {
  if (typeof raw !== "string") {
    return defaultPublicVolunteersLimit;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return defaultPublicVolunteersLimit;
  }

  return Math.min(parsed, maxPublicVolunteersLimit);
}

export function parsePositiveInt(raw: unknown, fallback: number, min = 1, max = 500): number {
  const parsed = Number(raw ?? fallback);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

export function parseVolunteerCursor(raw: unknown): VolunteerCursor | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }

  try {
    const decoded = Buffer.from(raw.trim(), "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as { createdAt?: unknown; id?: unknown };
    if (typeof parsed.createdAt !== "string") {
      return null;
    }

    const id = Number(parsed.id);
    if (!Number.isInteger(id) || id <= 0) {
      return null;
    }

    if (Number.isNaN(Date.parse(parsed.createdAt))) {
      return null;
    }

    return {
      createdAt: parsed.createdAt,
      id,
    };
  } catch {
    return null;
  }
}

export function encodeVolunteerCursor(row: Pick<VolunteerAdminRow, "createdAt" | "id">): string {
  return Buffer.from(
    JSON.stringify({
      createdAt: row.createdAt,
      id: row.id,
    }),
    "utf8"
  ).toString("base64url");
}

export function parseVolunteerId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

export function parseAdminVolunteerRecordId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id === 0) {
    return null;
  }

  return id;
}

export function parseVolunteerStatus(raw: unknown): VolunteerWorkflowStatus | null {
  if (typeof raw !== "string") {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized && volunteerStatusValues.includes(normalized as VolunteerWorkflowStatus)) {
    return normalized as VolunteerWorkflowStatus;
  }

  return null;
}

export function parseVolunteerSearch(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const value = raw.trim();
  return value || null;
}

export function parseVolunteerFilterValue(raw: unknown, maxLength = 220): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const value = raw.trim();
  if (!value) {
    return null;
  }

  return value.slice(0, maxLength);
}

export function readVolunteerListFilters(input: {
  status?: unknown;
  search?: unknown;
  county?: unknown;
  locality?: unknown;
  skills?: unknown;
}): VolunteerListFilters {
  return {
    status: parseVolunteerStatus(input.status),
    searchValue: parseVolunteerSearch(input.search),
    countyValue: parseVolunteerFilterValue(input.county, 120),
    localityValue: parseVolunteerFilterValue(input.locality, 120),
    skillsValue: parseVolunteerFilterValue(input.skills, 220),
  };
}

export const volunteerCsvHeader = [
  "id",
  "fullName",
  "email",
  "phone",
  "county",
  "locality",
  "skills",
  "motivation",
  "workflowStatus",
  "internalNotes",
  "createdAt",
  "statusUpdatedAt",
  "statusUpdatedBy",
  "owner",
  "followUpAt",
  "reminderAt",
  "lastContactAt",
  "contactChannel",
  "priority",
  "rejectionReason",
  "tags",
  "skillTags",
].join(",");

function formatStatusUpdatedByLabel(row: VolunteerAdminRow): string {
  return row.statusUpdatedByName ?? row.statusUpdatedByEmail ?? row.statusUpdatedByUserId ?? "";
}

function formatOwnerLabel(row: VolunteerAdminRow): string {
  if (row.ownerName && row.ownerEmail && row.ownerName.toLowerCase() !== row.ownerEmail.toLowerCase()) {
    return `${row.ownerName} (${row.ownerEmail})`;
  }

  return row.ownerName ?? row.ownerEmail ?? row.ownerUserId ?? "";
}

export function volunteerRowToCsvLine(row: VolunteerAdminRow): string {
  const values = [
    String(row.id),
    row.fullName,
    row.email,
    row.phone,
    row.county,
    row.locality,
    row.skills,
    row.motivation,
    row.workflowStatus,
    row.internalNotes,
    row.createdAt,
    row.statusUpdatedAt ?? "",
    formatStatusUpdatedByLabel(row),
    formatOwnerLabel(row),
    row.followUpAt ?? "",
    row.reminderAt ?? "",
    row.lastContactAt ?? "",
    row.contactChannel ?? "",
    row.priority ?? "",
    row.rejectionReason ?? "",
    row.tags.join(" | "),
    row.skillTags.join(" | "),
  ];

  return values.map((value) => escapeCsvCell(value)).join(",");
}
