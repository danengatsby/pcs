import { z } from "zod";
import { newsMediaKindValues, newsStatusValues } from "./types.js";

const publishedAtSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
    message: "Data publicarii este invalida.",
  });

const newsTagSchema = z.string().trim().min(2).max(40);

const sourceUrlSchema = z.string().trim().max(1000).optional().refine(
  (value) => value === undefined || value === "" || /^https?:\/\//i.test(value),
  { message: "Linkul sursei trebuie sa inceapa cu http:// sau https://." }
);

const newsMediaSchema = z.object({
  assetId: z.coerce.number().int().positive(),
  kind: z.enum(newsMediaKindValues).optional(),
  title: z.string().trim().max(180).default(""),
  alt: z.string().trim().max(240).default(""),
}).strict();

export const newsWriteSchema = z.object({
  title: z.string().trim().min(3).max(180),
  summary: z.string().trim().min(10).max(320),
  category: z.string().trim().min(2).max(80).default("Comunicat"),
  content: z.string().trim().min(10).max(20000),
  sourceName: z.string().trim().max(160).optional(),
  sourceUrl: sourceUrlSchema,
  publishedAt: publishedAtSchema,
  status: z.enum(newsStatusValues).default("published"),
  tags: z.array(newsTagSchema).max(20).default([]),
  media: z.array(newsMediaSchema).max(20).default([]),
}).strict().superRefine((value, ctx) => {
  if (value.status === "scheduled" && !value.publishedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["publishedAt"],
      message: "Pentru statusul scheduled trebuie setata data publicarii.",
    });
  }

  if (Boolean(value.sourceName) !== Boolean(value.sourceUrl)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: value.sourceName ? ["sourceUrl"] : ["sourceName"],
      message: "Numele sursei si linkul sursei trebuie completate impreuna.",
    });
  }
});
