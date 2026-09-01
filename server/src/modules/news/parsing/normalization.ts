import type { NewsMediaInput } from "../types.js";

function stripDiacritics(value: string): string {
  // NFD splits diacritics into combining marks, which we remove.
  // Example: "Iași" -> "Iasi"
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeTags(tags: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of tags) {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (!normalized) {
      continue;
    }

    // Normalization key used for uniqueness:
    // - lowercase
    // - strip diacritics (so "Iași" and "Iasi" are considered the same)
    const key = stripDiacritics(normalized).toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    // Output canonical form: lowercase + no diacritics
    result.push(key);
  }

  return result;
}

export function normalizeMediaInputs(items: NewsMediaInput[]): NewsMediaInput[] {
  const result: NewsMediaInput[] = [];
  const seen = new Set<number>();

  for (const item of items) {
    if (seen.has(item.assetId)) {
      continue;
    }

    seen.add(item.assetId);
    result.push({
      assetId: item.assetId,
      kind: item.kind,
      title: item.title.trim(),
      alt: item.alt.trim(),
    });
  }

  return result;
}
