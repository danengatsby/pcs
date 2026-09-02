import { z } from "zod";

export const membershipStatuses = [
  "supporter",
  "application",
  "verified",
  "approved",
  "active",
  "suspended",
  "terminated",
] as const;

export const membershipActions = [
  "verify",
  "approve",
  "activate",
  "suspend",
  "reactivate",
  "transfer",
  "terminate",
] as const;

export const adminMembersDashboardQuerySchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  status: z.enum(membershipStatuses).optional(),
  organizationId: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  offset: z.coerce.number().int().min(0).max(100000).optional().default(0),
});

export const membershipActionSchema = z.object({
  action: z.enum(membershipActions),
  organizationId: z.string().trim().min(1).max(80).optional(),
  approvalOrganizationId: z.string().trim().min(1).max(80).optional(),
  reason: z.string().trim().max(1200).optional().default(""),
  effectiveAt: z.string().datetime({ offset: true }).optional(),
  expectedVersion: z.number().int().positive(),
}).superRefine((value, context) => {
  if (value.action === "transfer" && !value.organizationId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["organizationId"],
      message: "Organizația destinație este obligatorie pentru transfer.",
    });
  }

  if (value.action === "approve" && !value.approvalOrganizationId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["approvalOrganizationId"],
      message: "Organul care aprobă este obligatoriu.",
    });
  }

  if ((value.action === "suspend" || value.action === "terminate") && value.reason.length < 5) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reason"],
      message: "Motivul trebuie să conțină cel puțin 5 caractere.",
    });
  }
});

export type MembershipStatus = (typeof membershipStatuses)[number];
export type MembershipAction = (typeof membershipActions)[number];
export type AdminMembersDashboardQuery = z.infer<typeof adminMembersDashboardQuerySchema>;
export type MembershipActionInput = z.infer<typeof membershipActionSchema>;
