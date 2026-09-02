import { z } from "zod";

export const organizationLevels = ["national", "county", "local"] as const;
export const organizationStatuses = ["forming", "active", "inactive", "dissolved"] as const;
export const territoryTypes = ["national", "county", "locality"] as const;
export const mandateStatuses = ["planned", "active", "completed", "suspended"] as const;
export const objectiveStatuses = ["planned", "in_progress", "achieved", "at_risk", "cancelled"] as const;

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data trebuie să aibă formatul AAAA-LL-ZZ.");
const nullableDateSchema = isoDateSchema.nullable().optional();
const nullableIdSchema = z.string().trim().min(1).max(80).nullable().optional();

export const organizationIdParamSchema = z.object({
  id: z.string().trim().min(1).max(80),
});

export const organizationChildIdParamSchema = z.object({
  id: z.string().trim().min(1).max(80),
  childId: z.coerce.number().int().positive(),
});

export const listOrganizationsQuerySchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  level: z.enum(organizationLevels).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).max(10000).optional().default(0),
});

export const listAdminOrganizationsQuerySchema = listOrganizationsQuerySchema.extend({
  status: z.enum(organizationStatuses).optional(),
});

export const organizationTerritorySchema = z.object({
  type: z.enum(territoryTypes),
  countyId: z.coerce.number().int().positive().nullable().optional(),
  locality: z.string().trim().max(160).optional().default(""),
}).strict().superRefine((value, context) => {
  if (value.type === "national" && (value.countyId || value.locality)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Teritoriul național nu poate avea județ sau localitate." });
  }
  if (value.type === "county" && (!value.countyId || value.locality)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Teritoriul județean necesită un județ, fără localitate." });
  }
  if (value.type === "locality" && (!value.countyId || !value.locality)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Teritoriul local necesită județ și localitate." });
  }
});

const organizationWriteFields = {
  code: z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "Codul poate conține litere, cifre, punct, cratimă și underscore."),
  name: z.string().trim().min(3).max(180),
  level: z.enum(organizationLevels),
  status: z.enum(organizationStatuses),
  parentId: nullableIdSchema,
  membersCount: z.coerce.number().int().min(0).max(10_000_000).optional().default(0),
  officialEmail: z.union([z.string().trim().email().max(180), z.literal("")]).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  headquarters: z.string().trim().max(260).optional().default(""),
  foundedAt: nullableDateSchema,
  territories: z.array(organizationTerritorySchema).min(1).max(50),
};

export const createOrganizationSchema = z.object(organizationWriteFields).strict();

export const updateOrganizationSchema = z.object({
  code: organizationWriteFields.code.optional(),
  name: organizationWriteFields.name.optional(),
  level: organizationWriteFields.level.optional(),
  status: organizationWriteFields.status.optional(),
  parentId: nullableIdSchema,
  membersCount: z.coerce.number().int().min(0).max(10_000_000).optional(),
  officialEmail: z.union([z.string().trim().email().max(180), z.literal("")]).optional(),
  phone: z.string().trim().max(40).optional(),
  headquarters: z.string().trim().max(260).optional(),
  foundedAt: nullableDateSchema,
  territories: z.array(organizationTerritorySchema).min(1).max(50).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Trimite cel puțin un câmp de actualizat.");

export const createOrganizationMandateSchema = z.object({
  userId: z.coerce.number().int().positive().nullable().optional(),
  fullName: z.string().trim().min(3).max(160),
  positionTitle: z.string().trim().min(2).max(120),
  startedAt: isoDateSchema,
  endedAt: nullableDateSchema,
  status: z.enum(mandateStatuses).optional().default("active"),
}).strict().superRefine((value, context) => {
  if (value.endedAt && value.endedAt < value.startedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Data încheierii nu poate preceda începutul mandatului." });
  }
});

export const updateOrganizationMandateSchema = z.object({
  userId: z.coerce.number().int().positive().nullable().optional(),
  fullName: z.string().trim().min(3).max(160).optional(),
  positionTitle: z.string().trim().min(2).max(120).optional(),
  startedAt: isoDateSchema.optional(),
  endedAt: nullableDateSchema,
  status: z.enum(mandateStatuses).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Trimite cel puțin un câmp de actualizat.");

export const createOrganizationObjectiveSchema = z.object({
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().max(3000).optional().default(""),
  metricName: z.string().trim().max(120).optional().default(""),
  targetValue: z.coerce.number().finite().min(0).max(1_000_000_000),
  currentValue: z.coerce.number().finite().min(0).max(1_000_000_000).optional().default(0),
  unit: z.string().trim().min(1).max(40).optional().default("număr"),
  dueDate: isoDateSchema,
  status: z.enum(objectiveStatuses).optional().default("planned"),
}).strict();

export const updateOrganizationObjectiveSchema = z.object({
  title: z.string().trim().min(3).max(180).optional(),
  description: z.string().trim().max(3000).optional(),
  metricName: z.string().trim().max(120).optional(),
  targetValue: z.coerce.number().finite().min(0).max(1_000_000_000).optional(),
  currentValue: z.coerce.number().finite().min(0).max(1_000_000_000).optional(),
  unit: z.string().trim().min(1).max(40).optional(),
  dueDate: isoDateSchema.optional(),
  status: z.enum(objectiveStatuses).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Trimite cel puțin un câmp de actualizat.");

export type ListOrganizationsQuery = z.infer<typeof listOrganizationsQuerySchema>;
export type ListAdminOrganizationsQuery = z.infer<typeof listAdminOrganizationsQuerySchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type OrganizationTerritoryInput = z.infer<typeof organizationTerritorySchema>;
export type CreateOrganizationMandateInput = z.infer<typeof createOrganizationMandateSchema>;
export type UpdateOrganizationMandateInput = z.infer<typeof updateOrganizationMandateSchema>;
export type CreateOrganizationObjectiveInput = z.infer<typeof createOrganizationObjectiveSchema>;
export type UpdateOrganizationObjectiveInput = z.infer<typeof updateOrganizationObjectiveSchema>;

export type OrganizationRecord = {
  id: string;
  code: string;
  level: (typeof organizationLevels)[number];
  name: string;
  county: string;
  membersCount: number;
  foundedAt: string | null;
  territories: string[];
  officialEmail: string;
  phone: string;
  headquarters: string;
  leaders: Array<{
    fullName: string;
    positionTitle: string;
  }>;
};
