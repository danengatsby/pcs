import assert from "node:assert/strict";
import test from "node:test";
import { createCommunicationDispatchSchema } from "../../modules/communications/communications.schema.js";
import { memberConsentSchema, memberTaskReportSchema } from "../../modules/memberPortal/memberPortal.schema.js";
import { createPoliticalOperationSchema } from "../../modules/politicalOperations/politicalOperations.schema.js";

test("political operation schema requires timing for events but permits tasks without it", () => {
  const base = {
    title: "Ședință teritorială",
    summary: "Pregătirea echipei pentru următoarea acțiune locală.",
    objective: "Confirmarea echipei și distribuirea responsabilităților.",
  };
  assert.equal(createPoliticalOperationSchema.safeParse({ ...base, type: "event" }).success, false);
  assert.equal(createPoliticalOperationSchema.safeParse({ ...base, type: "event", startsAt: "2026-10-10T10:00:00.000Z" }).success, true);
  assert.equal(createPoliticalOperationSchema.safeParse({ ...base, type: "volunteer_task" }).success, true);
});

test("member communication consent requires a phone for SMS and WhatsApp", () => {
  const base = { emailConsent: true, smsConsent: false, whatsappConsent: false };
  assert.equal(memberConsentSchema.safeParse(base).success, true);
  assert.equal(memberConsentSchema.safeParse({ ...base, smsConsent: true }).success, false);
  assert.equal(memberConsentSchema.safeParse({ ...base, whatsappConsent: true, phone: "0712345678" }).success, true);
});

test("segmented delivery requires an explicit final confirmation", () => {
  const base = {
    channel: "email",
    title: "Informare teritorială",
    message: "Mesaj pentru segmentul care și-a dat acordul.",
  };
  assert.equal(createCommunicationDispatchSchema.safeParse({ ...base, mode: "draft" }).success, true);
  assert.equal(createCommunicationDispatchSchema.safeParse({ ...base, mode: "send" }).success, false);
  assert.equal(createCommunicationDispatchSchema.safeParse({ ...base, mode: "send", confirmConsentSelection: true }).success, true);
});

test("member task reports require meaningful activity and valid hours", () => {
  assert.equal(memberTaskReportSchema.safeParse({ status: "reported", report: "ok", hours: 1 }).success, false);
  assert.equal(memberTaskReportSchema.safeParse({ status: "reported", report: "Activitate finalizată.", hours: 2.5 }).success, true);
});
