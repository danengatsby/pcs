import type { NextFunction, Request, Response } from "express";
import { readAuthUser } from "../../../../lib/authMiddleware.js";
import { recordAdminAudit } from "../../../../lib/adminAudit.js";
import { AppError } from "../../../../lib/errors.js";
import { sendSuccess } from "../../../../lib/http.js";
import { sendNewsPublishedNotificationEmail } from "../../../../lib/notificationEmails.js";
import { withPrismaTransaction } from "../../../../lib/prismaTransaction.js";
import { buildMediaLinks, readNewsMediaMap, replaceNewsMediaLinks } from "../../repository.js";
import { readAdminNewsById, updateAdminNewsById } from "../../repositoryAdmin.js";
import { isNewsPubliclyVisible, normalizeMediaInputs, normalizeTags, parseNewsId } from "../../parsing.js";
import { newsWriteSchema } from "../../schema.js";
import { toAdminNewsRow } from "../../mappers.js";

export async function updateAdminNews(req: Request, res: Response, next: NextFunction): Promise<void> {
  const id = parseNewsId(req.params.id);
  if (!id) {
    next(new AppError(400, "NEWS_ID_INVALID", "ID stire invalid."));
    return;
  }

  const parsed = newsWriteSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    next(new AppError(400, "NEWS_UPDATE_VALIDATION_FAILED", issue?.message ?? "Date stire invalide."));
    return;
  }

  const payload = parsed.data;
  const tags = normalizeTags(payload.tags);
  const media = normalizeMediaInputs(payload.media);

  try {
    const authUser = readAuthUser(res);
    const updatedData = await withPrismaTransaction(async (tx) => {
      const existing = await readAdminNewsById(id, { runner: tx, forUpdate: true });
      if (!existing) {
        throw new AppError(404, "NEWS_NOT_FOUND", "Stirea nu a fost gasita.");
      }

      const existingMediaMap = await readNewsMediaMap([id], tx);
      const existingNews = toAdminNewsRow(existing, existingMediaMap.get(id) ?? []);
      const links = await buildMediaLinks(media, tx);

      const updated = await updateAdminNewsById(
        id,
        {
          title: payload.title,
          summary: payload.summary,
          category: payload.category,
          content: payload.content,
          sourceName: payload.sourceName,
          sourceUrl: payload.sourceUrl,
          publishedAt: payload.publishedAt,
          status: payload.status,
          tags,
          publicApprovedBy: authUser && ["published", "scheduled"].includes(payload.status)
            ? BigInt(authUser.id)
            : null,
        },
        tx
      );

      if (!updated) {
        throw new AppError(404, "NEWS_NOT_FOUND", "Stirea nu a fost gasita.");
      }

      await replaceNewsMediaLinks(updated.id, links, tx);
      const updatedMediaMap = await readNewsMediaMap([updated.id], tx);
      const updatedNews = toAdminNewsRow(updated, updatedMediaMap.get(updated.id) ?? []);

      return {
        existing: existingNews,
        updated: updatedNews,
      };
    });

    if (authUser) {
      await recordAdminAudit({
        actor: {
          userId: authUser.id,
          email: authUser.email,
          role: authUser.role,
        },
        action: "news.update",
        targetType: "news",
        targetId: updatedData.updated.id,
        details: {
          previousTitle: updatedData.existing.title,
          nextTitle: updatedData.updated.title,
          previousCategory: updatedData.existing.category,
          nextCategory: updatedData.updated.category,
          previousStatus: updatedData.existing.status,
          nextStatus: updatedData.updated.status,
          previousTagsCount: updatedData.existing.tags.length,
          nextTagsCount: updatedData.updated.tags.length,
          previousMediaCount: updatedData.existing.media.length,
          nextMediaCount: updatedData.updated.media.length,
        },
      });
    }

    const wasVisible = isNewsPubliclyVisible(updatedData.existing.status, updatedData.existing.publishedAt);
    const isVisible = isNewsPubliclyVisible(updatedData.updated.status, updatedData.updated.publishedAt);

    if (!wasVisible && isVisible) {
      void sendNewsPublishedNotificationEmail({
        id: updatedData.updated.id,
        title: updatedData.updated.title,
        summary: updatedData.updated.summary,
        category: updatedData.updated.category,
        publishedAt: updatedData.updated.publishedAt,
      });
    }

    sendSuccess(res, {
      message: "Stirea a fost actualizata.",
      news: updatedData.updated,
    });
  } catch (error) {
    next(error);
  }
}
