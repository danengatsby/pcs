import { randomBytes } from "node:crypto";
import { withTransaction } from "./db.js";
import { env } from "./env.js";
import { hashPassword } from "./password.js";
import { assertAdminDemoEnvironment } from "./adminDemoPolicy.js";

const domain = "admin-demo.example.test";
const regions = [
  { key: "cluj", county: "Cluj", locality: "Cluj-Napoca" },
  { key: "iasi", county: "Iași", locality: "Iași" },
  { key: "timis", county: "Timiș", locality: "Timișoara" },
];
const firstNames = ["Adriana", "Andrei", "Camelia", "Cristian", "Daniela", "Florin", "Ioana", "Mihai", "Raluca", "Sorin"];
const lastNames = ["Avram", "Badea", "Dima", "Enache", "Florea", "Georgescu", "Ionescu", "Marin", "Popa"];

export async function seedAdminDemoData() {
  if (!env.adminDemoDataAllowed) {
    throw new Error("Setul administrativ demonstrativ necesita ADMIN_DEMO_DATA_ALLOWED=true.");
  }
  assertAdminDemoEnvironment({ nodeEnv: env.nodeEnv, databaseUrl: env.databaseUrl, enabled: true, emailNotificationsEnabled: env.emailNotificationsEnabled });
  // No usable credentials, contact consent, notifications or publication approvals are generated.
  const passwordHash = await hashPassword(randomBytes(48).toString("base64url"));
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('pcs-admin-demo-v1'))");
    const collision = await client.query(`
      SELECT 1 FROM users WHERE email LIKE $1 AND is_demo = FALSE
      UNION ALL SELECT 1 FROM volunteers WHERE email LIKE $1 AND is_demo = FALSE
      UNION ALL SELECT 1 FROM membership_records WHERE email LIKE $1 AND is_demo = FALSE
      UNION ALL SELECT 1 FROM organizations WHERE id LIKE 'admin-demo-%' AND is_demo = FALSE
    `, [`%@${domain}`]);
    if (collision.rowCount) {
      throw new Error("Identificatorii demonstrativi se suprapun cu date existente nemarcate Demo.");
    }
    const counties = await client.query<{ id: number; name: string }>("SELECT id, name FROM counties WHERE name = ANY($1)", [regions.map((region) => region.county)]);
    if (counties.rows.length !== regions.length) {
      throw new Error("Nomenclatorul judetelor nu este complet.");
    }
    const countyId = new Map(counties.rows.map((row) => [row.name, row.id]));
    const organizations = [
      { id: "admin-demo-national", name: "Organizația națională (Demo)", level: "national", county: "", locality: "", parent: null },
      ...regions.map((region) => ({ id: `admin-demo-county-${region.key}`, name: `Filiala ${region.county} (Demo)`, level: "county", county: region.county, locality: "", parent: "admin-demo-national" })),
      ...regions.map((region) => ({ id: `admin-demo-local-${region.key}`, name: `Organizația ${region.locality} (Demo)`, level: "local", county: region.county, locality: region.locality, parent: `admin-demo-county-${region.key}` })),
    ];
    for (const organization of organizations) {
      await client.query(`
        INSERT INTO organizations (id, code, name, level, county, status, parent_id, official_email, headquarters, founded_at, is_demo)
        VALUES ($1, $1, $2, $3, $4, 'active', $5, $6, 'Sediu fictiv — set demonstrativ', CURRENT_DATE - 180, TRUE)
        ON CONFLICT DO NOTHING
      `, [organization.id, organization.name, organization.level, organization.county, organization.parent, `${organization.id}@${domain}`]);
      await client.query(`
        INSERT INTO organization_territories (organization_id, territory_type, county_id, locality)
        VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING
      `, [organization.id, organization.level === "local" ? "locality" : organization.level, countyId.get(organization.county) ?? null, organization.locality]);
    }

    const memberIds: string[] = [];
    for (let index = 0; index < 60; index++) {
      const number = String(index + 1).padStart(3, "0");
      const fullName = `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / firstNames.length)]} (Demo)`;
      const email = `membru.${number}@${domain}`;
      const organization = organizations[index < 7 ? index : 1 + ((index - 7) % 6)];
      await client.query(`
        INSERT INTO users (full_name, email, password_hash, role, is_demo, created_at)
        VALUES ($1, $2, $3, $4, TRUE, NOW() - INTERVAL '90 days') ON CONFLICT DO NOTHING
      `, [fullName, email, passwordHash, index < 7 ? "SECRETAR" : "MEMBRU"]);
      const user = await client.query<{ id: string }>("SELECT id::text FROM users WHERE email = $1 AND is_demo = TRUE", [email]);
      const userId = user.rows[0]?.id;
      if (!userId) { throw new Error("Contul demonstrativ nu poate fi identificat."); }
      memberIds.push(userId);
      await client.query(`
        INSERT INTO membership_records (user_id, full_name, email, status, organization_id, member_number,
          application_at, validated_at, approved_at, approval_organization_id, approval_body, joined_at, status_reason, is_demo)
        VALUES ($1, $2, $3, 'active', $4, $5, NOW() - INTERVAL '90 days', NOW() - INTERVAL '80 days',
          NOW() - INTERVAL '75 days', $4, 'Exemplu demonstrativ — fără decizie reală', NOW() - INTERVAL '60 days', 'Persoană fictivă (Demo)', TRUE)
        ON CONFLICT DO NOTHING
      `, [userId, fullName, email, organization.id, `DEMO-${number}`]);
      await client.query(`
        INSERT INTO membership_events (membership_id, action, next_status, next_organization_id, reason, is_demo)
        SELECT id, 'import', status, organization_id, 'Încărcare set demonstrativ administrativ v1', TRUE
        FROM membership_records membership WHERE email = $1
          AND NOT EXISTS (SELECT 1 FROM membership_events event WHERE event.membership_id = membership.id)
      `, [email]);
      if (index < 7) {
        await client.query(`
          INSERT INTO organization_leadership_mandates (organization_id, user_id, full_name, position_title, started_at, ended_at, status, is_demo)
          SELECT $1::varchar, $2::bigint, $3::varchar, 'Organizator — secretar (Demo)', CURRENT_DATE - 30, CURRENT_DATE + 365, 'active', TRUE
          WHERE NOT EXISTS (SELECT 1 FROM organization_leadership_mandates WHERE organization_id = $1::varchar AND user_id = $2::bigint)
        `, [organization.id, userId, fullName]);
      }
    }

    for (let index = 0; index < 24; index++) {
      const region = regions[index % regions.length];
      const fullName = `${firstNames[index % firstNames.length]} ${lastNames[6 + Math.floor(index / firstNames.length)]} (Demo)`;
      const status = ["nou", "validat", "contactat", "activ"][index % 4];
      const skill = ["organizare", "comunicare", "logistică", "relații comunitare"][index % 4];
      await client.query(`
        INSERT INTO volunteers (full_name, email, county, county_id, locality, skills, motivation, workflow_status,
          internal_notes, owner_user_id, crm_priority, crm_tags, skill_tags, follow_up_at, is_demo)
        VALUES ($1, $2, $3, $4, $5, $6, 'Profil fictiv pentru explorarea CRM-ului', $7,
          'Date demonstrative. Persoană fictivă; fără date reale de contact.', $8, $9,
          '["admin-demo"]'::jsonb, $10::jsonb, CASE WHEN $7::varchar = 'activ' THEN NULL ELSE NOW() + INTERVAL '7 days' END, TRUE)
        ON CONFLICT DO NOTHING
      `, [fullName, `voluntar.${String(index + 1).padStart(3, "0")}@${domain}`, region.county, countyId.get(region.county), region.locality, skill, status, memberIds[1 + (index % regions.length)], index % 3 === 0 ? "ridicata" : "medie", JSON.stringify([skill])]);
    }
    await client.query(`
      UPDATE organizations organization SET members_count = (
        SELECT COUNT(*) FROM membership_records membership
        WHERE membership.organization_id = organization.id AND membership.status = 'active'
      ) WHERE organization.id LIKE 'admin-demo-%' AND organization.is_demo = TRUE
    `);
    const result = await client.query<{ members: number; volunteers: number; organizations: number; organizers: number }>(`
      SELECT
        (SELECT COUNT(*)::int FROM membership_records WHERE email LIKE $1 AND is_demo = TRUE) AS members,
        (SELECT COUNT(*)::int FROM volunteers WHERE email LIKE $1 AND is_demo = TRUE) AS volunteers,
        (SELECT COUNT(*)::int FROM organizations WHERE id LIKE 'admin-demo-%' AND is_demo = TRUE) AS organizations,
        (SELECT COUNT(*)::int FROM organization_leadership_mandates WHERE organization_id LIKE 'admin-demo-%' AND is_demo = TRUE) AS organizers
    `, [`%@${domain}`]);
    return result.rows[0];
  });
}
