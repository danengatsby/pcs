import assert from "node:assert/strict";
import { test } from "node:test";
import { env } from "../../lib/env.js";
import {
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
