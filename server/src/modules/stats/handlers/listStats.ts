import type { RequestHandler } from "express";
import { sendSuccess } from "../../../lib/http.js";
import { query } from "../../../lib/db.js";
import { AppError } from "../../../lib/errors.js";
import { publicVolunteerCount, volunteerStatisticsPrivacy } from "../privacy.js";

export const listStatsHandler: RequestHandler = async (req, res, next) => {
  try {
    if (Object.keys(req.query).length > 0) {
      throw new AppError(400, "BAD_REQUEST", "Statisticile publice sunt naționale și nu acceptă filtre.");
    }
    const indicators = await query<{ key: string; value: string }>(`
      SELECT key, value::TEXT
      FROM public_indicators
      WHERE key = ANY($1::varchar[])
        AND is_demo = FALSE
        AND approved_at IS NOT NULL
        AND approved_by IS NOT NULL
    `, [["volunteers", "news"]]);
    const valueByKey = new Map(indicators.rows.map((row) => [row.key, Number(row.value)]));

    sendSuccess(res, {
      volunteers: publicVolunteerCount(valueByKey.get("volunteers")),
      news: valueByKey.get("news") ?? null,
    }, {
      meta: { volunteerStatistics: volunteerStatisticsPrivacy },
    });
  } catch (error) {
    next(error);
  }
};
