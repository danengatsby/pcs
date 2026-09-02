import { env } from "./env.js";
import { appLogger } from "./logger.js";
import { incrementEmailFailure } from "./metrics.js";
import { enqueueNotificationEmail } from "./notificationOutbox.js";
import { triggerNotificationOutboxWorker } from "./notificationOutboxWorker.js";

type SignupNotificationInput = {
  fullName: string;
  email: string;
};

type VolunteerStatusNotificationInput = {
  fullName: string;
  email: string;
  previousStatus: string;
  nextStatus: string;
  updatedBy: string;
};

type VolunteerSignupNotificationInput = {
  fullName: string;
  email: string;
  county: string;
  locality: string;
  phone: string;
  skills: string;
  motivation: string;
};

type NewsPublishedNotificationInput = {
  id: number;
  title: string;
  summary: string;
  category: string;
  publishedAt: string;
};

type MobilizationResponseNotificationInput = {
  fullName: string;
  email: string;
  actionTitle: string;
  actionType: string;
  participationMode: string;
  commitment: string;
  county: string;
  interests: string[];
  updatesConsent: boolean;
};

type PoliticalOperationInvitationInput = {
  fullName: string;
  email: string;
  actionTitle: string;
  actionType: string;
  startsAt: string | null;
  dueAt: string | null;
};

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export function buildNewsLink(newsId: number): string {
  const baseUrl = normalizeBaseUrl(env.publicBaseUrl);
  if (!baseUrl) {
    return `ID stire: ${newsId}`;
  }
  return `${baseUrl}/news/${encodeURIComponent(String(newsId))}`;
}

async function queueNotification(
  action: string,
  payload: {
    to: string[];
    subject: string;
    text: string;
    replyTo?: string;
  }
): Promise<void> {
  try {
    await enqueueNotificationEmail({
      action,
      payload,
    });

    // Trigger an immediate outbox pass so user-facing confirmations are
    // attempted right after enqueue, while the periodic worker still handles retries.
    triggerNotificationOutboxWorker(`enqueue:${action}`);
  } catch (error) {
    incrementEmailFailure(action);
    appLogger.error(
      {
        action,
        err: error,
      },
      "Email notification failed"
    );
  }
}

export async function sendSignupNotificationEmail(input: SignupNotificationInput): Promise<void> {
  await queueNotification("auth.signup_email", {
    to: [input.email],
    subject: "Cont PCS creat cu succes",
    text: [
      `Salut, ${input.fullName}!`,
      "",
      "Contul tau pe platforma PCS a fost creat cu succes.",
      "Poti intra in platforma pentru a-ti completa profilul si a urmari noutatile.",
      "",
      "Multumim,",
      "Echipa PCS",
    ].join("\n"),
  });
}

export async function sendVolunteerStatusChangedEmail(
  input: VolunteerStatusNotificationInput
): Promise<void> {
  await queueNotification("volunteer.status_changed_email", {
    to: [input.email],
    subject: `Status voluntar actualizat: ${input.nextStatus}`,
    text: [
      `Salut, ${input.fullName}!`,
      "",
      "Statusul tau de voluntar in platforma PCS a fost actualizat.",
      `Status anterior: ${input.previousStatus}`,
      `Status nou: ${input.nextStatus}`,
      `Actualizat de: ${input.updatedBy}`,
      "",
      "Multumim pentru implicare,",
      "Echipa PCS",
    ].join("\n"),
  });
}

export async function sendVolunteerSignupNotificationEmail(
  input: VolunteerSignupNotificationInput
): Promise<void> {
  const messageText = buildVolunteerSignupNotificationText(input);

  await queueNotification("volunteer.signup_email", {
    to: [input.email],
    subject: "Confirmare primire cerere de aderare PCS-Partidul Conservator al Seniorilor",
    text: messageText,
  });
}

export function buildVolunteerSignupNotificationText(
  input: VolunteerSignupNotificationInput
): string {
  const phone = input.phone.trim() || "-";
  const skills = input.skills.trim() || "-";

  return [
    `Salut, ${input.fullName}!`,
    "",
    "Cererea dvs. de aderare la PCS-Partidul Conservator al Seniorilor a fost inregistrata cu succes.",
    "Cererea nu acorda automat calitatea de aderent sau membru. Pana la validarea administrativa, contul dvs. are rolul de sustinator.",
    "Veti primi actualizari pe email privind validarea si pasii urmatori.",
    "",
    "Va puteti loga cu adresa de email folosita la inscriere si parola setata in formular.",
    `Email: ${input.email}`,
    "",
    "Datele inscrierii:",
    `Nume complet: ${input.fullName}`,
    `Email: ${input.email}`,
    `Judet: ${input.county}`,
    `Localitate: ${input.locality}`,
    `Telefon: ${phone}`,
    `Arii de interes: ${skills}`,
    `Motivatie: ${input.motivation}`,
    "",
    "CALITATEA DE ADERENT SE ACORDA NUMAI DUPA VALIDAREA ADMINISTRATIVA A CERERII.",
    "INSCRIEREA CA MEMBRU DE PARTID URMEAZA PROCEDURA SEPARATA STABILITA DE PCS.",
    "",
    "Multumim pentru interes,",
    "Echipa PCS-Partidul Conservator al Seniorilor",
    "https://pcpens.online/index.html",
  ].join("\n");
}

export async function sendMobilizationResponseConfirmationEmail(
  input: MobilizationResponseNotificationInput
): Promise<void> {
  await queueNotification("mobilization.response_confirmation", {
    to: [input.email],
    subject: `Confirmare implicare PCS: ${input.actionTitle}`,
    text: buildMobilizationResponseConfirmationText(input),
  });
}

export async function sendPoliticalOperationInvitationEmail(
  input: PoliticalOperationInvitationInput
): Promise<void> {
  const timing = input.actionType === "volunteer_task"
    ? input.dueAt ? `Termen: ${input.dueAt}` : "Termenul este disponibil în portalul de membru."
    : input.startsAt ? `Data: ${input.startsAt}` : "Detaliile de program sunt disponibile în portal.";
  await queueNotification("mobilization.operation_invitation", {
    to: [input.email],
    subject: `PCS: ${input.actionTitle}`,
    text: [
      `Salut, ${input.fullName}!`,
      "",
      input.actionType === "volunteer_task"
        ? "Ți-a fost alocată o sarcină în cadrul activității PCS."
        : "Ai primit o invitație la o activitate PCS.",
      `Activitate: ${input.actionTitle}`,
      timing,
      "",
      "Confirmarea, detaliile și raportarea activității sunt disponibile în portalul tău de membru.",
      "",
      "Echipa PCS",
    ].join("\n"),
  });
}

export function buildMobilizationResponseConfirmationText(
  input: MobilizationResponseNotificationInput
): string {
  return [
    `Salut, ${input.fullName}!`,
    "",
    "Raspunsul tau a fost inregistrat in Centrul de mobilizare PCS.",
    `Actiune: ${input.actionTitle}`,
    `Tip: ${input.actionType}`,
    `Participare: ${input.participationMode || "detalii transmise ulterior"}`,
    `Judet: ${input.county}`,
    `Interese: ${input.interests.join(", ")}`,
    "",
    input.commitment,
    input.updatesConsent
      ? "Ai ales sa primesti actualizari relevante pentru judetul si interesele selectate."
      : "Nu ai solicitat actualizari suplimentare; acest mesaj confirma doar raspunsul trimis.",
    "",
    "Multumim pentru implicare,",
    "Echipa PCS-Partidul Conservator al Seniorilor",
  ].filter(Boolean).join("\n");
}

export async function sendNewsPublishedNotificationEmail(
  input: NewsPublishedNotificationInput
): Promise<void> {
  const recipients = env.emailNewsPublishRecipients;
  if (recipients.length === 0) {
    return;
  }

  await queueNotification("news.published_email", {
    to: recipients,
    subject: `Stire publicata: ${input.title}`,
    text: [
      "A fost publicata o stire noua pe platforma PCS.",
      "",
      `Titlu: ${input.title}`,
      `Categorie: ${input.category}`,
      `Publicata la: ${input.publishedAt}`,
      "",
      "Sumar:",
      input.summary,
      "",
      `Link: ${buildNewsLink(input.id)}`,
    ].join("\n"),
  });
}
