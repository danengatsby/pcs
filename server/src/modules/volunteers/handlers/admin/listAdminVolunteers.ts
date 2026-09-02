import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../../../lib/errors.js";
import { requireAdminAccess } from "../../../../lib/adminAuthorization.js";
import { sendSuccess } from "../../../../lib/http.js";
import {
  encodeVolunteerCursor,
  parsePositiveInt,
  parseVolunteerCursor,
  readVolunteerListFilters,
} from "../../parsing.js";
import { listAdminVolunteersKeyset } from "../../repository.js";

export async function listAdminVolunteersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = parsePositiveInt(req.query.limit, 80, 1, 300);
    const rawCursor = typeof req.query.cursor === "string" ? req.query.cursor.trim() : "";
    const cursor = parseVolunteerCursor(rawCursor);
    if (rawCursor && !cursor) {
      next(new AppError(400, "VOLUNTEERS_CURSOR_INVALID", "Cursor invalid."));
      return;
    }

    const filters = readVolunteerListFilters({
      status: req.query.status,
      search: req.query.search,
      county: req.query.county,
      locality: req.query.locality,
      skills: req.query.skills,
    });

    const cursorCreatedAt = cursor?.createdAt ?? new Date().toISOString();
    const cursorId = cursor?.id ?? Number.MAX_SAFE_INTEGER;
    const rows = await listAdminVolunteersKeyset({
      filters,
      scope: requireAdminAccess(res).scope,
      cursorCreatedAt,
      cursorId,
      limit: limit + 1,
    });
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore && pageRows.length > 0
      ? encodeVolunteerCursor(pageRows[pageRows.length - 1] as { createdAt: string; id: number })
      : null;

    sendSuccess(res, pageRows, {
      meta: {
        count: pageRows.length,
        limit,
        nextCursor,
        mode: "keyset",
      },
    });
  } catch (error) {
    next(error);
  }
}
