import { query, withTransaction } from "../../lib/db.js";
import type { AdminTerritoryScope } from "../../lib/adminAuthorization.js";
import type {
  AddPoliticalParticipantInput,
  CreatePoliticalOperationInput,
  PoliticalOperationsQuery,
  UpdatePoliticalOperationInput,
  UpdatePoliticalParticipantInput,
} from "./politicalOperations.schema.js";

type ActionRow = {
  id: string;
  slug: string;
  action_type: "event" | "campaign" | "volunteer_task";
  title: string;
  summary: string;
  description: string;
  status: "draft" | "open" | "closed" | "archived";
  visibility: "public" | "members" | "internal";
  objective: string;
  target_metric: string;
  target_value: string | null;
  result_value: string | null;
  result_summary: string;
  organization_id: string | null;
  organization_name: string | null;
  coordinator_user_id: string | null;
  coordinator_name: string | null;
  starts_at: Date | null;
  ends_at: Date | null;
  participation_mode: string;
  commitment: string;
  capacity: number | null;
  version: number;
  created_at: Date;
  counties: Array<{ id: number; name: string }> | null;
};

type ParticipantRow = {
  id: string;
  action_id: string;
  user_id: string | null;
  membership_id: string | null;
  full_name: string;
  email: string;
  participation_role: string;
  status: string;
  attendance_status: string;
  due_at: Date | null;
  notes: string;
  report: string;
  result: string;
  hours: string;
  invited_at: Date | null;
  responded_at: Date | null;
  checked_in_at: Date | null;
  reported_at: Date | null;
  reviewed_at: Date | null;
  updated_at: Date;
};

type CandidateRow = {
  membership_id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  membership_status: string;
  role: string | null;
  county: string;
  locality: string;
};

type ParticipantSubjectRow = CandidateRow & {
  email_consent: boolean;
};

function accessibleCountyIds(scope: AdminTerritoryScope): number[] {
  return [...new Set([
    ...scope.countyIds,
    ...scope.localities.map((item) => item.countyId),
  ])];
}

function mapParticipant(row: ParticipantRow) {
  return {
    id: row.id.toString(),
    actionId: row.action_id.toString(),
    userId: row.user_id?.toString() ?? null,
    membershipId: row.membership_id?.toString() ?? null,
    fullName: row.full_name,
    email: row.email,
    role: row.participation_role,
    status: row.status,
    attendanceStatus: row.attendance_status,
    dueAt: row.due_at?.toISOString() ?? null,
    notes: row.notes,
    report: row.report,
    result: row.result,
    hours: Number(row.hours),
    invitedAt: row.invited_at?.toISOString() ?? null,
    respondedAt: row.responded_at?.toISOString() ?? null,
    checkedInAt: row.checked_in_at?.toISOString() ?? null,
    reportedAt: row.reported_at?.toISOString() ?? null,
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapAction(row: ActionRow, participants: ReturnType<typeof mapParticipant>[]) {
  return {
    id: row.id.toString(),
    slug: row.slug,
    type: row.action_type,
    title: row.title,
    summary: row.summary,
    description: row.description,
    status: row.status,
    visibility: row.visibility,
    objective: row.objective,
    targetMetric: row.target_metric,
    targetValue: row.target_value === null ? null : Number(row.target_value),
    resultValue: row.result_value === null ? null : Number(row.result_value),
    resultSummary: row.result_summary,
    organization: row.organization_id ? { id: row.organization_id, name: row.organization_name ?? row.organization_id } : null,
    coordinator: row.coordinator_user_id ? { id: row.coordinator_user_id, fullName: row.coordinator_name ?? "" } : null,
    counties: row.counties ?? [],
    startsAt: row.starts_at?.toISOString() ?? null,
    endsAt: row.ends_at?.toISOString() ?? null,
    participationMode: row.participation_mode,
    commitment: row.commitment,
    capacity: row.capacity,
    version: row.version,
    createdAt: row.created_at.toISOString(),
    participants,
    metrics: {
      invited: participants.filter((item) => item.status === "invited").length,
      confirmed: participants.filter((item) => ["confirmed", "active", "in_progress", "reported", "completed"].includes(item.status)).length,
      present: participants.filter((item) => item.attendanceStatus === "present").length,
      completed: participants.filter((item) => item.status === "completed").length,
      reportedHours: participants.reduce((sum, item) => sum + item.hours, 0),
    },
  };
}

const actionSelectSql = `
  SELECT
    action.id,
    action.slug,
    action.action_type,
    action.title,
    action.summary,
    action.description,
    action.status,
    action.visibility,
    action.objective,
    action.target_metric,
    action.target_value,
    action.result_value,
    action.result_summary,
    action.organization_id,
    organization.name AS organization_name,
    action.coordinator_user_id,
    coordinator.full_name AS coordinator_name,
    action.starts_at,
    action.ends_at,
    action.participation_mode,
    action.commitment,
    action.capacity,
    action.version,
    action.created_at,
    COALESCE(
      jsonb_agg(DISTINCT jsonb_build_object('id', county.id, 'name', county.name))
        FILTER (WHERE county.id IS NOT NULL),
      '[]'::jsonb
    ) AS counties
  FROM mobilization_actions action
  LEFT JOIN organizations organization ON organization.id = action.organization_id
  LEFT JOIN users coordinator ON coordinator.id = action.coordinator_user_id
  LEFT JOIN mobilization_action_counties action_county ON action_county.action_id = action.id
  LEFT JOIN counties county ON county.id = action_county.county_id
`;

function actionScopeSql(): string {
  return `(
    $1::boolean
    OR action.organization_id = ANY($2::varchar[])
    OR EXISTS (
      SELECT 1 FROM mobilization_action_counties scoped_county
      WHERE scoped_county.action_id = action.id
        AND scoped_county.county_id = ANY($3::integer[])
    )
  )`;
}

export async function listPoliticalOperationsFromRepository(
  filters: PoliticalOperationsQuery,
  scope: AdminTerritoryScope,
) {
  const countyIds = accessibleCountyIds(scope);
  const actionResult = await query<ActionRow>(`
    ${actionSelectSql}
    WHERE ${actionScopeSql()}
      AND ($4::varchar IS NULL OR action.action_type = $4)
      AND ($5::varchar IS NULL OR action.status = $5)
    GROUP BY action.id, organization.name, coordinator.full_name
    ORDER BY action.starts_at DESC NULLS LAST, action.created_at DESC
    LIMIT $6
  `, [scope.national, scope.organizationIds, countyIds, filters.type ?? null, filters.status ?? null, filters.limit]);

  const actionIds = actionResult.rows.map((row) => row.id);
  const participantResult = actionIds.length > 0
    ? await query<ParticipantRow>(`
      SELECT *
      FROM mobilization_participants
      WHERE action_id = ANY($1::bigint[])
      ORDER BY updated_at DESC, id DESC
    `, [actionIds])
    : { rows: [] as ParticipantRow[] };
  const participantsByAction = new Map<string, ReturnType<typeof mapParticipant>[]>();
  for (const row of participantResult.rows) {
    const item = mapParticipant(row);
    participantsByAction.set(row.action_id, [...(participantsByAction.get(row.action_id) ?? []), item]);
  }

  const [candidateResult, organizationResult, countyResult] = await Promise.all([
    query<CandidateRow>(`
      SELECT
        membership.id AS membership_id,
        membership.user_id,
        membership.full_name,
        membership.email,
        membership.status AS membership_status,
        app_user.role,
        COALESCE(volunteer.county, '') AS county,
        COALESCE(volunteer.locality, '') AS locality
      FROM membership_records membership
      LEFT JOIN users app_user ON app_user.id = membership.user_id
      LEFT JOIN volunteers volunteer ON volunteer.id = membership.volunteer_id
      WHERE membership.status NOT IN ('terminated', 'suspended')
        AND (
          $1::boolean
          OR membership.organization_id = ANY($2::varchar[])
          OR (membership.organization_id IS NULL AND volunteer.county_id = ANY($3::integer[]))
        )
      ORDER BY membership.full_name ASC
      LIMIT 500
    `, [scope.national, scope.organizationIds, countyIds]),
    query<{ id: string; code: string; name: string }>(`
      SELECT id, code, name
      FROM organizations
      WHERE status IN ('forming', 'active')
        AND ($1::boolean OR id = ANY($2::varchar[]))
      ORDER BY level ASC, name ASC
    `, [scope.national, scope.organizationIds]),
    query<{ id: number; name: string }>(`
      SELECT id, name
      FROM counties
      WHERE $1::boolean OR id = ANY($2::integer[])
      ORDER BY name ASC
    `, [scope.national, countyIds]),
  ]);

  const actions = actionResult.rows.map((row) => mapAction(row, participantsByAction.get(row.id) ?? []));
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      events: actions.filter((item) => item.type === "event").length,
      campaigns: actions.filter((item) => item.type === "campaign").length,
      tasks: actions.filter((item) => item.type === "volunteer_task").length,
      open: actions.filter((item) => item.status === "open").length,
      participants: actions.reduce((sum, item) => sum + item.participants.length, 0),
      reportedHours: actions.reduce((sum, item) => sum + item.metrics.reportedHours, 0),
    },
    actions,
    candidates: candidateResult.rows.map((row) => ({
      membershipId: row.membership_id.toString(),
      userId: row.user_id?.toString() ?? null,
      fullName: row.full_name,
      email: row.email,
      membershipStatus: row.membership_status,
      role: row.role,
      county: row.county,
      locality: row.locality,
    })),
    organizations: organizationResult.rows,
    counties: countyResult.rows,
  };
}

export async function createPoliticalOperationFromRepository(input: {
  payload: CreatePoliticalOperationInput;
  slug: string;
  actorId: bigint;
}) {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: string }>(`
      INSERT INTO mobilization_actions (
        slug, action_type, title, summary, description, status, scope, starts_at, ends_at,
        participation_mode, commitment, capacity, organization_id, coordinator_user_id,
        objective, target_metric, target_value, visibility, created_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        CASE WHEN cardinality($7::integer[]) = 0 AND $13::varchar IS NULL THEN 'national' ELSE 'local' END,
        $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      RETURNING id
    `, [
      input.slug,
      input.payload.type,
      input.payload.title,
      input.payload.summary,
      input.payload.description,
      input.payload.status,
      input.payload.countyIds,
      input.payload.startsAt,
      input.payload.endsAt,
      input.payload.participationMode,
      input.payload.commitment,
      input.payload.capacity,
      input.payload.organizationId,
      input.payload.coordinatorUserId,
      input.payload.objective,
      input.payload.targetMetric,
      input.payload.targetValue,
      input.payload.visibility,
      input.actorId.toString(),
    ]);
    const action = result.rows[0];
    if (!action) {return null;}
    for (const countyId of input.payload.countyIds) {
      await client.query(
        "INSERT INTO mobilization_action_counties (action_id, county_id) VALUES ($1, $2)",
        [action.id, countyId],
      );
    }
    return { id: action.id.toString(), slug: input.slug };
  });
}

export async function readPoliticalOperationInScope(id: bigint, scope: AdminTerritoryScope) {
  const result = await query<{ id: string; action_type: string; title: string; starts_at: Date | null; version: number }>(`
    SELECT action.id, action.action_type, action.title, action.starts_at, action.version
    FROM mobilization_actions action
    WHERE action.id = $4
      AND ${actionScopeSql()}
    LIMIT 1
  `, [scope.national, scope.organizationIds, accessibleCountyIds(scope), id.toString()]);
  return result.rows[0] ?? null;
}

export async function updatePoliticalOperationFromRepository(input: {
  id: bigint;
  payload: UpdatePoliticalOperationInput;
}) {
  const result = await query<{ id: string; version: number }>(`
    UPDATE mobilization_actions
    SET
      status = COALESCE($2, status),
      result_value = CASE WHEN $3::boolean THEN $4 ELSE result_value END,
      result_summary = COALESCE($5, result_summary),
      version = version + 1,
      updated_at = NOW()
    WHERE id = $1 AND version = $6
    RETURNING id, version
  `, [
    input.id.toString(),
    input.payload.status ?? null,
    input.payload.resultValue !== undefined,
    input.payload.resultValue ?? null,
    input.payload.resultSummary ?? null,
    input.payload.expectedVersion,
  ]);
  return result.rows[0] ?? null;
}

export async function readParticipantSubjectInScope(email: string, scope: AdminTerritoryScope): Promise<ParticipantSubjectRow | null> {
  const result = await query<ParticipantSubjectRow>(`
    SELECT
      membership.id AS membership_id,
      membership.user_id,
      membership.full_name,
      membership.email,
      membership.status AS membership_status,
      app_user.role,
      COALESCE(volunteer.county, '') AS county,
      COALESCE(volunteer.locality, '') AS locality,
      COALESCE(consent.email_consent, FALSE) AND consent.withdrawn_at IS NULL AS email_consent
    FROM membership_records membership
    LEFT JOIN users app_user ON app_user.id = membership.user_id
    LEFT JOIN volunteers volunteer ON volunteer.id = membership.volunteer_id
    LEFT JOIN communication_consents consent ON LOWER(consent.email) = LOWER(membership.email)
    WHERE LOWER(membership.email) = LOWER($4)
      AND membership.status NOT IN ('terminated')
      AND (
        $1::boolean
        OR membership.organization_id = ANY($2::varchar[])
        OR (membership.organization_id IS NULL AND volunteer.county_id = ANY($3::integer[]))
      )
    LIMIT 1
  `, [scope.national, scope.organizationIds, accessibleCountyIds(scope), email]);
  return result.rows[0] ?? null;
}

export async function readCoordinatorInScope(userId: bigint, scope: AdminTerritoryScope): Promise<{ id: string; fullName: string } | null> {
  const result = await query<{ id: string; full_name: string }>(`
    SELECT app_user.id, app_user.full_name
    FROM users app_user
    LEFT JOIN membership_records membership ON membership.user_id = app_user.id
    LEFT JOIN volunteers volunteer ON volunteer.id = membership.volunteer_id
    WHERE app_user.id = $4
      AND app_user.role IN ('CONSILIER', 'SECRETAR', 'VICEPRESEDINTE', 'PRESEDINTE')
      AND (
        $1::boolean
        OR membership.organization_id = ANY($2::varchar[])
        OR (membership.organization_id IS NULL AND volunteer.county_id = ANY($3::integer[]))
        OR EXISTS (
          SELECT 1 FROM organization_leadership_mandates mandate
          WHERE mandate.user_id = app_user.id
            AND mandate.organization_id = ANY($2::varchar[])
            AND mandate.status = 'active'
        )
      )
    LIMIT 1
  `, [scope.national, scope.organizationIds, accessibleCountyIds(scope), userId.toString()]);
  const row = result.rows[0];
  return row ? { id: row.id.toString(), fullName: row.full_name } : null;
}

export async function readExistingPoliticalOperationCountyIds(countyIds: number[]): Promise<number[]> {
  if (countyIds.length === 0) {return [];}
  const result = await query<{ id: number }>(`
    SELECT id FROM counties WHERE id = ANY($1::integer[])
  `, [countyIds]);
  return result.rows.map((row) => row.id);
}

function participantRoleForAction(actionType: string): string {
  if (actionType === "event") {return "invitee";}
  if (actionType === "campaign") {return "volunteer";}
  return "assignee";
}

export async function addPoliticalParticipantFromRepository(input: {
  actionId: bigint;
  actionType: string;
  payload: AddPoliticalParticipantInput;
  subject: ParticipantSubjectRow;
  actorId: bigint;
}) {
  const participationRole = participantRoleForAction(input.actionType);
  const status = input.actionType === "volunteer_task" ? "active" : "invited";
  const attendanceStatus = input.actionType === "event" ? "pending" : "not_applicable";
  const result = await query<ParticipantRow>(`
    INSERT INTO mobilization_participants (
      action_id, user_id, membership_id, full_name, email, participation_role, status,
      attendance_status, due_at, notes, invited_at, assigned_by
    )
    VALUES ($1, $2, $3, $4, LOWER($5), $6, $7, $8, $9, $10, NOW(), $11)
    ON CONFLICT (action_id, LOWER(email)) DO UPDATE
    SET
      user_id = EXCLUDED.user_id,
      membership_id = EXCLUDED.membership_id,
      full_name = EXCLUDED.full_name,
      participation_role = EXCLUDED.participation_role,
      status = EXCLUDED.status,
      attendance_status = EXCLUDED.attendance_status,
      due_at = EXCLUDED.due_at,
      notes = EXCLUDED.notes,
      invited_at = NOW(),
      assigned_by = EXCLUDED.assigned_by,
      updated_at = NOW()
    RETURNING *
  `, [
    input.actionId.toString(),
    input.subject.user_id,
    input.subject.membership_id,
    input.subject.full_name,
    input.subject.email,
    participationRole,
    status,
    attendanceStatus,
    input.payload.dueAt,
    input.payload.notes,
    input.actorId.toString(),
  ]);
  const row = result.rows[0];
  return row ? mapParticipant(row) : null;
}

export async function readPoliticalParticipantInScope(id: bigint, scope: AdminTerritoryScope) {
  const result = await query<ParticipantRow & { action_type: string; action_title: string }>(`
    SELECT participant.*, action.action_type, action.title AS action_title
    FROM mobilization_participants participant
    JOIN mobilization_actions action ON action.id = participant.action_id
    WHERE participant.id = $4 AND ${actionScopeSql()}
    LIMIT 1
  `, [scope.national, scope.organizationIds, accessibleCountyIds(scope), id.toString()]);
  return result.rows[0] ?? null;
}

export async function updatePoliticalParticipantFromRepository(input: {
  id: bigint;
  payload: UpdatePoliticalParticipantInput;
}) {
  const status = input.payload.status ?? null;
  const attendanceStatus = input.payload.attendanceStatus ?? null;
  const result = await query<ParticipantRow>(`
    UPDATE mobilization_participants
    SET
      status = COALESCE($2, status),
      attendance_status = COALESCE($3, attendance_status),
      report = COALESCE($4, report),
      result = COALESCE($5, result),
      hours = COALESCE($6, hours),
      responded_at = CASE WHEN $2 IN ('confirmed', 'declined') THEN NOW() ELSE responded_at END,
      checked_in_at = CASE WHEN $3 = 'present' THEN NOW() ELSE checked_in_at END,
      reported_at = CASE WHEN $2 = 'reported' OR $4 IS NOT NULL THEN NOW() ELSE reported_at END,
      reviewed_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE reviewed_at END,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [
    input.id.toString(),
    status,
    attendanceStatus,
    input.payload.report ?? null,
    input.payload.result ?? null,
    input.payload.hours ?? null,
  ]);
  const row = result.rows[0];
  return row ? mapParticipant(row) : null;
}
