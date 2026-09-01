import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "./env.js";

export type UserRole =
  | "SUSTINATOR"
  | "ADERENT"
  | "MEMBRU"
  | "CONSILIER"
  | "SECRETAR"
  | "VICEPRESEDINTE"
  | "PRESEDINTE";

export type AuthTokenPayload = {
  sub: string;
  role: UserRole;
  fullName: string;
  email: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  jti: string;
};

const authTokenKey = new TextEncoder().encode(env.authTokenSecret);

function isUserRole(value: unknown): value is UserRole {
  return (
    value === "SUSTINATOR"
    || value === "ADERENT"
    || value === "MEMBRU"
    || value === "CONSILIER"
    || value === "SECRETAR"
    || value === "VICEPRESEDINTE"
    || value === "PRESEDINTE"
  );
}

function readAudience(aud: JWTPayload["aud"]): string | null {
  if (typeof aud === "string" && aud) {
    return aud;
  }

  if (Array.isArray(aud)) {
    const first = aud.find((value) => typeof value === "string" && value.length > 0);
    return first ?? null;
  }

  return null;
}

function parseTokenPayload(payload: JWTPayload): AuthTokenPayload | null {
  const role = payload.role;
  const fullName = payload.fullName;
  const email = payload.email;
  const audience = readAudience(payload.aud);

  if (
    typeof payload.sub !== "string" ||
    typeof payload.iat !== "number" ||
    typeof payload.exp !== "number" ||
    typeof payload.iss !== "string" ||
    typeof payload.jti !== "string" ||
    !audience ||
    !isUserRole(role) ||
    typeof fullName !== "string" ||
    typeof email !== "string"
  ) {
    return null;
  }

  return {
    sub: payload.sub,
    role,
    fullName,
    email,
    iat: payload.iat,
    exp: payload.exp,
    iss: payload.iss,
    aud: audience,
    jti: payload.jti,
  };
}

export async function createAuthToken(payload: {
  id: string;
  role: UserRole;
  fullName: string;
  email: string;
}): Promise<string> {
  return new SignJWT({
    role: payload.role,
    fullName: payload.fullName,
    email: payload.email,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.id)
    .setIssuer(env.authTokenIssuer)
    .setAudience(env.authTokenAudience)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${env.authTokenTtlSeconds}s`)
    .sign(authTokenKey);
}

export async function verifyAuthToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, authTokenKey, {
      algorithms: ["HS256"],
      issuer: env.authTokenIssuer,
      audience: env.authTokenAudience,
    });

    return parseTokenPayload(payload);
  } catch {
    return null;
  }
}

export function readBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (!scheme || !token) {
    return null;
  }

  if (scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return token.trim() || null;
}
