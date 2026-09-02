import { z } from "zod";
import { strongPasswordMessage, strongPasswordPattern } from "../../lib/passwordPolicy.js";

const signinUsernamePattern = /^[a-zA-Z0-9._+-]{1,80}$/;
const signinIdentifierSchema = z.string()
  .trim()
  .min(1, "Introdu utilizatorul.")
  .max(180)
  .refine(
    (value) => z.string().email().safeParse(value).success || signinUsernamePattern.test(value),
    "Introdu un utilizator valid."
  );

export const signupSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(180),
  password: z.string().min(10, strongPasswordMessage).max(128).regex(strongPasswordPattern, strongPasswordMessage),
}).strict();

export const signinSchema = z.object({
  email: signinIdentifierSchema,
  password: z.string().min(1).max(128),
}).strict();
