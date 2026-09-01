import type { NextFunction, Request, Response } from "express";
import { readAuthUser } from "../../../../lib/authMiddleware.js";
import { recordAdminAudit } from "../../../../lib/adminAudit.js";
import { AppError } from "../../../../lib/errors.js";
import { sendSuccess } from "../../../../lib/http.js";
import { readNewsMediaMap } from "../../repository.js";
import { deleteAdminNewsById, readAdminNewsById } from "../../repositoryAdmin.js";
import { parseNewsId } from "../../parsing.js";
import { toAdminNewsRow } from "../../mappers.js";

export async function deleteAdminNews(req: Request, res: Response, next: NextFunction): Promise<void> {
  const id = parseNewsId(req.params.id);
  if (!id) {
    next(new AppError(400, "NEWS_ID_INVALID", "ID stire invalid."));
    return;
  }

  try {
    const authUser = readAuthUser(res);
    const existing = await readAdminNewsById(id);
    if (!existing) {
      next(new AppError(404, "NEWS_NOT_FOUND", "Stirea nu a fost gasita."));
      return;
    }

    const existingMediaMap = await readNewsMediaMap([id]);
    const existingNews = toAdminNewsRow(existing, existingMediaMap.get(id) ?? []);

    const deletedId = await deleteAdminNewsById(id);
    if (!deletedId) {
      next(new AppError(404, "NEWS_NOT_FOUND", "Stirea nu a fost gasita."));
      return;
    }

    if (authUser) {
      await recordAdminAudit({
        actor: {
          userId: authUser.id,
          email: authUser.email,
          role: authUser.role,
        },
        action: "news.delete",
        targetType: "news",
        targetId: deletedId,
        details: {
          title: existingNews.title,
          category: existingNews.category,
          status: existingNews.status,
          tagsCount: existingNews.tags.length,
          mediaCount: existingNews.media.length,
        },
      });
    }

    sendSuccess(res, {
      message: "Stirea a fost stearsa.",
      id: deletedId,
    });
  } catch (error) {
    next(error);
  }
}
