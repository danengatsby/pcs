import { z } from "zod";
import { mobilizationInterestValues } from "../mobilization/mobilization.types.js";

export const memberEventResponseSchema = z.object({
  response: z.enum(["confirmed", "declined"]),
}).strict();

export const memberTaskReportSchema = z.object({
  status: z.enum(["in_progress", "reported"]),
  report: z.string().trim().min(5).max(5000),
  result: z.string().trim().max(2000).optional().default(""),
  hours: z.number().min(0).max(10000),
}).strict();

export const memberConsentSchema = z.object({
  emailConsent: z.boolean(),
  smsConsent: z.boolean(),
  whatsappConsent: z.boolean(),
  phone: z.string().trim().max(40).optional().default(""),
  interests: z.array(z.enum(mobilizationInterestValues)).max(6).optional().default([]),
  consentVersion: z.literal("portal-membru-v1").optional().default("portal-membru-v1"),
}).strict().superRefine((value, context) => {
  if ((value.smsConsent || value.whatsappConsent) && value.phone.length < 7) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["phone"],
      message: "Telefonul este obligatoriu pentru SMS sau WhatsApp.",
    });
  }
});

export const memberPortalIdSchema = z.object({ id: z.string().regex(/^[1-9]\d*$/) });

export type MemberEventResponseInput = z.output<typeof memberEventResponseSchema>;
export type MemberTaskReportInput = z.output<typeof memberTaskReportSchema>;
export type MemberConsentInput = z.output<typeof memberConsentSchema>;
