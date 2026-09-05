import type { RequestHandler } from "express";
import { AppError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/http.js";
import { governanceJournalQuerySchema } from "./governanceJournal.schema.js";
import { listGovernanceJournalService } from "./governanceJournal.service.js";

export const listGovernanceJournalController: RequestHandler = async (req, res, next) => {
  const parsed = governanceJournalQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(new AppError(400, "GOVERNANCE_JOURNAL_QUERY_INVALID", parsed.error.issues[0]?.message ?? "Parametri invalizi."));
    return;
  }
  try {
    const result = await listGovernanceJournalService(parsed.data);
    sendSuccess(res, result.rows, {
      meta: {
        total: result.total,
        count: result.rows.length,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
        type: parsed.data.type ?? null,
        from: parsed.data.from ?? null,
        to: parsed.data.to ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
};