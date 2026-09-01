import {
  type NewsAdminListDbRow,
  type NewsAdminListRow,
  type NewsAdminRow,
  type NewsDbRow,
  type NewsDetailRow,
  type NewsMediaItem,
} from "./types.js";

export const publicVisibilityWhereSql = `
  (
    status = 'published'
    OR (
      status = 'scheduled'
      AND published_at <= NOW()
    )
  )
`;

export function toAdminNewsRow(row: NewsDbRow, media: NewsMediaItem[]): NewsAdminRow {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    content: row.content,
    publishedAt: row.publishedAt,
    tags: row.tags,
    media,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export function toAdminNewsListRow(row: NewsAdminListDbRow, media: NewsMediaItem[]): NewsAdminListRow {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    publishedAt: row.publishedAt,
    tags: row.tags,
    media,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export function toPublicNewsDetail(row: NewsDbRow, media: NewsMediaItem[]): NewsDetailRow {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    content: row.content,
    publishedAt: row.publishedAt,
    tags: row.tags,
    media,
  };
}
