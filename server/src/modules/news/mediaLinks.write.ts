import { AppError } from "../../lib/errors.js";
import type {
  NewsMediaInput,
  NewsMediaKind,
  NewsMediaLinkInsert,
  QueryRunner,
} from "./types.js";

async function readMediaAssetKinds(assetIds: number[], runner: QueryRunner): Promise<Map<number, NewsMediaKind>> {
  const map = new Map<number, NewsMediaKind>();
  if (assetIds.length === 0) {
    return map;
  }

  const rows = await runner.newsMediaAsset.findMany({
    where: {
      id: {
        in: assetIds.map((value) => BigInt(value)),
      },
      deletedAt: null,
    },
    select: {
      id: true,
      kind: true,
    },
  });

  for (const row of rows) {
    map.set(Number(row.id), row.kind as NewsMediaKind);
  }

  return map;
}

export async function buildMediaLinks(media: NewsMediaInput[], runner: QueryRunner): Promise<NewsMediaLinkInsert[]> {
  if (media.length === 0) {
    return [];
  }

  const assetIds = media.map((item) => item.assetId);
  const knownKinds = await readMediaAssetKinds(assetIds, runner);

  const links: NewsMediaLinkInsert[] = [];
  for (let index = 0; index < media.length; index += 1) {
    const item = media[index];
    const defaultKind = knownKinds.get(item.assetId);
    if (!defaultKind) {
      throw new AppError(
        400,
        "NEWS_MEDIA_ASSET_NOT_FOUND",
        `Asset media invalid: ${item.assetId}.`
      );
    }

    links.push({
      assetId: item.assetId,
      kind: item.kind ?? defaultKind,
      title: item.title.trim(),
      alt: item.alt.trim(),
      sortOrder: index,
    });
  }

  return links;
}

export async function replaceNewsMediaLinks(
  newsId: number,
  links: NewsMediaLinkInsert[],
  runner: QueryRunner
): Promise<void> {
  await runner.newsMediaLink.deleteMany({
    where: {
      newsId,
    },
  });

  if (links.length === 0) {
    return;
  }

  await runner.newsMediaLink.createMany({
    data: links.map((link) => ({
      newsId,
      assetId: BigInt(link.assetId),
      kind: link.kind,
      title: link.title,
      alt: link.alt,
      sortOrder: link.sortOrder,
    })),
  });
}
