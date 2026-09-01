import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../../../lib/errors.js";
import { sendSuccess } from "../../../../lib/http.js";
import { parseLimit, parseNewsAdminCursor, parseOffset } from "../../parsing.js";
import { listPublicNewsKeysetPage, listPublicNewsOffsetPage } from "../../repositoryPublic.js";

export async function listPublicNews(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = parseLimit(req.query.limit, 6, 1, 24);
    const mode = typeof req.query.mode === "string" ? req.query.mode.trim().toLowerCase() : "";
    const useOffsetMode = mode === "offset";

    if (useOffsetMode) {
      const offset = parseOffset(req.query.offset, 0);
      const result = await listPublicNewsOffsetPage({
        limit,
        offset,
      });

      sendSuccess(res, result.rows, {
        meta: {
          count: result.rows.length,
          total: result.total,
          limit,
          offset,
          mode: "offset",
        },
      });
      return;
    }

    const rawCursor = typeof req.query.cursor === "string" ? req.query.cursor.trim() : "";
    const cursor = parseNewsAdminCursor(rawCursor);
    if (rawCursor && !cursor) {
      next(new AppError(400, "NEWS_CURSOR_INVALID", "Cursor invalid."));
      return;
    }

    const result = await listPublicNewsKeysetPage({
      limit,
      cursor,
    });

    sendSuccess(res, result.rows, {
      meta: {
        count: result.rows.length,
        limit,
        nextCursor: result.nextCursor,
        mode: "keyset",
      },
    });
  } catch (error) {
    next(error);
  }
}
