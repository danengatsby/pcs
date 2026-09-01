function parsePositiveInteger(raw: unknown): number | null {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

export function parseNewsId(raw: string): number | null {
  return parsePositiveInteger(raw);
}

export function parseLimit(raw: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(raw ?? fallback);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

export function parseOffset(raw: unknown, fallback = 0): number {
  const parsed = Number(raw ?? fallback);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.floor(parsed));
}

export function parseNewsMediaAssetId(raw: string): number | null {
  return parsePositiveInteger(raw);
}
