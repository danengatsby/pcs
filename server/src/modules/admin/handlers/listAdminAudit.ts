import type { RequestHandler } from "express";
import { listAdminAudit, parseAdminAuditCursor } from "../../../lib/adminAudit.js";
import { AppError } from "../../../lib/errors.js";
import { sendSuccess } from "../../../lib/http.js";
import { parsePositiveInt } from "../admin.shared.js";

export const listAdminAuditHandler: RequestHandler = async (req, res, next) => {
  try {
    const limit = parsePositiveInt(req.query.limit, 80, 1, 300);
    const rawCursor = typeof req.query.cursor === "string" ? req.query.cursor.trim() : "";
    const cursor = parseAdminAuditCursor(rawCursor);
    if (rawCursor && !cursor) {
      next(new AppError(400, "ADMIN_AUDIT_CURSOR_INVALID", "Cursor audit invalid."));
      return;
    }

    const action = typeof req.query.action === "string" ? req.query.action.trim() : "";
    const targetType = typeof req.query.targetType === "string" ? req.query.targetType.trim() : "";
    const targetId = typeof req.query.targetId === "string" ? req.query.targetId.trim() : "";
    const actionValue = action || null;
    const targetTypeValue = targetType || null;
    const targetIdValue = targetId || null;

    const result = await listAdminAudit({
      limit,
      action: actionValue,
      targetType: targetTypeValue,
      targetId: targetIdValue,
      cursor,
    });

    sendSuccess(res, result.rows, {
      meta: {
        count: result.rows.length,
        limit,
        nextCursor: result.nextCursor,
      },
    });
  } catch (error) {
    next(error);
  }
};
