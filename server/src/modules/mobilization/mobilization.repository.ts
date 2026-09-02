import { query, withTransaction } from "../../lib/db.js";
import type { MobilizationResponseInput } from "./mobilization.schema.js";
import type { MobilizationAction, MobilizationActionType } from "./mobilization.types.js";

type MobilizationActionRow = {
  id: string;
  slug: string;
  action_type: MobilizationActionType;
  title: string;
  summary: string;
  description: string;
  scope: MobilizationAction["scope"];
  county: string;
  locality: string;
  starts_at: Date | string | null;
  ends_at: Date | string | null;
  participation_mode: string;
  commitment: string;
  capacity: number | null;
  response_count: number | string;
};

function toIsoString(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapAction(row: MobilizationActionRow): MobilizationAction {
  return {
    id: row.id.toString(),
    slug: row.slug,
    type: row.action_type,
    title: row.title,
    summary: row.summary,
    description: row.description,
    scope: row.scope,
    county: row.county,
    locality: row.locality,
    startsAt: toIsoString(row.starts_at),
    endsAt: toIsoString(row.ends_at),
    participationMode: row.participation_mode,
    commitment: row.commitment,
    capacity: row.capacity,
    responseCount: Number(row.response_count),
  };
}

export async function listPublicMobilizationActions(): Promise<MobilizationAction[]> {
  const result = await query<MobilizationActionRow>(`
    SELECT
      action.id,
      action.slug,
      action.action_type,
      action.title,
      action.summary,
      action.description,
      action.scope,
      COALESCE(NULLIF(action.county, ''), STRING_AGG(DISTINCT county.name, ', '), '') AS county,
      action.locality,
      action.starts_at,
      action.ends_at,
      action.participation_mode,
      action.commitment,
      action.capacity,
      COUNT(DISTINCT response.id)::INTEGER AS response_count
    FROM mobilization_actions AS action
    LEFT JOIN mobilization_responses AS response ON response.action_id = action.id
    LEFT JOIN mobilization_action_counties AS action_county ON action_county.action_id = action.id
    LEFT JOIN counties AS county ON county.id = action_county.county_id
    WHERE action.status = 'open'
      AND action.visibility = 'public'
      AND (action.ends_at IS NULL OR action.ends_at >= NOW())
    GROUP BY action.id
    ORDER BY action.sort_order ASC, action.starts_at ASC NULLS LAST, action.id ASC
  `);

  return result.rows.map(mapAction);
}

export async function createMobilizationResponse(
  slug: string,
  input: MobilizationResponseInput,
): Promise<{
  id: string;
  actionTitle: string;
  actionType: MobilizationActionType;
  participationMode: string;
  commitment: string;
} | null> {
  return withTransaction(async (client) => {
    const actionResult = await client.query<{
      id: string;
      title: string;
      action_type: MobilizationActionType;
      participation_mode: string;
      commitment: string;
    }>(`
      SELECT id, title, action_type, participation_mode, commitment
      FROM mobilization_actions
      WHERE slug = $1
        AND status = 'open'
        AND visibility = 'public'
        AND (ends_at IS NULL OR ends_at >= NOW())
      LIMIT 1
      FOR UPDATE
    `, [slug]);

    const action = actionResult.rows[0];
    if (!action) {
      return null;
    }

    const emailConsent = input.emailConsent || input.updatesConsent;
    const result = await client.query<{ id: string }>(`
      INSERT INTO mobilization_responses (
        action_id,
        full_name,
        email,
        phone,
        county,
        locality,
        interests,
        availability,
        message,
        updates_consent,
        email_consent,
        sms_consent,
        whatsapp_consent,
        consent_version,
        privacy_consent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id
    `, [
      action.id,
      input.fullName,
      input.email,
      input.phone,
      input.county,
      input.locality,
      JSON.stringify(input.interests),
      input.availability,
      input.message,
      emailConsent,
      emailConsent,
      input.smsConsent,
      input.whatsappConsent,
      input.consentVersion,
      input.privacyConsent,
    ]);

    const created = result.rows[0];
    if (!created) {
      return null;
    }

    await client.query(`
      INSERT INTO communication_consents (
        user_id,
        membership_id,
        full_name,
        email,
        phone,
        county_id,
        county,
        locality,
        interests,
        email_consent,
        sms_consent,
        whatsapp_consent,
        consent_version,
        source,
        evidence,
        granted_at
      )
      SELECT
        membership.user_id,
        membership.id,
        $1,
        LOWER($2),
        $3,
        county.id,
        $4,
        $5,
        $6::jsonb,
        $7,
        $8,
        $9,
        $10,
        'mobilization_response',
        jsonb_build_object('responseId', $11::bigint, 'privacyConsent', TRUE),
        CASE WHEN $7 OR $8 OR $9 THEN NOW() ELSE NULL END
      FROM (SELECT 1) seed
      LEFT JOIN membership_records membership ON LOWER(membership.email) = LOWER($2)
      LEFT JOIN counties county ON county.name = $4
      ON CONFLICT (LOWER(email)) DO UPDATE
      SET
        user_id = COALESCE(communication_consents.user_id, EXCLUDED.user_id),
        membership_id = COALESCE(communication_consents.membership_id, EXCLUDED.membership_id),
        full_name = EXCLUDED.full_name,
        phone = CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE communication_consents.phone END,
        county_id = EXCLUDED.county_id,
        county = EXCLUDED.county,
        locality = EXCLUDED.locality,
        interests = (
          SELECT COALESCE(jsonb_agg(DISTINCT interest), '[]'::jsonb)
          FROM jsonb_array_elements(communication_consents.interests || EXCLUDED.interests) interest
        ),
        email_consent = communication_consents.email_consent OR EXCLUDED.email_consent,
        sms_consent = communication_consents.sms_consent OR EXCLUDED.sms_consent,
        whatsapp_consent = communication_consents.whatsapp_consent OR EXCLUDED.whatsapp_consent,
        consent_version = EXCLUDED.consent_version,
        source = EXCLUDED.source,
        evidence = communication_consents.evidence || EXCLUDED.evidence,
        granted_at = CASE
          WHEN EXCLUDED.email_consent OR EXCLUDED.sms_consent OR EXCLUDED.whatsapp_consent
            THEN COALESCE(communication_consents.granted_at, NOW())
          ELSE communication_consents.granted_at
        END,
        withdrawn_at = CASE
          WHEN EXCLUDED.email_consent OR EXCLUDED.sms_consent OR EXCLUDED.whatsapp_consent
            THEN NULL
          ELSE communication_consents.withdrawn_at
        END,
        updated_at = NOW()
    `, [
      input.fullName,
      input.email,
      input.phone,
      input.county,
      input.locality,
      JSON.stringify(input.interests),
      emailConsent,
      input.smsConsent,
      input.whatsappConsent,
      input.consentVersion,
      created.id,
    ]);

    await client.query(`
      INSERT INTO mobilization_participants (
        action_id,
        user_id,
        membership_id,
        full_name,
        email,
        participation_role,
        status,
        attendance_status,
        responded_at
      )
      SELECT
        $1,
        membership.user_id,
        membership.id,
        $2,
        LOWER($3),
        CASE $4
          WHEN 'event' THEN 'invitee'
          WHEN 'campaign' THEN 'volunteer'
          WHEN 'volunteer_task' THEN 'assignee'
          ELSE 'participant'
        END,
        CASE $4 WHEN 'campaign' THEN 'active' ELSE 'confirmed' END,
        CASE $4 WHEN 'event' THEN 'pending' ELSE 'not_applicable' END,
        NOW()
      FROM (SELECT 1) seed
      LEFT JOIN membership_records membership ON LOWER(membership.email) = LOWER($3)
      ON CONFLICT (action_id, LOWER(email)) DO UPDATE
      SET
        user_id = COALESCE(mobilization_participants.user_id, EXCLUDED.user_id),
        membership_id = COALESCE(mobilization_participants.membership_id, EXCLUDED.membership_id),
        full_name = EXCLUDED.full_name,
        status = EXCLUDED.status,
        attendance_status = EXCLUDED.attendance_status,
        responded_at = NOW(),
        updated_at = NOW()
    `, [action.id, input.fullName, input.email, action.action_type]);

    return {
      id: created.id.toString(),
      actionTitle: action.title,
      actionType: action.action_type,
      participationMode: action.participation_mode,
      commitment: action.commitment,
    };
  });
}
