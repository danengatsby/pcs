import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { query } from "../../lib/db.js";
import { buildTestNewsTitle, deleteNewsById } from "../helpers/dbTestUtils.js";

const app = createApp();

type NewsIdRow = {
  id: number;
};

type NewsItem = {
  id: number;
  title: string;
};

function readNextCursor(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") {
    return null;
  }

  const value = (meta as Record<string, unknown>).nextCursor;
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

async function insertPublishedNews(title: string, publishedAt: string): Promise<number> {
  const result = await query<NewsIdRow>(
    `
      INSERT INTO news (
        title,
        summary,
        category,
        content,
        published_at,
        status,
        tags
      )
      VALUES ($1, $2, 'Comunicat', $3, $4::timestamptz, 'published', $5::jsonb)
      RETURNING id
    `,
    [
      title,
      "Sumar de test pentru keyset pagination pe lista publica de stiri.",
      `Continut test: ${title}`,
      publishedAt,
      JSON.stringify(["keyset-test"]),
    ]
  );

  return Number(result.rows[0]?.id ?? 0);
}

test("public news endpoint should paginate with keyset cursor in stable order", async () => {
  const createdIds: number[] = [];
  const baseTimeMs = Date.parse("2099-02-01T12:00:00.000Z");
  const equalPublishedAt = new Date(baseTimeMs).toISOString();
  const olderPublishedAt = new Date(baseTimeMs - 2000).toISOString();

  const titleTieFirst = buildTestNewsTitle("PUBLIC-KEYSET-A");
  const titleTieSecond = buildTestNewsTitle("PUBLIC-KEYSET-B");
  const titleOlder = buildTestNewsTitle("PUBLIC-KEYSET-C");

  try {
    const idTieFirst = await insertPublishedNews(titleTieFirst, equalPublishedAt);
    const idTieSecond = await insertPublishedNews(titleTieSecond, equalPublishedAt);
    const idOlder = await insertPublishedNews(titleOlder, olderPublishedAt);
    createdIds.push(idTieFirst, idTieSecond, idOlder);

    const pageOne = await request(app)
      .get("/api/news?limit=1")
      .expect(200);

    const pageOneItems = (pageOne.body?.data ?? []) as NewsItem[];
    assert.equal(pageOneItems.length, 1);
    assert.equal(pageOneItems[0]?.id, idTieSecond);
    assert.equal(pageOneItems[0]?.title, titleTieSecond);
    assert.equal(pageOne.body?.meta?.mode, "keyset");

    const cursorOne = readNextCursor(pageOne.body?.meta);
    assert.ok(cursorOne);

    const pageTwo = await request(app)
      .get(`/api/news?limit=1&cursor=${encodeURIComponent(cursorOne ?? "")}`)
      .expect(200);

    const pageTwoItems = (pageTwo.body?.data ?? []) as NewsItem[];
    assert.equal(pageTwoItems.length, 1);
    assert.equal(pageTwoItems[0]?.id, idTieFirst);
    assert.equal(pageTwoItems[0]?.title, titleTieFirst);
    assert.equal(pageTwo.body?.meta?.mode, "keyset");

    const cursorTwo = readNextCursor(pageTwo.body?.meta);
    assert.ok(cursorTwo);

    const pageThree = await request(app)
      .get(`/api/news?limit=1&cursor=${encodeURIComponent(cursorTwo ?? "")}`)
      .expect(200);

    const pageThreeItems = (pageThree.body?.data ?? []) as NewsItem[];
    assert.equal(pageThreeItems.length, 1);
    assert.equal(pageThreeItems[0]?.id, idOlder);
    assert.equal(pageThreeItems[0]?.title, titleOlder);
    assert.equal(pageThree.body?.meta?.mode, "keyset");
  } finally {
    for (const id of createdIds) {
      if (id > 0) {
        await deleteNewsById(id);
      }
    }
  }
});

test("public news endpoint should reject malformed cursor", async () => {
  const response = await request(app)
    .get("/api/news?limit=6&cursor=not-a-valid-cursor")
    .expect(400);

  assert.equal(response.body?.error?.code, "NEWS_CURSOR_INVALID");
});
