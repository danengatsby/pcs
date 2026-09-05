import { query } from "../../lib/db.js";
import { withParticipantCapacity } from "../mobilization/mobilization.capacity.js";
import type { AuthenticatedUser } from "../../lib/authMiddleware.js";
import type {
  MemberConsentInput,
  MemberEventResponseInput,
  MemberTaskReportInput,
} from "./memberPortal.schema.js";

type MembershipRow = {
  id: string;
  status: string;
  member_number: string | null;
  application_at: Date;
  approved_at: Date | null;
  joined_at: Date | null;
  organization_id: string | null;
  organization_name: string | null;
  organization_code: string | null;
  official_email: string | null;
  phone: string | null;
  headquarters: string | null;
  county: string;
  locality: string;
  personal_phone: string;
};

type PortalActionRow = {
  participant_id: string;
  action_id: string;
  action_type: string;
  title: string;
  summary: string;
  description: string;
  objective: string;
  starts_at: Date | null;
  ends_at: Date | null;
  due_at: Date | null;
  participation_mode: string;
  commitment: string;
  participant_status: string;
  attendance_status: string;
  report: string;
  result: string;
  hours: string;
  organization_name: string | null;
  coordinator_name: string | null;
};

function mapAction(row: PortalActionRow) {
  return {
    participantId: row.participant_id.toString(),
    actionId: row.action_id.toString(),
    type: row.action_type,
    title: row.title,
    summary: row.summary,
    description: row.description,
    objective: row.objective,
    startsAt: row.starts_at?.toISOString() ?? null,
    endsAt: row.ends_at?.toISOString() ?? null,
    dueAt: row.due_at?.toISOString() ?? null,
    participationMode: row.participation_mode,
    commitment: row.commitment,
    status: row.participant_status,
    attendanceStatus: row.attendance_status,
    report: row.report,
    result: row.result,
    hours: Number(row.hours),
    organizationName: row.organization_name,
    coordinatorName: row.coordinator_name,
  };
}

export async function readMemberPortalFromRepository(actor: AuthenticatedUser) {
  const membershipResult = await query<MembershipRow>(`
    SELECT
      membership.id,
      membership.status,
      membership.member_number,
      membership.application_at,
      membership.approved_at,
      membership.joined_at,
      membership.organization_id,
      organization.name AS organization_name,
      organization.code AS organization_code,
      organization.official_email,
      organization.phone,
      organization.headquarters,
      COALESCE(volunteer.county, '') AS county,
      COALESCE(volunteer.locality, '') AS locality,
      COALESCE(volunteer.phone, '') AS personal_phone
    FROM membership_records membership
    LEFT JOIN organizations organization ON organization.id = membership.organization_id
    LEFT JOIN volunteers volunteer ON volunteer.id = membership.volunteer_id
    WHERE membership.user_id = $1 OR LOWER(membership.email) = LOWER($2)
    ORDER BY CASE WHEN membership.user_id = $1 THEN 0 ELSE 1 END
    LIMIT 1
  `, [actor.id, actor.email]);
  const membership = membershipResult.rows[0] ?? null;

  const [actionsResult, documentsResult, duesResult, leadersResult, consentResult, gatesResult] = await Promise.all([
    query<PortalActionRow>(`
      SELECT
        participant.id AS participant_id,
        action.id AS action_id,
        action.action_type,
        action.title,
        action.summary,
        action.description,
        action.objective,
        action.starts_at,
        action.ends_at,
        participant.due_at,
        action.participation_mode,
        action.commitment,
        participant.status AS participant_status,
        participant.attendance_status,
        participant.report,
        participant.result,
        participant.hours,
        organization.name AS organization_name,
        coordinator.full_name AS coordinator_name
      FROM mobilization_participants participant
      JOIN mobilization_actions action ON action.id = participant.action_id
      LEFT JOIN organizations organization ON organization.id = action.organization_id
      LEFT JOIN users coordinator ON coordinator.id = action.coordinator_user_id
      WHERE participant.user_id = $1
        OR participant.membership_id = $3
        OR LOWER(participant.email) = LOWER($2)
      ORDER BY COALESCE(participant.due_at, action.starts_at, action.created_at) ASC
    `, [actor.id, actor.email, membership?.id ?? null]),
    query<{ id: string; title: string; description: string; category: string; path: string; visibility: string }>(`
      SELECT id, title, description, category, path, visibility
      FROM member_documents
      WHERE status = 'published'
        AND ($1 <> '' OR $2 = ANY(ARRAY['CONSILIER','SECRETAR','VICEPRESEDINTE','PRESEDINTE']))
        AND (
          visibility = 'members'
          OR (visibility = 'active_members' AND $1 = 'active')
          OR (visibility = 'leadership' AND $2 = ANY(ARRAY['CONSILIER','SECRETAR','VICEPRESEDINTE','PRESEDINTE']))
        )
      ORDER BY sort_order ASC, title ASC
    `, [membership?.status ?? "", actor.role]),
    membership ? query<{ id: string; period_start: Date; period_end: Date; amount: string; currency: string; status: string; due_at: Date | null; paid_at: Date | null; reference: string }>(`
      SELECT * FROM membership_dues
      WHERE membership_id = $1
      ORDER BY period_start DESC
      LIMIT 24
    `, [membership.id]) : Promise.resolve({ rows: [] }),
    membership?.organization_id ? query<{ id: string; full_name: string; position_title: string }>(`
      SELECT mandate.id, mandate.full_name, mandate.position_title
      FROM organization_leadership_mandates mandate
      WHERE mandate.organization_id = $1 AND mandate.status = 'active'
        AND mandate.started_at <= CURRENT_DATE
        AND (mandate.ended_at IS NULL OR mandate.ended_at >= CURRENT_DATE)
      ORDER BY mandate.position_title, mandate.full_name
    `, [membership.organization_id]) : Promise.resolve({ rows: [] }),
    query<{ email_consent: boolean; sms_consent: boolean; whatsapp_consent: boolean; phone: string; interests: unknown; consent_version: string }>(`
      SELECT email_consent, sms_consent, whatsapp_consent, phone, interests, consent_version
      FROM communication_consents
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `, [actor.email]),
    query<{ module_key: string; legal_status: string; dpo_status: string; enabled: boolean }>(`
      SELECT module_key, legal_status, dpo_status, enabled
      FROM regulated_module_gates
      ORDER BY module_key
    `),
  ]);

  const actions = actionsResult.rows.map(mapAction);
  const dues = duesResult.rows.map((row) => ({
    id: row.id.toString(),
    periodStart: row.period_start.toISOString().slice(0, 10),
    periodEnd: row.period_end.toISOString().slice(0, 10),
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    dueAt: row.due_at?.toISOString().slice(0, 10) ?? null,
    paidAt: row.paid_at?.toISOString() ?? null,
    reference: row.reference,
  }));
  const consent = consentResult.rows[0];

  return {
    generatedAt: new Date().toISOString(),
    membership: membership ? {
      id: membership.id.toString(),
      status: membership.status,
      memberNumber: membership.member_number,
      applicationAt: membership.application_at.toISOString(),
      approvedAt: membership.approved_at?.toISOString() ?? null,
      joinedAt: membership.joined_at?.toISOString() ?? null,
      county: membership.county,
      locality: membership.locality,
    } : null,
    organization: membership?.organization_id ? {
      id: membership.organization_id,
      name: membership.organization_name ?? membership.organization_id,
      code: membership.organization_code ?? "",
      officialEmail: membership.official_email ?? "",
      phone: membership.phone ?? "",
      headquarters: membership.headquarters ?? "",
      leaders: leadersResult.rows.map((row) => ({ id: row.id.toString(), fullName: row.full_name, position: row.position_title })),
    } : null,
    events: actions.filter((item) => item.type === "event"),
    campaigns: actions.filter((item) => item.type === "campaign"),
    tasks: actions.filter((item) => item.type === "volunteer_task"),
    documents: documentsResult.rows.map((row) => ({ ...row, id: row.id.toString() })),
    dues: {
      rows: dues,
      dueAmount: dues.filter((row) => ["due", "overdue"].includes(row.status)).reduce((sum, row) => sum + row.amount, 0),
      currency: dues[0]?.currency ?? "RON",
    },
    communication: consent ? {
      emailConsent: consent.email_consent,
      smsConsent: consent.sms_consent,
      whatsappConsent: consent.whatsapp_consent,
      phone: consent.phone,
      interests: Array.isArray(consent.interests) ? consent.interests : [],
      consentVersion: consent.consent_version,
    } : {
      emailConsent: false,
      smsConsent: false,
      whatsappConsent: false,
      phone: membership?.personal_phone ?? "",
      interests: [],
      consentVersion: "portal-membru-v1",
    },
    regulatedModules: gatesResult.rows.map((row) => ({
      key: row.module_key,
      legalStatus: row.legal_status,
      dpoStatus: row.dpo_status,
      enabled: row.enabled,
    })),
  };
}

export async function updateOwnEventResponseFromRepository(input: {
  actor: AuthenticatedUser;
  actionId: bigint;
  payload: MemberEventResponseInput;
}) {
  const subject = await query<{ id: string }>(`
    SELECT id FROM mobilization_participants
    WHERE action_id = $1 AND (user_id = $2 OR LOWER(email) = LOWER($3))
  `, [input.actionId.toString(), input.actor.id, input.actor.email]);
  if (!subject.rows[0]) {return null;}
  const result = await withParticipantCapacity(
    { participantId: subject.rows[0].id }, input.payload.response,
    (client) => client.query<{ id: string; status: string; responded_at: Date }>(`
    UPDATE mobilization_participants participant
    SET status = $3, responded_at = NOW(), updated_at = NOW()
    FROM mobilization_actions action
    WHERE participant.action_id = action.id
      AND action.id = $1
      AND action.action_type = 'event'
      AND (participant.user_id = $2 OR LOWER(participant.email) = LOWER($4))
    RETURNING participant.id, participant.status, participant.responded_at
  `, [input.actionId.toString(), input.actor.id, input.payload.response, input.actor.email]));
  const row = result?.rows[0];
  return row ? { id: row.id.toString(), status: row.status, respondedAt: row.responded_at.toISOString() } : null;
}

export async function updateOwnTaskReportFromRepository(input: {
  actor: AuthenticatedUser;
  participantId: bigint;
  payload: MemberTaskReportInput;
}) {
  const subject = await query<{ id: string }>(`
    SELECT id FROM mobilization_participants
    WHERE id = $1 AND (user_id = $2 OR LOWER(email) = LOWER($3))
  `, [input.participantId.toString(), input.actor.id, input.actor.email]);
  if (!subject.rows[0]) {return null;}
  const result = await withParticipantCapacity(
    { participantId: input.participantId.toString() }, input.payload.status,
    (client) => client.query<{ id: string; status: string; reported_at: Date | null }>(`
    UPDATE mobilization_participants participant
    SET status = $3::varchar, report = $4, result = $5, hours = $6,
      reported_at = CASE WHEN $3::varchar = 'reported' THEN NOW() ELSE reported_at END,
      updated_at = NOW()
    FROM mobilization_actions action
    WHERE participant.action_id = action.id
      AND participant.id = $1
      AND action.action_type IN ('volunteer_task', 'campaign')
      AND (participant.user_id = $2 OR LOWER(participant.email) = LOWER($7))
    RETURNING participant.id, participant.status, participant.reported_at
  `, [input.participantId.toString(), input.actor.id, input.payload.status, input.payload.report, input.payload.result, input.payload.hours, input.actor.email]));
  const row = result?.rows[0];
  return row ? { id: row.id.toString(), status: row.status, reportedAt: row.reported_at?.toISOString() ?? null } : null;
}

export async function updateOwnCommunicationConsentFromRepository(
  actor: AuthenticatedUser,
  payload: MemberConsentInput,
) {
  const enabled = payload.emailConsent || payload.smsConsent || payload.whatsappConsent;
  const result = await query<{ id: string }>(`
    INSERT INTO communication_consents (
      user_id, membership_id, full_name, email, phone, county_id, county, locality,
      interests, email_consent, sms_consent, whatsapp_consent, consent_version,
      source, evidence, granted_at, withdrawn_at
    )
    SELECT
      $1, membership.id, $2, LOWER($3), $4, volunteer.county_id,
      COALESCE(volunteer.county, ''), COALESCE(volunteer.locality, ''), $5::jsonb,
      $6, $7, $8, $9, 'member_portal',
      jsonb_build_object('actorUserId', $1, 'selfService', TRUE, 'recordedAt', NOW()),
      CASE WHEN $10 THEN NOW() ELSE NULL END,
      CASE WHEN $10 THEN NULL ELSE NOW() END
    FROM (SELECT 1) seed
    LEFT JOIN membership_records membership ON membership.user_id = $1 OR LOWER(membership.email) = LOWER($3)
    LEFT JOIN volunteers volunteer ON volunteer.id = membership.volunteer_id
    LIMIT 1
    ON CONFLICT (LOWER(email)) DO UPDATE
    SET user_id = EXCLUDED.user_id,
      membership_id = COALESCE(EXCLUDED.membership_id, communication_consents.membership_id),
      full_name = EXCLUDED.full_name,
      phone = CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE communication_consents.phone END,
      county_id = COALESCE(EXCLUDED.county_id, communication_consents.county_id),
      county = CASE WHEN EXCLUDED.county <> '' THEN EXCLUDED.county ELSE communication_consents.county END,
      locality = CASE WHEN EXCLUDED.locality <> '' THEN EXCLUDED.locality ELSE communication_consents.locality END,
      interests = EXCLUDED.interests,
      email_consent = EXCLUDED.email_consent,
      sms_consent = EXCLUDED.sms_consent,
      whatsapp_consent = EXCLUDED.whatsapp_consent,
      consent_version = EXCLUDED.consent_version,
      source = EXCLUDED.source,
      evidence = EXCLUDED.evidence,
      granted_at = EXCLUDED.granted_at,
      withdrawn_at = EXCLUDED.withdrawn_at,
      updated_at = NOW()
    RETURNING id
  `, [
    actor.id,
    actor.fullName,
    actor.email,
    payload.phone,
    JSON.stringify(payload.interests),
    payload.emailConsent,
    payload.smsConsent,
    payload.whatsappConsent,
    payload.consentVersion,
    enabled,
  ]);
  return result.rows[0] ? {
    updated: true,
    emailConsent: payload.emailConsent,
    smsConsent: payload.smsConsent,
    whatsappConsent: payload.whatsappConsent,
    interests: payload.interests,
  } : null;
}
