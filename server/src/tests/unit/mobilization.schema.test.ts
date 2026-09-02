import assert from "node:assert/strict";
import test from "node:test";
import {
  mobilizationActionParamsSchema,
  mobilizationResponseSchema,
} from "../../modules/mobilization/mobilization.schema.js";

const validPayload = {
  fullName: "Ana Popescu",
  email: "ANA@example.test",
  county: "Iasi",
  interests: ["pensii", "sanatate"],
  updatesConsent: true,
  privacyConsent: true,
};

test("mobilization schema normalizes email and official county names", () => {
  const result = mobilizationResponseSchema.safeParse(validPayload);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.email, "ana@example.test");
    assert.equal(result.data.county, "Iași");
    assert.deepEqual(result.data.interests, ["pensii", "sanatate"]);
  }
});

test("mobilization schema requires an interest and privacy consent", () => {
  assert.equal(mobilizationResponseSchema.safeParse({
    ...validPayload,
    interests: [],
  }).success, false);
  assert.equal(mobilizationResponseSchema.safeParse({
    ...validPayload,
    privacyConsent: false,
  }).success, false);
});

test("mobilization action slug rejects unsafe path values", () => {
  assert.equal(mobilizationActionParamsSchema.safeParse({ slug: "actiune-locala" }).success, true);
  assert.equal(mobilizationActionParamsSchema.safeParse({ slug: "../actiune" }).success, false);
});
