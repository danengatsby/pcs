import { createReadStream } from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";
import { AppError } from "./errors.js";

export type ClamAvConfig = {
  enabled: boolean;
  /**
   * Scan mode:
   * - "exec": runs clamscan locally (requires clamscan installed alongside the server)
   * - "clamd": streams file to a clamd daemon over TCP (recommended for containerized setups)
   */
  mode: "exec" | "clamd";
  clamscanPath: string;
  timeoutMs: number;

  clamdHost: string;
  clamdPort: number;
};

export function readClamAvConfigFromEnv(): ClamAvConfig {
  const enabled = (process.env.NEWS_MEDIA_CLAMAV_ENABLED ?? "").trim() === "1";
  const modeRaw = (process.env.NEWS_MEDIA_CLAMAV_MODE ?? "").trim().toLowerCase();
  const mode: "exec" | "clamd" = modeRaw === "clamd" ? "clamd" : "exec";

  const clamscanPath = (process.env.NEWS_MEDIA_CLAMSCAN_PATH ?? "").trim() || "clamscan";

  const timeoutRaw = (process.env.NEWS_MEDIA_CLAMAV_TIMEOUT_MS ?? "").trim();
  const timeoutParsed = timeoutRaw ? Number(timeoutRaw) : NaN;
  const timeoutMs = Number.isFinite(timeoutParsed) && timeoutParsed > 0 ? Math.floor(timeoutParsed) : 30_000;

  const clamdHost = (process.env.NEWS_MEDIA_CLAMD_HOST ?? "").trim() || "pcs-clamav";
  const clamdPortRaw = (process.env.NEWS_MEDIA_CLAMD_PORT ?? "").trim();
  const clamdPortParsed = clamdPortRaw ? Number(clamdPortRaw) : NaN;
  const clamdPort = Number.isFinite(clamdPortParsed) && clamdPortParsed > 0 ? Math.floor(clamdPortParsed) : 3310;

  return { enabled, mode, clamscanPath, timeoutMs, clamdHost, clamdPort };
}

export function validateClamAvConfigForEnvironment(nodeEnv: string, config = readClamAvConfigFromEnv()): void {
  if (nodeEnv !== "production") {
    return;
  }

  if (!config.enabled) {
    throw new Error("NEWS_MEDIA_CLAMAV_ENABLED=1 este obligatoriu in productie.");
  }
}

export async function checkClamAvAvailability(
  config = readClamAvConfigFromEnv()
): Promise<{ status: "up" | "down" | "disabled"; message: string }> {
  if (!config.enabled) {
    return { status: "disabled", message: "ClamAV dezactivat." };
  }

  if (config.mode === "clamd") {
    return new Promise((resolve) => {
      const socket = net.createConnection({ host: config.clamdHost, port: config.clamdPort });
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({ status: "down", message: "ClamAV daemon timeout." });
      }, config.timeoutMs);

      socket.once("connect", () => {
        clearTimeout(timeout);
        socket.end();
        resolve({ status: "up", message: "ok" });
      });
      socket.once("error", (error) => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ status: "down", message: error.message });
      });
    });
  }

  return new Promise((resolve) => {
    const child = spawn(config.clamscanPath, ["--version"], { stdio: "ignore" });
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ status: "down", message: "ClamAV executable timeout." });
    }, config.timeoutMs);

    child.once("error", (error) => {
      clearTimeout(timeout);
      resolve({ status: "down", message: error.message });
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      resolve(code === 0 ? { status: "up", message: "ok" } : { status: "down", message: `clamscan exit ${code}` });
    });
  });
}

type ScanResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

function runClamscan(filePath: string, config: ClamAvConfig): Promise<ScanResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(config.clamscanPath, ["--no-summary", "--stdout", filePath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new AppError(503, "NEWS_MEDIA_SCAN_TIMEOUT", "Scanarea antivirus a expirat."));
    }, config.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ exitCode: code, stdout, stderr });
    });
  });
}

function parseClamdResponse(raw: string): "OK" | "FOUND" | "ERROR" {
  // clamd INSTREAM responses typically look like:
  // - "stream: OK"
  // - "stream: Eicar-Test-Signature FOUND"
  // - "... ERROR"
  const upper = raw.toUpperCase();
  if (upper.includes(" FOUND")) {return "FOUND";}
  if (upper.includes(": OK")) {return "OK";}
  return "ERROR";
}

async function scanFileWithClamdOrThrow(filePath: string, config: ClamAvConfig): Promise<void> {
  // INSTREAM protocol: client sends "zINSTREAM\0", then multiple chunks each preceded by
  // 4-byte big-endian length, terminated by a 0-length chunk.
  // Server responds with a single line.
  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection(
      { host: config.clamdHost, port: config.clamdPort },
      () => {
        socket.write("zINSTREAM\0");
        const stream = createReadStream(filePath, { highWaterMark: 64 * 1024 });

        stream.on("data", (chunk) => {
          const len = Buffer.alloc(4);
          len.writeUInt32BE(chunk.length, 0);
          socket.write(len);
          socket.write(chunk);
        });

        stream.on("end", () => {
          const zero = Buffer.alloc(4);
          zero.writeUInt32BE(0, 0);
          socket.end(zero);
        });

        stream.on("error", (err) => {
          socket.destroy();
          reject(err);
        });
      }
    );

    let response = "";
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new AppError(503, "NEWS_MEDIA_SCAN_TIMEOUT", "Scanarea antivirus a expirat."));
    }, config.timeoutMs);

    socket.on("data", (data) => {
      response += data.toString("utf8");
    });

    socket.on("error", () => {
      clearTimeout(timeout);
      reject(new AppError(503, "NEWS_MEDIA_SCAN_FAILED", "Scanarea antivirus nu este disponibila momentan."));
    });

    socket.on("close", () => {
      clearTimeout(timeout);

      const verdict = parseClamdResponse(response);
      if (verdict === "OK") {return resolve();}
      if (verdict === "FOUND") {
        return reject(new AppError(400, "NEWS_MEDIA_INFECTED", "Fisierul contine continut periculos."));
      }

      return reject(new AppError(503, "NEWS_MEDIA_SCAN_FAILED", "Scanarea antivirus nu este disponibila momentan."));
    });
  });
}

/**
 * ClamAV exit codes:
 * - 0 => no virus found
 * - 1 => virus found
 * - 2 => error
 */
export async function scanFileWithClamAvOrThrow(filePath: string): Promise<void> {
  const config = readClamAvConfigFromEnv();
  if (!config.enabled) {return;}

  if (config.mode === "clamd") {
    await scanFileWithClamdOrThrow(filePath, config);
    return;
  }

  const result = await runClamscan(filePath, config);

  if (result.exitCode === 0) {return;}
  if (result.exitCode === 1) {
    throw new AppError(400, "NEWS_MEDIA_INFECTED", "Fisierul contine continut periculos.");
  }

  throw new AppError(503, "NEWS_MEDIA_SCAN_FAILED", "Scanarea antivirus nu este disponibila momentan.");
}
