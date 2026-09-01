import type { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../../../lib/http.js";
import { prisma } from "../../../../lib/prisma.js";
import { parseLimit } from "../../parsing.js";
import { mapMediaAssetRow } from "./mapMediaAssetRow.js";

export async function listMediaLibrary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = parseLimit(req.query.limit, 120, 1, 500);
    const rows = await prisma.newsMediaAsset.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit,
      select: {
        id: true,
        publicUrl: true,
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

    sendSuccess(
      res,
      rows.map(mapMediaAssetRow),
      {
        meta: {
          count: rows.length,
          limit,
        },
      }
    );
  } catch (error) {
    next(error);
  }
}
