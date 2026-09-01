import type { NextFunction, Request, Response } from "express";
import { readAuthUser } from "../../../../lib/authMiddleware.js";
import { recordAdminAudit } from "../../../../lib/adminAudit.js";
import { AppError } from "../../../../lib/errors.js";
import { sendSuccess } from "../../../../lib/http.js";
import { sendNewsPublishedNotificationEmail } from "../../../../lib/notificationEmails.js";
import { withPrismaTransaction } from "../../../../lib/prismaTransaction.js";
import { buildMediaLinks, readNewsMediaMap, replaceNewsMediaLinks } from "../../repository.js";
import { insertAdminNews } from "../../repositoryAdmin.js";
import { isNewsPubliclyVisible, normalizeMediaInputs, normalizeTags } from "../../parsing.js";
import { newsWriteSchema } from "../../schema.js";
import { toAdminNewsRow } from "../../mappers.js";

export async function createAdminNews(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = newsWriteSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    next(new AppError(400, "NEWS_CREATE_VALIDATION_FAILED", issue?.message ?? "Date stire invalide."));
    return;
  }

  const payload = parsed.data;
  const tags = normalizeTags(payload.tags);
  const media = normalizeMediaInputs(payload.media);

  try {
    const authUser = readAuthUser(res);
    const createdNews = await withPrismaTransaction(async (tx) => {
      const links = await buildMediaLinks(media, tx);
      const inserted = await insertAdminNews(
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
        },
        tx
      );

      await replaceNewsMediaLinks(inserted.id, links, tx);
      const mediaMap = await readNewsMediaMap([inserted.id], tx);
      return toAdminNewsRow(inserted, mediaMap.get(inserted.id) ?? []);
    });

    if (authUser) {
      await recordAdminAudit({
        actor: {
          userId: authUser.id,
          email: authUser.email,
          role: authUser.role,
        },
        action: "news.create",
        targetType: "news",
        targetId: createdNews.id,
        details: {
          title: createdNews.title,
          category: createdNews.category,
          status: createdNews.status,
          tagsCount: tags.length,
          mediaCount: createdNews.media.length,
        },
      });
    }

    if (isNewsPubliclyVisible(createdNews.status, createdNews.publishedAt)) {
      void sendNewsPublishedNotificationEmail({
        id: createdNews.id,
        title: createdNews.title,
        summary: createdNews.summary,
        category: createdNews.category,
        publishedAt: createdNews.publishedAt,
      });
    }

    sendSuccess(
      res,
      {
        message: "Stirea a fost creata.",
        news: createdNews,
      },
      { status: 201 }
    );
  } catch (error) {
    next(error);
  }
}
