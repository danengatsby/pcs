import type { NewsStatus } from "../types.js";

export function isNewsPubliclyVisible(status: NewsStatus, publishedAt: string): boolean {
  if (status === "published") {
    return true;
  }

  if (status !== "scheduled") {
    return false;
  }

  const publishedAtTime = Date.parse(publishedAt);
  if (Number.isNaN(publishedAtTime)) {
    return false;
  }

  return publishedAtTime <= Date.now();
}
