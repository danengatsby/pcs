import net from "node:net";
import { env } from "../env.js";
import { buildRawMessage, normalizeRecipients } from "./message.js";
import {
  assertExpectedCode,
  createLineReader,
  openSocket,
  readSmtpResponse,
  sendSmtpCommand,
  supportsStartTls,
  upgradeToTlsSocket,
  writeSocket,
} from "./smtpClient.js";
import type { LineReader, SendEmailInput, SmtpSocket } from "./types.js";

const smtpEhloClientName = "pcs-api";

export function isDeliveryUnknownError(error: unknown): boolean {
  return error instanceof Error && Reflect.get(error, "deliveryUnknown") === true;
}

export async function sendEmailViaSmtp(input: SendEmailInput): Promise<void> {
  const recipients = normalizeRecipients(input.to);
  if (recipients.length === 0) {
    return;
  }

  if (!env.emailSmtpHost) {
    throw new Error("EMAIL_SMTP_HOST nu este configurat.");
  }

  let socket: SmtpSocket | null = null;
  let reader: LineReader | null = null;

  try {
    socket = await openSocket();
    reader = createLineReader(socket);

    const greeting = await readSmtpResponse(reader);
    assertExpectedCode(greeting, [220], "Salut SMTP");

    let ehloResponse = await sendSmtpCommand(socket, reader, `EHLO ${smtpEhloClientName}`, [250], "EHLO");

    if (!env.emailSmtpSecure && env.emailSmtpRequireStartTls) {
      if (!supportsStartTls(ehloResponse)) {
        throw new Error("Serverul SMTP nu suporta STARTTLS.");
      }

      await sendSmtpCommand(socket, reader, "STARTTLS", [220], "STARTTLS");
      const previousReader = reader;
      previousReader.dispose();
      reader = null;

      const secureSocket = await upgradeToTlsSocket(socket as net.Socket);
      socket = secureSocket;
      reader = createLineReader(socket);
      ehloResponse = await sendSmtpCommand(socket, reader, `EHLO ${smtpEhloClientName}`, [250], "EHLO dupa STARTTLS");
    }

    if (env.emailSmtpUser) {
      await sendSmtpCommand(socket, reader, "AUTH LOGIN", [334], "AUTH LOGIN");
      await sendSmtpCommand(
        socket,
        reader,
        Buffer.from(env.emailSmtpUser, "utf8").toString("base64"),
        [334],
        "AUTH username"
      );
      await sendSmtpCommand(
        socket,
        reader,
        Buffer.from(env.emailSmtpPass, "utf8").toString("base64"),
        [235],
        "AUTH password"
      );
    }

    await sendSmtpCommand(socket, reader, `MAIL FROM:<${env.emailFrom}>`, [250], "MAIL FROM");

    let acceptedRecipients = 0;
    for (const recipient of recipients) {
      try {
        await sendSmtpCommand(socket, reader, `RCPT TO:<${recipient}>`, [250, 251], `RCPT TO ${recipient}`);
        acceptedRecipients += 1;
      } catch {
        // Continue with remaining recipients.
      }
    }

    if (acceptedRecipients === 0) {
      throw new Error("Niciun destinatar valid acceptat de serverul SMTP.");
    }

    let deliveryAccepted = false;
    try {
      await sendSmtpCommand(socket, reader, "DATA", [354], "DATA");
      deliveryAccepted = true;
      await writeSocket(socket, `${buildRawMessage(input, recipients)}\r\n.\r\n`);
      const sentResponse = await readSmtpResponse(reader);
      assertExpectedCode(sentResponse, [250], "Transmitere email");
    } catch (error) {
      if (deliveryAccepted && error instanceof Error) {
        Reflect.set(error, "deliveryUnknown", true);
      }
      throw error;
    }

    await sendSmtpCommand(socket, reader, "QUIT", [221], "QUIT").catch(() => {
      // Ignore QUIT failures.
    });
  } finally {
    reader?.dispose();
    if (socket && !socket.destroyed) {
      socket.destroy();
    }
  }
}
