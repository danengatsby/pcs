import assert from "node:assert/strict";
import { test } from "node:test";
import { env } from "../../lib/env.js";
import {
  buildMobilizationResponseConfirmationText,
  buildNewsLink,
  buildVolunteerSignupNotificationText,
} from "../../lib/notificationEmails.js";

test("buildVolunteerSignupNotificationText should not include plaintext password", () => {
  const message = buildVolunteerSignupNotificationText({
    fullName: "Voluntar Test",
    email: "voluntar@example.test",
    county: "Cluj",
    locality: "Cluj-Napoca",
    phone: "0712345678",
    skills: "organizare",
    motivation: "Vreau sa contribui la proiecte locale.",
  });

  assert.match(message, /voluntar@example\.test/);
  assert.match(message, /parola setata in formular/i);
  assert.doesNotMatch(message, /Parola cont:/i);
  assert.match(message, /nu acorda automat calitatea de aderent sau membru/i);
  assert.match(message, /rolul de sustinator/i);
});

test("mobilization confirmation explains the selected communication scope", () => {
  const message = buildMobilizationResponseConfirmationText({
    fullName: "Ana Popescu",
    email: "ana@example.test",
    actionTitle: "Consultare locală",
    actionType: "consultation",
    participationMode: "Online",
    commitment: "Publicăm o sinteză fără date personale.",
    county: "Cluj",
    interests: ["pensii", "sanatate"],
    updatesConsent: true,
  });

  assert.match(message, /Consultare locală/);
  assert.match(message, /Judet: Cluj/);
  assert.match(message, /actualizari relevante/i);
  assert.doesNotMatch(message, /ana@example\.test/);
});

test("buildNewsLink should point to the SPA news detail route", () => {
  const previousBaseUrl = env.publicBaseUrl;
  env.publicBaseUrl = "https://pcs.test/";

  try {
    assert.equal(buildNewsLink(123), "https://pcs.test/news/123");
  } finally {
    env.publicBaseUrl = previousBaseUrl;
  }
});
