import type { RequestHandler } from "express";
import { AppError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/http.js";
import { listElectionsQuerySchema } from "./elections.schema.js";
import { listElectionsService } from "./elections.service.js";

export const listElectionsController: RequestHandler = async (req, res, next) => {
  const parsed = listElectionsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    next(new AppError(400, "ELECTIONS_QUERY_INVALID", issue?.message ?? "Parametri invalidi."));
    return;
  }

  try {
    const payload = await listElectionsService(parsed.data);
    sendSuccess(res, payload.rows, {
      meta: {
        total: payload.total,
        count: payload.rows.length,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
        year: parsed.data.year ?? null,
        type: parsed.data.type ?? null,
        governance: payload.governance,
      },
    });
  } catch (error) {
    next(error);
  }
};
