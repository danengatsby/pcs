import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = process.argv[2] ?? path.join(root, "server", ".env");
const required = [
  "AUTH_TOKEN_SECRET",
  "CORS_ORIGIN",
  "POSTGRES_HOST",
  "POSTGRES_DB",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "NEWS_MEDIA_CLAMAV_ENABLED",
  "NEWS_MEDIA_CLAMAV_MODE",
  "NEWS_MEDIA_CLAMD_HOST",
  "NEWS_MEDIA_CLAMD_PORT",
];

function fail(message) {
  throw new Error(`Production config invalid: ${message}`);
}

function assertRealValue(values, name) {
  const value = values[name]?.trim() ?? "";
  const normalizedValue = value.toLowerCase();
  if (
    !value
    || normalizedValue.startsWith("replace-with-")
    || normalizedValue.startsWith("replace_with_")
    || normalizedValue.includes("generate_")
  ) {
    fail(`${name} este obligatoriu și nu poate folosi placeholder.`);
  }
  return value;
}

function checkClamd(host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port: Number(port) });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("clamd timeout"));
    }, 5000);
    let response = "";
    socket.once("connect", () => socket.write("zPING\0"));
    socket.on("data", (chunk) => { response += chunk.toString(); });
    socket.once("error", reject);
    socket.once("close", () => {
      clearTimeout(timeout);
      const normalizedResponse = response.replaceAll("\0", "").trim();
      if (normalizedResponse !== "PONG") reject(new Error(`clamd răspuns neașteptat: ${normalizedResponse}`));
      else resolve();
    });
  });
}

const values = { ...parse(await fs.readFile(envPath, "utf8")), ...process.env };
for (const name of required) assertRealValue(values, name);
if (values.NODE_ENV !== "production") fail("NODE_ENV trebuie să fie production.");
if (/(^|[_-])(test|testing|demo|seed)([_-]|$)/i.test(values.POSTGRES_DB.trim())) {
  fail("POSTGRES_DB de producție nu poate avea nume de bază test/demo/seed.");
}
if (values.TEST_DATABASE_URL?.trim()) {
  const productionUrl = values.DATABASE_URL?.trim();
  if (productionUrl && productionUrl === values.TEST_DATABASE_URL.trim()) {
    fail("TEST_DATABASE_URL trebuie să fie complet separat de DATABASE_URL.");
  }
  try {
    const testDatabaseName = decodeURIComponent(new URL(values.TEST_DATABASE_URL.trim()).pathname.replace(/^\/+/, ""));
    if (testDatabaseName === values.POSTGRES_DB.trim()) {
      fail("TEST_DATABASE_URL și POSTGRES_DB indică aceeași bază.");
    }
  } catch (error) {
    if (error.message?.startsWith("Production config invalid:")) throw error;
    fail("TEST_DATABASE_URL este invalid.");
  }
}
if (values.NEWS_MEDIA_CLAMAV_ENABLED !== "1") fail("ClamAV trebuie activat.");
if (values.NEWS_MEDIA_CLAMAV_MODE !== "clamd") fail("NEWS_MEDIA_CLAMAV_MODE trebuie să fie clamd.");

const pm2Config = (await import(path.join(root, "ecosystem.config.cjs"))).default;
const apps = pm2Config.apps.filter((app) => app.name.startsWith("pcs-"));
if (apps.length !== 3) fail("ecosystem.config.cjs trebuie să definească API și cei doi workeri.");
for (const app of apps) {
  for (const name of ["NEWS_MEDIA_CLAMAV_ENABLED", "NEWS_MEDIA_CLAMAV_MODE", "NEWS_MEDIA_CLAMD_HOST", "NEWS_MEDIA_CLAMD_PORT"]) {
    if (app.env?.[name] !== values[name]) fail(`${app.name}.${name} nu corespunde env-ului production.`);
  }
}

const clamavPort = values.CLAMAV_PORT?.trim() || "3310";
if (clamavPort !== values.NEWS_MEDIA_CLAMD_PORT) fail("CLAMAV_PORT nu corespunde NEWS_MEDIA_CLAMD_PORT.");
await checkClamd(values.NEWS_MEDIA_CLAMD_HOST, values.NEWS_MEDIA_CLAMD_PORT);
console.log(`Production config valid: ${envPath}; PM2/Docker/ClamAV sunt sincronizate.`);
