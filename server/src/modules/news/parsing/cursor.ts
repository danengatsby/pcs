import type { NewsAdminCursor } from "../types.js";

export function parseNewsAdminCursor(raw: unknown): NewsAdminCursor | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }

  try {
    const decoded = Buffer.from(raw.trim(), "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as { publishedAt?: unknown; id?: unknown };
    if (typeof parsed.publishedAt !== "string") {
      return null;
    }

    const id = Number(parsed.id);
    if (!Number.isInteger(id) || id <= 0) {
      return null;
    }

    if (Number.isNaN(Date.parse(parsed.publishedAt))) {
      return null;
    }

    return {
      publishedAt: parsed.publishedAt,
      id,
    };
  } catch {
    return null;
  }
}

export function encodeNewsAdminCursor(row: { publishedAt: string; id: number }): string {
  return Buffer.from(
    JSON.stringify({
      publishedAt: row.publishedAt,
      id: row.id,
    }),
    "utf8"
  ).toString("base64url");
}
