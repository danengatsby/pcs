import type { RequestHandler } from "express";
import { AppError } from "../../lib/errors.js";
import { requireAdminAccess } from "../../lib/adminAuthorization.js";
import { sendSuccess } from "../../lib/http.js";
import { listMembersQuerySchema } from "./members.schema.js";
import { listMembersService } from "./members.service.js";

export const listMembersController: RequestHandler = async (req, res, next) => {
  const parsed = listMembersQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    next(new AppError(400, "MEMBERS_QUERY_INVALID", firstIssue?.message ?? "Parametri invalidi."));
    return;
  }

  try {
    const payload = await listMembersService(parsed.data, requireAdminAccess(res).scope);
    sendSuccess(res, payload.rows, {
      meta: {
        total: payload.total,
        count: payload.rows.length,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
        status: parsed.data.status ?? null,
        search: parsed.data.search,
        leadershipCount: payload.leadershipCount,
      },
    });
  } catch (error) {
    next(error);
  }
};
