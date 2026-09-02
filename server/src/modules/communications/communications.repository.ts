import { query, withTransaction } from "../../lib/db.js";
import type { AdminTerritoryScope } from "../../lib/adminAuthorization.js";
import type {
  CommunicationAudienceInput,
  CreateCommunicationDispatchInput,
} from "./communications.schema.js";

type EligibleRecipientRow = {
  consent_id: string;
  full_name: string;
  email: string;
  phone: string;
  county_id: number | null;
  county: string;
  role: string;
  destination: string;
};

function accessibleCountyIds(scope: AdminTerritoryScope): number[] {
  return [...new Set([...scope.countyIds, ...scope.localities.map((item) => item.countyId)])];
}

export async function listEligibleCommunicationRecipients(
  audience: CommunicationAudienceInput,
  scope: AdminTerritoryScope,
): Promise<EligibleRecipientRow[]> {
  const result = await query<EligibleRecipientRow>(`
    SELECT
      consent.id AS consent_id,
      consent.full_name,
      consent.email,
      consent.phone,
      COALESCE(consent.county_id, volunteer.county_id) AS county_id,
      COALESCE(NULLIF(consent.county, ''), volunteer.county, '') AS county,
      COALESCE(
        CASE
          WHEN app_user.role IN ('CONSILIER', 'SECRETAR', 'VICEPRESEDINTE', 'PRESEDINTE') THEN app_user.role
          WHEN membership.status = 'active' THEN 'MEMBRU'
          WHEN membership.status = 'approved' THEN 'ADERENT'
          ELSE COALESCE(app_user.role, 'SUSTINATOR')
        END,
        'SUSTINATOR'
      ) AS role,
      CASE WHEN $4 = 'email' THEN consent.email ELSE consent.phone END AS destination
    FROM communication_consents consent
    LEFT JOIN membership_records membership ON membership.id = consent.membership_id
      OR (consent.membership_id IS NULL AND LOWER(membership.email) = LOWER(consent.email))
    LEFT JOIN users app_user ON app_user.id = COALESCE(consent.user_id, membership.user_id)
    LEFT JOIN volunteers volunteer ON volunteer.id = membership.volunteer_id
    WHERE consent.withdrawn_at IS NULL
      AND CASE $4
        WHEN 'email' THEN consent.email_consent
        WHEN 'sms' THEN consent.sms_consent
        WHEN 'whatsapp' THEN consent.whatsapp_consent
        ELSE FALSE
      END
      AND CASE WHEN $4 = 'email' THEN consent.email <> '' ELSE consent.phone <> '' END
      AND (
        $1::boolean
        OR membership.organization_id = ANY($2::varchar[])
        OR COALESCE(consent.county_id, volunteer.county_id) = ANY($3::integer[])
      )
      AND ($5::varchar IS NULL OR membership.organization_id = $5)
      AND (cardinality($6::integer[]) = 0 OR COALESCE(consent.county_id, volunteer.county_id) = ANY($6::integer[]))
      AND (
        cardinality($7::varchar[]) = 0
        OR COALESCE(
          CASE
            WHEN app_user.role IN ('CONSILIER', 'SECRETAR', 'VICEPRESEDINTE', 'PRESEDINTE') THEN app_user.role
            WHEN membership.status = 'active' THEN 'MEMBRU'
            WHEN membership.status = 'approved' THEN 'ADERENT'
            ELSE COALESCE(app_user.role, 'SUSTINATOR')
          END,
          'SUSTINATOR'
        ) = ANY($7::varchar[])
      )
      AND (cardinality($8::varchar[]) = 0 OR consent.interests ?| $8::varchar[])
    ORDER BY consent.id ASC
  `, [
    scope.national,
    scope.organizationIds,
    accessibleCountyIds(scope),
    audience.channel,
    audience.organizationId,
    audience.countyIds,
    audience.roles,
    audience.interests,
  ]);
  return result.rows;
}

export function summarizeCommunicationAudience(rows: EligibleRecipientRow[]) {
  const byCounty: Record<string, number> = {};
  const byRole: Record<string, number> = {};
  for (const row of rows) {
    const county = row.county || "Nespecificat";
    byCounty[county] = (byCounty[county] ?? 0) + 1;
    byRole[row.role] = (byRole[row.role] ?? 0) + 1;
  }
  return { eligible: rows.length, byCounty, byRole };
}

export async function createCommunicationDispatchFromRepository(input: {
  payload: CreateCommunicationDispatchInput;
  actorId: bigint;
  recipients: EligibleRecipientRow[];
  status: "draft" | "queued" | "ready_external";
}) {
  return withTransaction(async (client) => {
    const consentResult = await client.query<{ id: string }>(`
      SELECT id
      FROM communication_consents
      WHERE id = ANY($1::bigint[])
        AND withdrawn_at IS NULL
        AND CASE $2::varchar
          WHEN 'email' THEN email_consent
          WHEN 'sms' THEN sms_consent
          WHEN 'whatsapp' THEN whatsapp_consent
          ELSE FALSE
        END
      FOR SHARE
    `, [input.recipients.map((recipient) => recipient.consent_id), input.payload.channel]);
    const validConsentIds = new Set(consentResult.rows.map((row) => row.id.toString()));
    const recipients = input.recipients.filter((recipient) => validConsentIds.has(recipient.consent_id.toString()));
    if (recipients.length === 0) {return null;}

    const result = await client.query<{ id: string; created_at: Date }>(`
      INSERT INTO communication_dispatches (
        organization_id, title, message, channel, status, county_ids, roles, interests,
        recipient_count, created_by, approved_by, scheduled_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10, $11, $12)
      RETURNING id, created_at
    `, [
      input.payload.organizationId,
      input.payload.title,
      input.payload.message,
      input.payload.channel,
      input.status,
      JSON.stringify(input.payload.countyIds),
      JSON.stringify(input.payload.roles),
      JSON.stringify(input.payload.interests),
      recipients.length,
      input.actorId.toString(),
      input.payload.mode === "send" ? input.actorId.toString() : null,
      input.payload.mode === "send" ? new Date() : null,
    ]);
    const dispatch = result.rows[0];
    if (!dispatch) {return null;}

    for (const recipient of recipients) {
      await client.query(`
        INSERT INTO communication_dispatch_recipients (
          dispatch_id, consent_id, destination, status
        ) VALUES ($1, $2, $3, $4)
      `, [
        dispatch.id,
        recipient.consent_id,
        recipient.destination,
        input.payload.mode === "send" ? "queued" : "eligible",
      ]);
    }

    return {
      dispatch: {
        id: dispatch.id.toString(),
        status: input.status,
        recipientCount: recipients.length,
        createdAt: dispatch.created_at.toISOString(),
      },
      validConsentIds: [...validConsentIds],
    };
  });
}

export type CommunicationRecipient = EligibleRecipientRow;
