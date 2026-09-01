import type { RequestHandler } from "express";
import { AppError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/http.js";
import { listOrganizationsQuerySchema } from "./organizations.schema.js";
import { listOrganizationsService } from "./organizations.service.js";

export const listOrganizationsController: RequestHandler = async (req, res, next) => {
  const parsed = listOrganizationsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    next(new AppError(400, "ORGANIZATIONS_QUERY_INVALID", issue?.message ?? "Parametri invalidi."));
    return;
  }

  try {
    const payload = await listOrganizationsService(parsed.data);
    sendSuccess(res, payload.rows, {
      meta: {
        total: payload.total,
        count: payload.rows.length,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
        level: parsed.data.level ?? null,
        search: parsed.data.search,
      },
    });
  } catch (error) {
    next(error);
  }
};
