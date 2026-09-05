import { prisma } from "../../lib/prisma.js";
import { encodeNewsAdminCursor } from "./parsing.js";
import type { NewsAdminCursor, NewsRow } from "./types.js";

type PublicNewsSelectRow = {
  id: number;
  title: string;
  summary: string;
  category: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: Date;
  tags: unknown;
};

function isPubliclyVisibleWhere(now: Date): {
  isDemo: false;
  publicApprovedAt: { not: null };
  publicApprovedBy: { not: null };
  OR: Array<
    | { status: "published" }
    | { status: "scheduled"; publishedAt: { lte: Date } }
  >;
} {
  return {
    isDemo: false,
    publicApprovedAt: { not: null },
    publicApprovedBy: { not: null },
    OR: [
      { status: "published" },
      { status: "scheduled", publishedAt: { lte: now } },
    ],
  };
}

function parseNewsTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function mapPublicNewsRow(row: PublicNewsSelectRow): NewsRow {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    publishedAt: row.publishedAt.toISOString(),
    tags: parseNewsTags(row.tags),
  };
}

export async function listPublicNewsOffsetPage(input: {
  limit: number;
  offset: number;
}): Promise<{ rows: NewsRow[]; total: number }> {
  const now = new Date();
  const [rows, total] = await Promise.all([
    prisma.news.findMany({
      where: isPubliclyVisibleWhere(now),
      orderBy: [
        { publishedAt: "desc" },
        { id: "desc" },
      ],
      take: input.limit,
      skip: input.offset,
      select: {
        id: true,
        title: true,
        summary: true,
        category: true,
        sourceName: true,
        sourceUrl: true,
        publishedAt: true,
        tags: true,
      },
    }),
    prisma.news.count({
      where: isPubliclyVisibleWhere(now),
    }),
  ]);

  return {
    rows: rows.map((row) => mapPublicNewsRow(row as PublicNewsSelectRow)),
    total,
  };
}

export async function listPublicNewsKeysetPage(input: {
  limit: number;
  cursor: NewsAdminCursor | null;
}): Promise<{ rows: NewsRow[]; nextCursor: string | null }> {
  const now = new Date();
  const cursorDate = input.cursor ? new Date(input.cursor.publishedAt) : null;

  const rows = await prisma.news.findMany({
    where: input.cursor
      ? {
        AND: [
          isPubliclyVisibleWhere(now),
          {
            OR: [
              {
                publishedAt: {
                  lt: cursorDate!,
                },
              },
              {
                publishedAt: cursorDate!,
                id: {
                  lt: input.cursor.id,
                },
              },
            ],
          },
        ],
      }
      : isPubliclyVisibleWhere(now),
    orderBy: [
      { publishedAt: "desc" },
      { id: "desc" },
    ],
    take: input.limit + 1,
    select: {
      id: true,
      title: true,
      summary: true,
      category: true,
      sourceName: true,
      sourceUrl: true,
      publishedAt: true,
      tags: true,
    },
  });

  const mappedRows = rows.map((row) => mapPublicNewsRow(row as PublicNewsSelectRow));
  const hasMore = mappedRows.length > input.limit;
  const pageRows = hasMore ? mappedRows.slice(0, input.limit) : mappedRows;
  const nextCursor = hasMore && pageRows.length > 0
    ? encodeNewsAdminCursor(pageRows[pageRows.length - 1] as { publishedAt: string; id: number })
    : null;

  return {
    rows: pageRows,
    nextCursor,
  };
}
