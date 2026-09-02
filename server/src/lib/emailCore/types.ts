import type * as net from "node:net";
import type * as tls from "node:tls";

export type SendEmailInput = {
  eventId?: string;
  to: string[];
  subject: string;
  text: string;
  replyTo?: string;
};

export type SmtpResponse = {
  code: number;
  lines: string[];
};

export type LineReader = {
  nextLine: () => Promise<string>;
  dispose: () => void;
};

export type SmtpSocket = net.Socket | tls.TLSSocket;
