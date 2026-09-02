import { recordAdminAudit } from "../../lib/adminAudit.js";
import {
  assertOrganizationInScope,
  type AdminAccessContext,
} from "../../lib/adminAuthorization.js";
import { AppError } from "../../lib/errors.js";
import { enqueueNotificationEmails } from "../../lib/notificationOutbox.js";
import {
  createCommunicationDispatchFromRepository,
  listEligibleCommunicationRecipients,
  summarizeCommunicationAudience,
} from "./communications.repository.js";
import type {
  CommunicationAudienceInput,
  CreateCommunicationDispatchInput,
} from "./communications.schema.js";

function assertAudienceInScope(audience: CommunicationAudienceInput, access: AdminAccessContext): void {
  if (audience.organizationId) {
    assertOrganizationInScope(access.scope, audience.organizationId);
  }
  if (access.scope.national) {return;}
  const allowed = new Set([
    ...access.scope.countyIds,
    ...access.scope.localities.map((item) => item.countyId),
  ]);
  if (audience.countyIds.some((countyId) => !allowed.has(countyId))) {
    throw new AppError(403, "ADMIN_TERRITORY_FORBIDDEN", "Audiența include persoane din afara mandatului tău.");
  }
}

export async function previewCommunicationAudienceService(
  audience: CommunicationAudienceInput,
  access: AdminAccessContext,
) {
  assertAudienceInScope(audience, access);
  const recipients = await listEligibleCommunicationRecipients(audience, access.scope);
  return {
    ...summarizeCommunicationAudience(recipients),
    channel: audience.channel,
    consentRequired: true,
    generatedAt: new Date().toISOString(),
  };
}

export async function createCommunicationDispatchService(input: {
  payload: CreateCommunicationDispatchInput;
  access: AdminAccessContext;
}) {
  assertAudienceInScope(input.payload, input.access);
  if (input.payload.mode === "send" && !input.access.capabilities.includes("communication.dispatch")) {
    throw new AppError(403, "ADMIN_NATIONAL_SCOPE_REQUIRED", "Trimiterea efectivă necesită autorizare națională. Poți salva comunicarea ca draft.");
  }
  const recipients = await listEligibleCommunicationRecipients(input.payload, input.access.scope);
  if (recipients.length === 0) {
    throw new AppError(400, "COMMUNICATION_AUDIENCE_EMPTY", "Nicio persoană nu corespunde segmentului și consimțământului selectat.");
  }

  const status = input.payload.mode === "draft"
    ? "draft"
    : input.payload.channel === "email" ? "queued" : "ready_external";
  const materialized = await createCommunicationDispatchFromRepository({
    payload: input.payload,
    actorId: BigInt(input.access.actor.id),
    recipients,
    status,
  });
  if (!materialized) {
    throw new AppError(400, "COMMUNICATION_AUDIENCE_EMPTY", "Consimțământul audienței s-a schimbat. Recalculează segmentul.");
  }
  const materializedIds = new Set(materialized.validConsentIds);
  const materializedRecipients = recipients.filter((recipient) => materializedIds.has(recipient.consent_id.toString()));

  let queuedEmails = 0;
  if (input.payload.mode === "send" && input.payload.channel === "email") {
    queuedEmails = await enqueueNotificationEmails(materializedRecipients.map((recipient) => ({
      action: "communication.segmented_dispatch",
      payload: {
        to: [recipient.email],
        subject: input.payload.title,
        text: `${input.payload.message}\n\nAi primit acest mesaj în baza consimțământului acordat comunicărilor PCS. Preferințele pot fi schimbate din portalul de membru.`,
      },
    })));
  }

  await recordAdminAudit({
    actor: { userId: input.access.actor.id, email: input.access.actor.email, role: input.access.actor.role },
    action: input.payload.mode === "send" ? "communication.dispatch" : "communication.draft",
    targetType: "communication_dispatch",
    targetId: materialized.dispatch.id,
    details: {
      channel: input.payload.channel,
      recipientCount: materializedRecipients.length,
      organizationId: input.payload.organizationId,
      countyIds: input.payload.countyIds,
      roles: input.payload.roles,
      interests: input.payload.interests,
    },
  });

  return {
    ...materialized.dispatch,
    queuedEmails,
    delivery: input.payload.channel === "email"
      ? status
      : status === "ready_external" ? "ready_for_approved_provider" : status,
  };
}
