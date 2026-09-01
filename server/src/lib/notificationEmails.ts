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
    subject: "Cont PCP creat cu succes",
    text: [
      `Salut, ${input.fullName}!`,
      "",
      "Contul tau pe platforma PCP a fost creat cu succes.",
      "Poti intra in platforma pentru a-ti completa profilul si a urmari noutatile.",
      "",
      "Multumim,",
      "Echipa PCP",
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
      "Statusul tau de voluntar in platforma PCP a fost actualizat.",
      `Status anterior: ${input.previousStatus}`,
      `Status nou: ${input.nextStatus}`,
      `Actualizat de: ${input.updatedBy}`,
      "",
      "Multumim pentru implicare,",
      "Echipa PCP",
    ].join("\n"),
  });
}

export async function sendVolunteerSignupNotificationEmail(
  input: VolunteerSignupNotificationInput
): Promise<void> {
  const messageText = buildVolunteerSignupNotificationText(input);

  await queueNotification("volunteer.signup_email", {
    to: [input.email],
    subject: "Confirmare inscriere aderent PCP-Partidul Conservator al Pensionarilor",
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
    "Inscrierea dvs. ca aderent in platforma PCP-Partidul Conservator al Pensionarilor a fost inregistrata cu succes.",
    "Veti primi actualizari pe email privind pasii urmatori.",
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
    "INSCRIEREA NU VA FACE DEVENITI MEMBRU AL PCP, CI ARATA INTERESUL DVS. PENRU ACEST PARTID.",
    "INSCRIEREA CA MEMBRU DE PARTID SE FACE CU UN FORMULAR SPECIAL TRIMIS PRIN POSTA CARE SE VA COMPLETA SI SE VA TRIMITE INAPOI LA SEDIUL PARTIDULUI PENTRU INREGISTRARE.",
    "",
    "Multumim pentru interes,",
    "Echipa PCP-Partidul Conservator al Pensionarilor",
    "https://pcpens.online/index.html",
  ].join("\n");
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
      "A fost publicata o stire noua pe platforma PCP.",
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
