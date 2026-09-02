import { z } from "zod";
import { strongPasswordMessage, strongPasswordPattern } from "../../lib/passwordPolicy.js";
import { resolveCountyName } from "./counties.js";
import {
  volunteerContactChannelValues,
  volunteerPriorityValues,
  volunteerStatusValues,
} from "./types.js";

function optionalBulkFilterValue(maxLength: number) {
  return z.string().trim().max(maxLength).transform((value) => value || undefined).optional();
}

function normalizeVolunteerTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const normalizedTags: string[] = [];

  for (const rawValue of tags) {
    const trimmedValue = rawValue.trim().toLowerCase();
    if (!trimmedValue || seen.has(trimmedValue)) {
      continue;
    }

    seen.add(trimmedValue);
    normalizedTags.push(trimmedValue);
  }

  return normalizedTags;
}

const workflowDateTimeSchema = z.string().datetime({ offset: true }).nullish().transform((value) => value ?? null);
const workflowTagSchema = z.string().trim().min(1).max(40);

const bulkFiltersSchema = z.object({
  status: z.enum(volunteerStatusValues).optional(),
  search: optionalBulkFilterValue(220),
  county: optionalBulkFilterValue(120),
  locality: optionalBulkFilterValue(120),
  skills: optionalBulkFilterValue(220),
}).strict();

const bulkTargetSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ids"),
    volunteerIds: z.array(z.number().int().positive()).min(1).max(100),
  }).strict(),
  z.object({
    type: z.literal("filters"),
    filters: bulkFiltersSchema,
  }).strict(),
]);

const legacyBulkIdsSchema = z.object({
  volunteerIds: z.array(z.number().int().positive()).min(1).max(100),
}).strict();

export const volunteerSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(180),
  password: z.string().min(10, strongPasswordMessage).max(128).regex(strongPasswordPattern, strongPasswordMessage),
  phone: z.string().trim().max(40).optional().default(""),
  county: z.string().trim().min(2).max(120).transform((value, ctx) => {
    const resolved = resolveCountyName(value);
    if (!resolved) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Judet invalid. Selecteaza un judet din lista oficiala.",
      });
      return z.NEVER;
    }
    return resolved;
  }),
  locality: z.string().trim().min(2).max(120),
  skills: z.string().trim().max(220).optional().default(""),
  motivation: z.string().trim().min(10).max(1500),
  captchaToken: z.string().trim().max(4096).optional().default(""),
  website: z.string().trim().max(2048).optional().default(""),
}).strict();

export const workflowUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(160).optional(),
  email: z.string().trim().email().max(180).transform((value) => value.toLowerCase()).optional(),
  phone: z.string().trim().max(40).optional(),
  motivation: z.string().trim().min(10).max(1500).optional(),
  status: z.enum(volunteerStatusValues),
  internalNotes: z.string().trim().max(5000).default(""),
  county: z.string().trim().min(2).max(120).transform((value, ctx) => {
    const resolved = resolveCountyName(value);
    if (!resolved) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Judet invalid. Selecteaza un judet din lista oficiala.",
      });
      return z.NEVER;
    }
    return resolved;
  }).optional(),
  locality: z.string().trim().min(2).max(120).optional(),
  skills: z.string().trim().max(220).optional(),
  ownerUserId: z.number().int().positive().nullable().optional(),
  followUpAt: workflowDateTimeSchema.optional(),
  reminderAt: workflowDateTimeSchema.optional(),
  lastContactAt: workflowDateTimeSchema.optional(),
  contactChannel: z.enum(volunteerContactChannelValues).nullable().optional(),
  priority: z.enum(volunteerPriorityValues).optional(),
  rejectionReason: z.string().trim().max(2000).optional(),
  tags: z.array(workflowTagSchema).max(12).transform(normalizeVolunteerTags).optional(),
  skillTags: z.array(workflowTagSchema).max(16).transform(normalizeVolunteerTags).optional(),
}).strict();

export const bulkWorkflowUpdateSchema = z.object({
  status: z.enum(volunteerStatusValues),
  target: bulkTargetSchema,
}).strict().or(
  legacyBulkIdsSchema.extend({
    status: z.enum(volunteerStatusValues),
  }).transform((value) => ({
    status: value.status,
    target: {
      type: "ids" as const,
      volunteerIds: value.volunteerIds,
    },
  }))
);

export const bulkDeleteVolunteerSchema = z.object({
  target: bulkTargetSchema,
}).strict().or(
  legacyBulkIdsSchema.transform((value) => ({
    target: {
      type: "ids" as const,
      volunteerIds: value.volunteerIds,
    },
  }))
);
