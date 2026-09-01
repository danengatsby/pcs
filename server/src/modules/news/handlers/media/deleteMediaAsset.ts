import type { NextFunction, Request, Response } from "express";
import { readAuthUser } from "../../../../lib/authMiddleware.js";
import { recordAdminAudit } from "../../../../lib/adminAudit.js";
import { AppError } from "../../../../lib/errors.js";
import { sendSuccess } from "../../../../lib/http.js";
import { withPrismaTransaction } from "../../../../lib/prismaTransaction.js";
import { parseNewsMediaAssetId } from "../../parsing.js";

export async function deleteMediaAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
  const assetId = parseNewsMediaAssetId(req.params["assetId"]);
  if (!assetId) {
    next(new AppError(400, "NEWS_MEDIA_ASSET_ID_INVALID", "ID media invalid."));
    return;
  }

  try {
    const authUser = readAuthUser(res);
    const deleted = await withPrismaTransaction(async (tx) => {
      const existing = await tx.newsMediaAsset.findFirst({
        where: {
          id: BigInt(assetId),
          deletedAt: null,
        },
        select: {
          id: true,
          publicUrl: true,
        },
      });

      if (!existing) {
        return null;
      }

      const usageCount = await tx.newsMediaLink.count({
        where: {
          assetId: BigInt(assetId),
        },
      });
      if (usageCount > 0) {
        throw new AppError(
          409,
          "NEWS_MEDIA_ASSET_IN_USE",
          "Asset-ul media este folosit in stiri si nu poate fi dezactivat."
        );
      }

      const updated = await tx.newsMediaAsset.update({
        where: {
          id: BigInt(assetId),
        },
        data: {
          deletedAt: new Date(),
        },
        select: {
          id: true,
          publicUrl: true,
        },
      });

      return {
        id: updated.id.toString(),
        publicUrl: updated.publicUrl,
      };
    });

    if (!deleted) {
      next(new AppError(404, "NEWS_MEDIA_ASSET_NOT_FOUND", "Asset-ul media nu a fost gasit."));
      return;
    }

    if (authUser) {
      await recordAdminAudit({
        actor: {
          userId: authUser.id,
          email: authUser.email,
          role: authUser.role,
        },
        action: "news.media_soft_delete",
        targetType: "news_media_asset",
        targetId: deleted.id,
        details: {
          publicUrl: deleted.publicUrl,
        },
      });
    }

    sendSuccess(res, {
      message: "Media a fost dezactivata.",
      id: deleted.id,
      publicUrl: deleted.publicUrl,
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    next(new AppError(500, "NEWS_MEDIA_DELETE_FAILED", "Nu am putut dezactiva asset-ul media."));
  }
}
