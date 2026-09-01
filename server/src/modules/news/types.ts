import type { PrismaTx } from "../../lib/prismaTransaction.js";

export const newsStatusValues = ["draft", "scheduled", "published"] as const;
export const newsMediaKindValues = ["image", "video", "document"] as const;

export type NewsStatus = (typeof newsStatusValues)[number];
export type NewsMediaKind = (typeof newsMediaKindValues)[number];

export type NewsMediaItem = {
  assetId: string;
  url: string;
  kind: NewsMediaKind;
  title: string;
  alt: string;
};

export type NewsMediaInput = {
  assetId: number;
  kind?: NewsMediaKind;
  title: string;
  alt: string;
};

export type NewsRow = {
  id: number;
  title: string;
  summary: string;
  category: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  tags: string[];
};

export type NewsDbRow = NewsRow & {
  content: string;
  status: NewsStatus;
  createdAt: string;
};

export type NewsAdminListDbRow = NewsRow & {
  status: NewsStatus;
  createdAt: string;
};

export type NewsDetailRow = NewsRow & {
  content: string;
  media: NewsMediaItem[];
};

export type NewsAdminRow = NewsDetailRow & {
  status: NewsStatus;
  createdAt: string;
};

export type NewsAdminListRow = NewsRow & {
  media: NewsMediaItem[];
  status: NewsStatus;
  createdAt: string;
};

export type NewsIdRow = {
  id: number;
};

export type CountRow = {
  total: string;
};

export type NewsMediaAssetRow = {
  id: string;
  publicUrl: string;
  storagePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: string;
  kind: NewsMediaKind;
  title: string;
  alt: string;
  createdBy: string | null;
  createdAt: string;
};

export type NewsMediaAssetDeleteRow = {
  id: string;
  storagePath: string;
  publicUrl: string;
};

export type NewsMediaLinkRow = {
  newsId: number;
  assetId: string;
  url: string;
  kind: NewsMediaKind;
  title: string;
  alt: string;
  sortOrder: number;
};

export type MediaAssetLookupRow = {
  id: string;
  kind: NewsMediaKind;
};

export type ExistingAssetRow = {
  id: string;
};

export type AssetUsageCountRow = {
  count: string;
};

export type UploadedFile = {
  filepath: string;
  mimetype?: string | null;
  originalFilename?: string | null;
  size: number;
};

export type MultipartParseResult = {
  fields: Record<string, unknown>;
  file: UploadedFile;
};

export type QueryRunner = {
  news: PrismaTx["news"];
  newsMediaAsset: PrismaTx["newsMediaAsset"];
  newsMediaLink: PrismaTx["newsMediaLink"];
};

export type NewsMediaLinkInsert = {
  assetId: number;
  kind: NewsMediaKind;
  title: string;
  alt: string;
  sortOrder: number;
};

export type NewsAdminCursor = {
  publishedAt: string;
  id: number;
};
