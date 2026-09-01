import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { encodeNewsAdminCursor } from "./parsing.js";
import type {
  NewsAdminCursor,
  NewsAdminListDbRow,
  NewsDbRow,
  NewsStatus,
  QueryRunner,
} from "./types.js";

type NewsWriteDbInput = {
  title: string;
  summary: string;
  category: string;
  content: string;
  publishedAt: string | undefined;
  status: NewsStatus;
  tags: string[];
};

type NewsDbSelectRow = {
  id: number;
  title: string;
  summary: string;
  category: string;
  content: string;
  publishedAt: Date;
  status: string;
  tags: unknown;
  createdAt: Date;
};

type NewsListSelectRow = {
  id: number;
  title: string;
  summary: string;
  category: string;
  publishedAt: Date;
  status: string;
  tags: unknown;
  createdAt: Date;
};

function parseNewsTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function mapNewsDbRow(row: NewsDbSelectRow): NewsDbRow {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    content: row.content,
    publishedAt: row.publishedAt.toISOString(),
    status: row.status as NewsStatus,
    tags: parseNewsTags(row.tags),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapNewsListRow(row: NewsListSelectRow): NewsAdminListDbRow {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    publishedAt: row.publishedAt.toISOString(),
    status: row.status as NewsStatus,
    tags: parseNewsTags(row.tags),
    createdAt: row.createdAt.toISOString(),
  };
}

function resolveRunner(runner?: QueryRunner): QueryRunner {
  if (runner) {
    return runner;
  }

  return prisma;
}

function isPrismaNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export async function listAdminNewsKeysetPage(input: {
  limit: number;
  cursor: NewsAdminCursor | null;
}): Promise<{ rows: NewsAdminListDbRow[]; nextCursor: string | null }> {
  const cursorDate = input.cursor ? new Date(input.cursor.publishedAt) : null;
  const rows = await prisma.news.findMany({
    where: input.cursor
      ? {
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
      }
      : undefined,
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
      publishedAt: true,
      status: true,
      tags: true,
      createdAt: true,
    },
  });

  const mappedRows = rows.map((row) => mapNewsListRow(row as NewsListSelectRow));
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

export async function readAdminNewsById(
  id: number,
  options?: { runner?: QueryRunner; forUpdate?: boolean }
): Promise<NewsDbRow | null> {
  const db = resolveRunner(options?.runner);
  const row = await db.news.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      title: true,
      summary: true,
      category: true,
      content: true,
      publishedAt: true,
      status: true,
      tags: true,
      createdAt: true,
    },
  });

  if (!row) {
    return null;
  }

  return mapNewsDbRow(row as NewsDbSelectRow);
}

export async function insertAdminNews(input: NewsWriteDbInput, runner: QueryRunner): Promise<NewsDbRow> {
  const row = await runner.news.create({
    data: {
      title: input.title,
      summary: input.summary,
      category: input.category,
      content: input.content,
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : undefined,
      status: input.status,
      tags: input.tags,
    },
    select: {
      id: true,
      title: true,
      summary: true,
      category: true,
      content: true,
      publishedAt: true,
      status: true,
      tags: true,
      createdAt: true,
    },
  });

  return mapNewsDbRow(row as NewsDbSelectRow);
}

export async function updateAdminNewsById(
  id: number,
  input: NewsWriteDbInput,
  runner: QueryRunner
): Promise<NewsDbRow | null> {
  try {
    const row = await runner.news.update({
      where: {
        id,
      },
      data: {
        title: input.title,
        summary: input.summary,
        category: input.category,
        content: input.content,
        publishedAt: input.publishedAt ? new Date(input.publishedAt) : undefined,
        status: input.status,
        tags: input.tags,
      },
      select: {
        id: true,
        title: true,
        summary: true,
        category: true,
        content: true,
        publishedAt: true,
        status: true,
        tags: true,
        createdAt: true,
      },
    });

    return mapNewsDbRow(row as NewsDbSelectRow);
  } catch (error) {
    if (isPrismaNotFound(error)) {
      return null;
    }

    throw error;
  }
}

export async function deleteAdminNewsById(id: number): Promise<number | null> {
  try {
    const row = await prisma.news.delete({
      where: {
        id,
      },
      select: {
        id: true,
      },
    });

    return row.id;
  } catch (error) {
    if (isPrismaNotFound(error)) {
      return null;
    }

    throw error;
  }
}
