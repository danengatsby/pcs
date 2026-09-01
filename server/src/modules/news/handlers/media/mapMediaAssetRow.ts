export function mapMediaAssetRow(row: {
  id: string | number | bigint;
  publicUrl: string;
  originalName: string;
  mimeType: string;
  sizeBytes: string | number | bigint;
  kind: string;
  title: string;
  alt: string;
  createdBy: string | number | bigint | null;
  createdAt: string | Date;
}): {
  id: string;
  publicUrl: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  kind: string;
  title: string;
  alt: string;
  createdBy: string | null;
  createdAt: string;
} {
  return {
    id: String(row.id),
    publicUrl: row.publicUrl,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: Number(row.sizeBytes),
    kind: row.kind,
    title: row.title,
    alt: row.alt,
    createdBy: row.createdBy === null ? null : String(row.createdBy),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}
