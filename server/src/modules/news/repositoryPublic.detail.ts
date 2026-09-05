import { prisma } from "../../lib/prisma.js";
import { toPublicNewsDetail } from "./mappers.js";
import { readNewsMediaMap } from "./repository.js";
import type { NewsDbRow, NewsDetailRow, NewsStatus } from "./types.js";

type PublicNewsDetailSelectRow = {
  id: number;
  title: string;
  summary: string;
  category: string;
  content: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: Date;
  tags: unknown;
  status: string;
  createdAt: Date;
};

function parseNewsTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function mapNewsDbRow(row: PublicNewsDetailSelectRow): NewsDbRow {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    content: row.content,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    publishedAt: row.publishedAt.toISOString(),
    tags: parseNewsTags(row.tags),
    status: row.status as NewsStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function readPublicNewsDetailById(id: number): Promise<NewsDetailRow | null> {
  const now = new Date();
  const row = await prisma.news.findFirst({
    where: {
      id,
      isDemo: false,
      publicApprovedAt: { not: null },
      publicApprovedBy: { not: null },
      OR: [
        { status: "published" },
        { status: "scheduled", publishedAt: { lte: now } },
      ],
    },
    select: {
      id: true,
      title: true,
      summary: true,
      category: true,
      content: true,
      sourceName: true,
      sourceUrl: true,
      publishedAt: true,
      tags: true,
      status: true,
      createdAt: true,
    },
  });

  if (!row) {
    return null;
  }

  const mappedRow = mapNewsDbRow(row as PublicNewsDetailSelectRow);
  const mediaMap = await readNewsMediaMap([id]);
  return toPublicNewsDetail(mappedRow, mediaMap.get(id) ?? []);
}
