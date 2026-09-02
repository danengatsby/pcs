import type { RequestHandler } from "express";
import { AppError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/http.js";
import { listFinanceQuerySchema } from "./finance.schema.js";
import { listFinanceService } from "./finance.service.js";

export const listFinanceController: RequestHandler = async (req, res, next) => {
  const parsed = listFinanceQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    next(new AppError(400, "FINANCE_QUERY_INVALID", issue?.message ?? "Parametri invalidi."));
    return;
  }

  try {
    const payload = await listFinanceService(parsed.data);
    sendSuccess(res, payload.rows, {
      meta: {
        total: payload.total,
        count: payload.rows.length,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
        year: parsed.data.year ?? null,
        type: parsed.data.type ?? null,
        totals: payload.totals,
        governance: payload.governance,
      },
    });
  } catch (error) {
    next(error);
  }
};
