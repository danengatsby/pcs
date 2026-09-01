import assert from "node:assert/strict";
import test from "node:test";
import { env } from "../../lib/env.js";
import { evaluateCaptchaVerification } from "../../modules/volunteers/captcha.js";
import { verifyCaptchaToken } from "../../modules/volunteers/captcha.js";

test("evaluateCaptchaVerification should accept a valid payload", () => {
  const result = evaluateCaptchaVerification({
    success: true,
    hostname: env.captchaExpectedHostname || "localhost",
    action: env.captchaExpectedAction,
    score: env.captchaMinScore === null ? undefined : Math.max(env.captchaMinScore, 0.99),
  });

  assert.equal(result.valid, true);
  assert.equal(result.reason, "captcha_ok");
});

test("evaluateCaptchaVerification should reject invalid action", () => {
  const result = evaluateCaptchaVerification({
    success: true,
    hostname: env.captchaExpectedHostname || "localhost",
    action: `${env.captchaExpectedAction}-invalid`,
    score: env.captchaMinScore === null ? undefined : Math.max(env.captchaMinScore, 0.99),
  });

  assert.equal(result.valid, false);
  assert.equal(result.reason, "captcha_action_mismatch");
});

test("evaluateCaptchaVerification should reject unsuccessful payloads", () => {
  const result = evaluateCaptchaVerification({
    success: false,
    hostname: env.captchaExpectedHostname || "localhost",
    action: env.captchaExpectedAction,
    "error-codes": ["timeout-or-duplicate"],
  });

  assert.equal(result.valid, false);
  assert.equal(result.reason, "captcha_unsuccessful");
  assert.deepEqual(result.errorCodes, ["timeout-or-duplicate"]);
});

test("verifyCaptchaToken should reject missing token", async () => {
  const result = await verifyCaptchaToken("", "");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "captcha_token_missing");
});
