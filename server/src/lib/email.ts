import { env } from "./env.js";
import { sendEmailViaSmtp } from "./emailCore/transport.js";
import type { SendEmailInput } from "./emailCore/types.js";

export type { SendEmailInput } from "./emailCore/types.js";

export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (!env.emailNotificationsEnabled) {
    return;
  }

  await sendEmailViaSmtp(input);
}
