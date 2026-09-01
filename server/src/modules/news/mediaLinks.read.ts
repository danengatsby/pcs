import { prisma } from "../../lib/prisma.js";
import type { NewsMediaItem, NewsMediaKind, QueryRunner } from "./types.js";

function resolveRunner(runner?: QueryRunner): QueryRunner {
  if (runner) {
    return runner;
  }

  return prisma;
}

export async function readNewsMediaMap(newsIds: number[], runner?: QueryRunner): Promise<Map<number, NewsMediaItem[]>> {
  const map = new Map<number, NewsMediaItem[]>();
  if (newsIds.length === 0) {
    return map;
  }

  const db = resolveRunner(runner);
  const rows = await db.newsMediaLink.findMany({
    where: {
      newsId: {
        in: newsIds,
      },
      asset: {
        deletedAt: null,
      },
    },
    orderBy: [
      { newsId: "asc" },
      { sortOrder: "asc" },
      { id: "asc" },
    ],
    select: {
      newsId: true,
      assetId: true,
      kind: true,
      title: true,
      alt: true,
      asset: {
        select: {
          publicUrl: true,
        },
      },
    },
  });

  for (const row of rows) {
    const current = map.get(row.newsId) ?? [];
    current.push({
      assetId: row.assetId.toString(),
      url: row.asset.publicUrl,
      kind: row.kind as NewsMediaKind,
      title: row.title,
      alt: row.alt,
    });
    map.set(row.newsId, current);
  }

  return map;
}
