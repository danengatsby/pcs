import type { PoolClient } from "pg";
import { withTransaction } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";

const reservedStatuses = new Set(["confirmed", "active", "in_progress", "reported", "completed"]);

// Participants are authoritative. Legacy responses without a participant still
// reserve a seat; the mirrored response/participant pair is counted only once.
export function reservedEmailsSql(actionId: "$1" | "action.id"): string {
  return `
    SELECT LOWER(participant.email) AS email
    FROM mobilization_participants participant
    WHERE participant.action_id = ${actionId} AND participant.is_demo = FALSE
      AND participant.status IN ('confirmed', 'active', 'in_progress', 'reported', 'completed')
    UNION
    SELECT LOWER(response.email) AS email
    FROM mobilization_responses response
    WHERE response.action_id = ${actionId} AND response.is_demo = FALSE
      AND NOT EXISTS (
        SELECT 1 FROM mobilization_participants participant
        WHERE participant.action_id = response.action_id
          AND LOWER(participant.email) = LOWER(response.email)
      )
  `;
}

export function actionFullError(): AppError {
  return new AppError(409, "MOBILIZATION_ACTION_FULL", "Locuri epuizate. Poți alege înscrierea pe lista de așteptare.");
}

// The caller must hold the action row lock until its participant write commits.
export async function hasAvailableSeat(client: PoolClient, actionId: string, capacity: number | null, email: string): Promise<boolean> {
  if (capacity === null) {return true;}
  const result = await client.query<{ occupied: number; already_reserved: boolean }>(`
    SELECT COUNT(*)::INTEGER AS occupied,
      COALESCE(BOOL_OR(email = LOWER($2)), FALSE) AS already_reserved
    FROM (${reservedEmailsSql("$1")}) seats
  `, [actionId, email]);
  const seats = result.rows[0];
  return seats.already_reserved || seats.occupied < capacity;
}

// All admin/member participant writers take the same parent lock as public
// registrations, including cancellation and promotion from the waiting list.
export async function withParticipantCapacity<T>(
  target: { actionId: string; email: string } | { participantId: string },
  nextStatus: string | undefined,
  write: (client: PoolClient) => Promise<T>,
): Promise<T | null> {
  return withTransaction(async (client) => {
    const actionResult = await client.query<{ id: string; capacity: number | null }>(`
      SELECT id, capacity FROM mobilization_actions
      WHERE id = ${"actionId" in target ? "$1" : "(SELECT action_id FROM mobilization_participants WHERE id = $1)"}
      FOR UPDATE
    `, ["actionId" in target ? target.actionId : target.participantId]);
    const action = actionResult.rows[0];
    if (!action) {return null;}
    if (nextStatus && reservedStatuses.has(nextStatus)) {
      const email = "email" in target ? target.email : (await client.query<{ email: string }>(
        "SELECT email FROM mobilization_participants WHERE id = $1", [target.participantId],
      )).rows[0]?.email;
      if (!email) {return null;}
      if (!await hasAvailableSeat(client, action.id, action.capacity, email)) {throw actionFullError();}
    }
    return write(client);
  });
}
