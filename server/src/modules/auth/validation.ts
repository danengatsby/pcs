import { z } from "zod";
import { strongPasswordMessage, strongPasswordPattern } from "../../lib/passwordPolicy.js";

export const signupSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(180),
  password: z.string().min(10, strongPasswordMessage).max(128).regex(strongPasswordPattern, strongPasswordMessage),
}).strict();

export const signinSchema = z.object({
  email: z.string().trim().email().max(180),
  password: z.string().min(1).max(128),
}).strict();
