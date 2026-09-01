import { env } from "../../lib/env.js";
import type { CaptchaVerificationResult, CaptchaVerifyResponse } from "./types.js";

const captchaRequestTimeoutMs = 5000;

function readErrorCodes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function evaluateCaptchaVerification(payload: CaptchaVerifyResponse | null): CaptchaVerificationResult {
  if (!payload) {
    return {
      valid: false,
      reason: "captcha_response_invalid",
      hostname: "",
      action: "",
      score: null,
      errorCodes: [],
    };
  }

  const errorCodes = readErrorCodes(payload["error-codes"]);
  const hostname = (payload.hostname ?? "").trim().toLowerCase();
  const action = (payload.action ?? "").trim();
  const score = typeof payload.score === "number" && Number.isFinite(payload.score)
    ? payload.score
    : null;

  if (payload.success !== true) {
    return {
      valid: false,
      reason: "captcha_unsuccessful",
      hostname,
      action,
      score,
      errorCodes,
    };
  }

  if (env.captchaExpectedHostname && hostname !== env.captchaExpectedHostname.toLowerCase()) {
    return {
      valid: false,
      reason: "captcha_hostname_mismatch",
      hostname,
      action,
      score,
      errorCodes,
    };
  }

  if (env.captchaExpectedAction && action !== env.captchaExpectedAction) {
    return {
      valid: false,
      reason: "captcha_action_mismatch",
      hostname,
      action,
      score,
      errorCodes,
    };
  }

  if (env.captchaMinScore !== null) {
    if (score === null) {
      return {
        valid: false,
        reason: "captcha_score_missing",
        hostname,
        action,
        score,
        errorCodes,
      };
    }

    if (score < env.captchaMinScore) {
      return {
        valid: false,
        reason: "captcha_score_too_low",
        hostname,
        action,
        score,
        errorCodes,
      };
    }
  }

  return {
    valid: true,
    reason: "captcha_ok",
    hostname,
    action,
    score,
    errorCodes,
  };
}

function buildInvalidCaptchaResult(reason: string): CaptchaVerificationResult {
  return {
    valid: false,
    reason,
    hostname: "",
    action: "",
    score: null,
    errorCodes: [],
  };
}

async function submitCaptchaToken(token: string, remoteIp: string): Promise<CaptchaVerifyResponse | null> {
  const requestBody = new URLSearchParams();
  requestBody.set("secret", env.captchaSecret);
  requestBody.set("response", token);
  if (remoteIp) {
    requestBody.set("remoteip", remoteIp);
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, captchaRequestTimeoutMs);

  try {
    const response = await fetch(env.captchaVerifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: requestBody,
      signal: abortController.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    if (!payload || typeof payload !== "object") {
      return null;
    }

    return payload as CaptchaVerifyResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function verifyCaptchaToken(
  token: string,
  remoteIp: string
): Promise<CaptchaVerificationResult> {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    return buildInvalidCaptchaResult("captcha_token_missing");
  }

  if (!env.captchaSecret) {
    return buildInvalidCaptchaResult("captcha_secret_missing");
  }

  const payload = await submitCaptchaToken(normalizedToken, remoteIp);
  return evaluateCaptchaVerification(payload);
}
