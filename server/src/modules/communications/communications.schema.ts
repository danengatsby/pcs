import { z } from "zod";
import { mobilizationInterestValues } from "../mobilization/mobilization.types.js";

export const communicationChannels = ["email", "sms", "whatsapp"] as const;
export const communicationAudienceRoles = [
  "SUSTINATOR",
  "ADERENT",
  "MEMBRU",
  "CONSILIER",
  "SECRETAR",
  "VICEPRESEDINTE",
  "PRESEDINTE",
] as const;

const audienceFields = {
  channel: z.enum(communicationChannels),
  organizationId: z.string().trim().min(1).max(80).nullable().optional().default(null),
  countyIds: z.array(z.number().int().positive()).max(42).optional().default([]),
  roles: z.array(z.enum(communicationAudienceRoles)).max(7).optional().default([]),
  interests: z.array(z.enum(mobilizationInterestValues)).max(6).optional().default([]),
};

export const communicationAudienceSchema = z.object(audienceFields).strict();

export const createCommunicationDispatchSchema = z.object({
  ...audienceFields,
  title: z.string().trim().min(3).max(180),
  message: z.string().trim().min(10).max(10000),
  mode: z.enum(["draft", "send"]).optional().default("draft"),
  confirmConsentSelection: z.boolean().optional().default(false),
}).strict().superRefine((value, context) => {
  if (value.mode === "send" && !value.confirmConsentSelection) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["confirmConsentSelection"],
      message: "Confirmă verificarea audienței și a consimțământului înainte de trimitere.",
    });
  }
});

export type CommunicationAudienceInput = z.output<typeof communicationAudienceSchema>;
export type CreateCommunicationDispatchInput = z.output<typeof createCommunicationDispatchSchema>;
