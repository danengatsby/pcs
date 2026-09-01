import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

function parsePasswordHash(passwordHash: string): { salt: string; keyHex: string } | null {
  const parts = passwordHash.split("$");
  if (parts.length !== 3) {
    return null;
  }

  const [algorithm, salt, keyHex] = parts;
  if (algorithm !== "scrypt" || !salt || !/^[a-f0-9]+$/i.test(keyHex) || keyHex.length % 2 !== 0) {
    return null;
  }

  return { salt, keyHex };
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const parsedHash = parsePasswordHash(passwordHash);
  if (!parsedHash) {
    return false;
  }

  const expectedKey = Buffer.from(parsedHash.keyHex, "hex");
  if (expectedKey.length === 0) {
    return false;
  }

  const derivedKey = (await scrypt(password, parsedHash.salt, expectedKey.length)) as Buffer;
  if (derivedKey.length !== expectedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expectedKey);
}
