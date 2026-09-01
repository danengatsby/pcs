import type { RequestHandler } from "express";
import { sendSuccess } from "../../../lib/http.js";
import { prisma } from "../../../lib/prisma.js";

export const listStatsHandler: RequestHandler = async (_req, res, next) => {
  try {
    const now = new Date();
    const [volunteersCountRows, news] = await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint | number }>>`
        SELECT COUNT(*) AS count
        FROM (
          SELECT LOWER(email) AS email
          FROM volunteers
          UNION
          SELECT LOWER(email) AS email
          FROM users
          WHERE role = 'ADERENT'
        ) AS member_emails
      `,
      prisma.news.count({
        where: {
          OR: [
            { status: "published" },
            {
              status: "scheduled",
              publishedAt: { lte: now },
            },
          ],
        },
      }),
    ]);
    const rawCount = volunteersCountRows[0]?.count ?? 0;
    const volunteers = typeof rawCount === "bigint" ? Number(rawCount) : rawCount;

    sendSuccess(res, {
      volunteers,
      news,
    });
  } catch (error) {
    next(error);
  }
};
