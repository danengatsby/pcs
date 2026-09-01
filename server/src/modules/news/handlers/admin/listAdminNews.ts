import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../../../lib/errors.js";
import { sendSuccess } from "../../../../lib/http.js";
import { readNewsMediaMap } from "../../repository.js";
import { listAdminNewsKeysetPage } from "../../repositoryAdmin.js";
import { parseLimit, parseNewsAdminCursor } from "../../parsing.js";
import { toAdminNewsListRow } from "../../mappers.js";

export async function listAdminNews(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = parseLimit(req.query.limit, 120, 1, 500);
    const rawCursor = typeof req.query.cursor === "string" ? req.query.cursor.trim() : "";
    const cursor = parseNewsAdminCursor(rawCursor);
    if (rawCursor && !cursor) {
      next(new AppError(400, "NEWS_ADMIN_CURSOR_INVALID", "Cursor invalid."));
      return;
    }

    const page = await listAdminNewsKeysetPage({
      limit,
      cursor,
    });
    const pageRows = page.rows;
    const mediaMap = await readNewsMediaMap(pageRows.map((row) => row.id));
    const rows = pageRows.map((row) => toAdminNewsListRow(row, mediaMap.get(row.id) ?? []));

    sendSuccess(res, rows, {
      meta: {
        count: rows.length,
        limit,
        nextCursor: page.nextCursor,
        mode: "keyset",
      },
    });
  } catch (error) {
    next(error);
  }
}
