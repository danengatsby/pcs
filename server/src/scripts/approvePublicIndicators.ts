import { closePool, withTransaction } from "../lib/db.js";
import { env } from "../lib/env.js";

const allowedIndicators = new Set(["volunteers", "news", "mobilization_responses"]);
const confirmation = "APPROVE_REVIEWED_INDICATORS";

function readRequestedIndicators(): string[] {
  const values = (process.env.PUBLIC_INDICATORS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length === 0 || values.some((value) => !allowedIndicators.has(value))) {
    throw new Error(
      "PUBLIC_INDICATORS trebuie sa contina una sau mai multe valori: volunteers, news, mobilization_responses.",
    );
  }
  return [...new Set(values)];
}

async function main(): Promise<void> {
  if (env.nodeEnv !== "production") {
    throw new Error("Aprobarea indicatorilor publici necesita NODE_ENV=production.");
  }
  if (process.env.PUBLICATION_APPROVAL_CONFIRM !== confirmation) {
    throw new Error(`Seteaza PUBLICATION_APPROVAL_CONFIRM=${confirmation} dupa verificarea editoriala.`);
  }
  const approverEmail = process.env.PUBLICATION_APPROVER_EMAIL?.trim().toLowerCase();
  if (!approverEmail) {
    throw new Error("PUBLICATION_APPROVER_EMAIL este obligatoriu.");
  }
  const indicators = readRequestedIndicators();

  const result = await withTransaction(async (client) => {
    const approverResult = await client.query<{ id: string; role: string }>(`
      SELECT id, role
      FROM users
      WHERE LOWER(email) = $1 AND is_demo = FALSE
      LIMIT 1
      FOR UPDATE
    `, [approverEmail]);
    const approver = approverResult.rows[0];
    if (!approver || approver.role !== "PRESEDINTE") {
      throw new Error("Aprobatorul trebuie sa fie un cont PRESEDINTE real, existent.");
    }

    const approved: Record<string, number> = {};
    if (indicators.includes("volunteers")) {
      const countResult = await client.query<{ count: number }>(`
        SELECT COUNT(*)::INTEGER AS count
        FROM (
          SELECT LOWER(email) AS email FROM volunteers WHERE is_demo = FALSE
          UNION
          SELECT LOWER(email) AS email FROM users WHERE role = 'ADERENT' AND is_demo = FALSE
        ) public_people
      `);
      approved.volunteers = Number(countResult.rows[0]?.count ?? 0);
    }
    if (indicators.includes("news")) {
      const countResult = await client.query<{ count: number }>(`
        SELECT COUNT(*)::INTEGER AS count
        FROM news
        WHERE is_demo = FALSE
          AND public_approved_at IS NOT NULL
          AND public_approved_by IS NOT NULL
          AND (status = 'published' OR (status = 'scheduled' AND published_at <= NOW()))
      `);
      approved.news = Number(countResult.rows[0]?.count ?? 0);
    }

    for (const [key, value] of Object.entries(approved)) {
      await client.query(`
        INSERT INTO public_indicators (
          key, value, is_demo, calculated_at, approved_at, approved_by, updated_at
        )
        VALUES ($1, $2, FALSE, NOW(), NOW(), $3, NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            is_demo = FALSE,
            calculated_at = EXCLUDED.calculated_at,
            approved_at = EXCLUDED.approved_at,
            approved_by = EXCLUDED.approved_by,
            updated_at = NOW()
      `, [key, value, approver.id]);
    }

    let actionCountsApproved = 0;
    if (indicators.includes("mobilization_responses")) {
      const updateResult = await client.query(`
        UPDATE mobilization_actions action
        SET public_response_count = (
              SELECT COUNT(*)::INTEGER
              FROM mobilization_responses response
              WHERE response.action_id = action.id AND response.is_demo = FALSE
            ),
            response_count_approved_at = NOW(),
            response_count_approved_by = $1,
            updated_at = NOW()
        WHERE action.is_demo = FALSE
          AND action.public_approved_at IS NOT NULL
          AND action.public_approved_by IS NOT NULL
          AND action.status = 'open'
          AND action.visibility = 'public'
      `, [approver.id]);
      actionCountsApproved = updateResult.rowCount ?? 0;
    }

    return { approverEmail, approved, actionCountsApproved };
  });

  console.log("Indicatori publici aprobati editorial:", result);
}

main().catch((error) => {
  console.error("Aprobarea indicatorilor publici a esuat:", error);
  process.exitCode = 1;
}).finally(async () => {
  await closePool();
});
