import { mkdir, unlink } from "node:fs/promises";
import type { NextFunction, Request, Response } from "express";
import { readAuthUser } from "../../../../lib/authMiddleware.js";
import { recordAdminAudit } from "../../../../lib/adminAudit.js";
import { sendSuccess } from "../../../../lib/http.js";
import { withPrismaTransaction } from "../../../../lib/prismaTransaction.js";
import { scanFileWithClamAvOrThrow } from "../../../../lib/clamav.js";
import {
  moveFileSafe,
  newsUploadsDir,
  parseMultipartUpload,
} from "../../media.js";
import type {
  MultipartParseResult,
} from "../../types.js";
import { mapMediaAssetRow } from "./mapMediaAssetRow.js";
import { mapUploadMediaError } from "./uploadMediaError.js";
import { prepareUploadMediaInput } from "./uploadMediaInput.js";

export async function uploadMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
  let parsedUpload: MultipartParseResult | null = null;
  let movedPath = "";

  try {
    parsedUpload = await parseMultipartUpload(req);
    const authUser = readAuthUser(res);
    const upload = await prepareUploadMediaInput(parsedUpload);

    // Optional antivirus scan (ClamAV) before committing DB changes / moving file to uploads.
    await scanFileWithClamAvOrThrow(upload.file.filepath);
    const createdBy = authUser ? Number(authUser.id) : null;

    await mkdir(newsUploadsDir, { recursive: true });

    const asset = await withPrismaTransaction(async (tx) => {
      const inserted = await tx.newsMediaAsset.create({
        data: {
          storagePath: upload.storagePath,
          publicUrl: upload.publicUrl,
          originalName: upload.originalName,
          mimeType: upload.mimeType,
          sizeBytes: BigInt(upload.file.size),
          kind: upload.kind,
          title: upload.title,
          alt: upload.alt,
          createdBy: createdBy ? BigInt(createdBy) : null,
        },
        select: {
          id: true,
          publicUrl: true,
          storagePath: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          kind: true,
          title: true,
          alt: true,
          createdBy: true,
          createdAt: true,
        },
      });

      await moveFileSafe(upload.file.filepath, upload.destinationPath);
      movedPath = upload.destinationPath;
      return inserted;
    });

    if (authUser) {
      await recordAdminAudit({
        actor: {
          userId: authUser.id,
          email: authUser.email,
          role: authUser.role,
        },
        action: "news.media_upload",
        targetType: "news_media_asset",
        targetId: asset.id.toString(),
        details: {
          kind: asset.kind,
          mimeType: asset.mimeType,
          sizeBytes: Number(asset.sizeBytes),
          publicUrl: asset.publicUrl,
        },
      });
    }

    sendSuccess(
      res,
      {
        message: "Media a fost incarcata.",
        asset: mapMediaAssetRow(asset),
        media: {
          assetId: asset.id.toString(),
          url: asset.publicUrl,
          kind: asset.kind,
          title: asset.title,
          alt: asset.alt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (movedPath) {
      await unlink(movedPath).catch(() => {
        // Ignore cleanup errors for moved files after failed DB transaction.
      });
    }

    next(mapUploadMediaError(error));
  } finally {
    if (parsedUpload?.file?.filepath) {
      await unlink(parsedUpload.file.filepath).catch(() => {
        // Ignore cleanup errors for temporary upload files.
      });
    }
  }
}
