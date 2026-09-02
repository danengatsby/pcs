import type { NextFunction, Request, Response } from "express";
import { requireAdminAccess } from "../../../../lib/adminAuthorization.js";
import {
  readVolunteerListFilters,
  volunteerCsvHeader,
  volunteerRowToCsvLine,
} from "../../parsing.js";
import { listAdminVolunteersKeyset } from "../../repository.js";

export async function exportAdminVolunteersCsvHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filters = readVolunteerListFilters({
      status: req.query.status,
      search: req.query.search,
      county: req.query.county,
      locality: req.query.locality,
      skills: req.query.skills,
    });

    const exportDate = new Date().toISOString().slice(0, 10);
    const scope = requireAdminAccess(res).scope;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="pcs-volunteers-${exportDate}.csv"`);
    res.status(200);
    res.write(`\uFEFF${volunteerCsvHeader}\n`);

    const pageLimit = 500;
    let cursorCreatedAt = new Date().toISOString();
    let cursorId = Number.MAX_SAFE_INTEGER;

    while (true) {
      const rows = await listAdminVolunteersKeyset({
        filters,
        scope,
        cursorCreatedAt,
        cursorId,
        limit: pageLimit,
      });

      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        res.write(`${volunteerRowToCsvLine(row)}\n`);
      }

      if (rows.length < pageLimit) {
        break;
      }

      const lastRow = rows[rows.length - 1];
      cursorCreatedAt = lastRow.createdAt;
      cursorId = lastRow.id;
    }

    res.end();
  } catch (error) {
    next(error);
  }
}
