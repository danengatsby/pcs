import { query } from "./db.js";

export type DemoDataCount = {
  source: string;
  count: number;
};

const demoCountSql = `
  SELECT source, count::INTEGER
  FROM (
    SELECT 'users' AS source, COUNT(*) AS count FROM users WHERE is_demo = TRUE
    UNION ALL SELECT 'volunteers', COUNT(*) FROM volunteers WHERE is_demo = TRUE
    UNION ALL SELECT 'membership_records', COUNT(*) FROM membership_records WHERE is_demo = TRUE
    UNION ALL SELECT 'membership_events', COUNT(*) FROM membership_events WHERE is_demo = TRUE
    UNION ALL SELECT 'organizations', COUNT(*) FROM organizations WHERE is_demo = TRUE
    UNION ALL SELECT 'organization_leadership_mandates', COUNT(*) FROM organization_leadership_mandates WHERE is_demo = TRUE
    UNION ALL SELECT 'organization_objectives', COUNT(*) FROM organization_objectives WHERE is_demo = TRUE
    UNION ALL SELECT 'mobilization_actions', COUNT(*) FROM mobilization_actions WHERE is_demo = TRUE
    UNION ALL SELECT 'mobilization_responses', COUNT(*) FROM mobilization_responses WHERE is_demo = TRUE
    UNION ALL SELECT 'mobilization_participants', COUNT(*) FROM mobilization_participants WHERE is_demo = TRUE
    UNION ALL SELECT 'communication_consents', COUNT(*) FROM communication_consents WHERE is_demo = TRUE
    UNION ALL SELECT 'membership_dues', COUNT(*) FROM membership_dues WHERE is_demo = TRUE
    UNION ALL SELECT 'news', COUNT(*) FROM news WHERE is_demo = TRUE
    UNION ALL SELECT 'public_indicators', COUNT(*) FROM public_indicators WHERE is_demo = TRUE
  ) demo_counts
  WHERE count > 0
  ORDER BY source
`;

export async function readDemoDataCounts(): Promise<DemoDataCount[]> {
  const result = await query<{ source: string; count: number | string }>(demoCountSql);
  return result.rows.map((row) => ({ source: row.source, count: Number(row.count) }));
}

export async function assertNoDemoDataInProduction(nodeEnv: string): Promise<void> {
  if (nodeEnv.trim().toLowerCase() !== "production") {
    return;
  }

  const demoData = await readDemoDataCounts();
  if (demoData.length === 0) {
    return;
  }

  const summary = demoData.map((item) => `${item.source}=${item.count}`).join(", ");
  throw new Error(
    `Pornire blocata: baza de productie contine date demonstrative (${summary}). Ruleaza curatarea controlata inainte de publicare.`,
  );
}
