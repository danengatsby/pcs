import net from "node:net";
import tls from "node:tls";
import { env } from "../env.js";
import type { LineReader, SmtpResponse, SmtpSocket } from "./types.js";

export function writeSocket(socket: SmtpSocket, payload: string): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.write(payload, "utf8", (error?: Error | null) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export function createLineReader(socket: SmtpSocket): LineReader {
  const lines: string[] = [];
  const waiters: Array<{ resolve: (line: string) => void; reject: (error: Error) => void }> = [];
  let buffer = "";
  let endedError: Error | null = null;

  function settleLine(line: string): void {
    const next = waiters.shift();
    if (next) {
      next.resolve(line);
      return;
    }
    lines.push(line);
  }

  function failPending(error: Error): void {
    while (waiters.length > 0) {
      const pending = waiters.shift();
      pending?.reject(error);
    }
  }

  function onData(chunk: Buffer): void {
    buffer += chunk.toString("utf8");
    while (true) {
      const separatorIndex = buffer.indexOf("\n");
      if (separatorIndex < 0) {
        break;
      }
      let line = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 1);
      if (line.endsWith("\r")) {
        line = line.slice(0, -1);
      }
      settleLine(line);
    }
  }

  function onEnd(): void {
    if (!endedError) {
      endedError = new Error("Conexiunea SMTP a fost inchisa.");
      failPending(endedError);
    }
  }

  function onError(error: Error): void {
    endedError = error;
    failPending(error);
  }

  socket.on("data", onData);
  socket.on("end", onEnd);
  socket.on("close", onEnd);
  socket.on("error", onError);

  return {
    nextLine: () => {
      if (lines.length > 0) {
        return Promise.resolve(lines.shift() as string);
      }
      if (endedError) {
        return Promise.reject(endedError);
      }

      return new Promise<string>((resolve, reject) => {
        waiters.push({ resolve, reject });
      });
    },
    dispose: () => {
      socket.off("data", onData);
      socket.off("end", onEnd);
      socket.off("close", onEnd);
      socket.off("error", onError);
      if (!endedError) {
        endedError = new Error("SMTP line reader disposed.");
      }
      failPending(endedError);
    },
  };
}

export async function readSmtpResponse(reader: LineReader): Promise<SmtpResponse> {
  const lines: string[] = [];
  let code = 0;

  while (true) {
    const line = await reader.nextLine();
    lines.push(line);

    if (!/^\d{3}[ -]/.test(line)) {
      throw new Error(`Raspuns SMTP invalid: ${line}`);
    }

    const currentCode = Number(line.slice(0, 3));
    if (!code) {
      code = currentCode;
    }

    if (line[3] === " ") {
      return { code, lines };
    }
  }
}

export function assertExpectedCode(response: SmtpResponse, expectedCodes: number[], action: string): void {
  if (expectedCodes.includes(response.code)) {
    return;
  }
  throw new Error(`${action} esuat (${response.code}): ${response.lines.join(" | ")}`);
}

export async function sendSmtpCommand(
  socket: SmtpSocket,
  reader: LineReader,
  command: string,
  expectedCodes: number[],
  action: string
): Promise<SmtpResponse> {
  await writeSocket(socket, `${command}\r\n`);
  const response = await readSmtpResponse(reader);
  assertExpectedCode(response, expectedCodes, action);
  return response;
}

export function openSocket(): Promise<SmtpSocket> {
  return new Promise((resolve, reject) => {
    const connectOptions = {
      host: env.emailSmtpHost,
      port: env.emailSmtpPort,
    };

    const socket = env.emailSmtpSecure
      ? tls.connect({ ...connectOptions, servername: env.emailSmtpHost })
      : net.connect(connectOptions);

    const onConnectedEvent = env.emailSmtpSecure ? "secureConnect" : "connect";

    const onConnected = (): void => {
      cleanup();
      resolve(socket);
    };

    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };

    const onTimeout = (): void => {
      socket.destroy(new Error("Timeout la conectarea SMTP."));
    };

    function cleanup(): void {
      socket.off(onConnectedEvent, onConnected);
      socket.off("error", onError);
      socket.off("timeout", onTimeout);
    }

    socket.once(onConnectedEvent, onConnected);
    socket.once("error", onError);
    socket.once("timeout", onTimeout);
    socket.setTimeout(env.emailSendTimeoutMs);
  });
}

export function upgradeToTlsSocket(socket: net.Socket): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const secureSocket = tls.connect({
      socket,
      servername: env.emailSmtpHost,
    });

    const onConnected = (): void => {
      cleanup();
      resolve(secureSocket);
    };

    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };

    const onTimeout = (): void => {
      secureSocket.destroy(new Error("Timeout la negocierea STARTTLS."));
    };

    function cleanup(): void {
      secureSocket.off("secureConnect", onConnected);
      secureSocket.off("error", onError);
      secureSocket.off("timeout", onTimeout);
    }

    secureSocket.once("secureConnect", onConnected);
    secureSocket.once("error", onError);
    secureSocket.once("timeout", onTimeout);
    secureSocket.setTimeout(env.emailSendTimeoutMs);
  });
}

export function supportsStartTls(response: SmtpResponse): boolean {
  return response.lines.some((line) => /\bSTARTTLS\b/i.test(line));
}
