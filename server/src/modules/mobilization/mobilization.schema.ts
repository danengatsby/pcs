import { z } from "zod";
import { resolveCountyName } from "../volunteers/counties.js";
import {
  mobilizationAvailabilityValues,
  mobilizationInterestValues,
} from "./mobilization.types.js";

export const mobilizationActionParamsSchema = z.object({
  slug: z.string().trim().min(3).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
}).strict();

export const mobilizationResponseSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(180).transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(40).optional().default(""),
  county: z.string().trim().min(2).max(120).transform((value, ctx) => {
    const resolved = resolveCountyName(value);
    if (!resolved) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Județ invalid. Selectează un județ din lista oficială.",
      });
      return z.NEVER;
    }
    return resolved;
  }),
  locality: z.string().trim().max(120).optional().default(""),
  interests: z.array(z.enum(mobilizationInterestValues)).min(1).max(6),
  availability: z.enum(mobilizationAvailabilityValues).or(z.literal("")).optional().default(""),
  message: z.string().trim().max(1200).optional().default(""),
  joinWaitlist: z.boolean().optional().default(false),
  updatesConsent: z.boolean().optional().default(false),
  emailConsent: z.boolean().optional().default(false),
  smsConsent: z.boolean().optional().default(false),
  whatsappConsent: z.boolean().optional().default(false),
  consentVersion: z.literal("mobilizare-v2").optional().default("mobilizare-v2"),
  privacyConsent: z.literal(true, {
    errorMap: () => ({ message: "Acordul privind prelucrarea datelor este obligatoriu." }),
  }),
  website: z.string().trim().max(2048).optional().default(""),
}).strict().superRefine((value, context) => {
  if ((value.smsConsent || value.whatsappConsent) && value.phone.length < 7) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["phone"],
      message: "Telefonul este obligatoriu pentru comunicarea prin SMS sau WhatsApp.",
    });
  }
});

export type MobilizationResponseInput = z.output<typeof mobilizationResponseSchema>;
