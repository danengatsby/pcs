import type { FastifyReply } from "fastify";
import type { Response as ExpressResponse } from "express";

export type ApiEnvelopeSuccess<T> = {
  data: T;
  error: null;
  meta: {
    requestId: string;
    timestamp: string;
  };
};

export type ApiEnvelopeError = {
  data: null;
  error: {
    code: string;
    message: string;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
};

export type ApiEnvelopeMeta = ApiEnvelopeSuccess<unknown>["meta"];

export type ApiEnvelope<T> = ApiEnvelopeSuccess<T> | ApiEnvelopeError;

export function getRequestIdFromResponseLocals(res: ExpressResponse): string | null {
  const locals = res.locals as { requestId?: unknown } | undefined;
  const requestId = locals?.requestId;
  return typeof requestId === "string" && requestId.length > 0 ? requestId : null;
}

export function buildMeta(requestId: string): { requestId: string; timestamp: string } {
  return {
    requestId,
    timestamp: new Date().toISOString(),
  };
}

export function buildSuccessEnvelope<T>(requestId: string, data: T): ApiEnvelopeSuccess<T> {
  return {
    data,
    error: null,
    meta: buildMeta(requestId),
  };
}

export function buildErrorEnvelope(requestId: string, code: string, message: string): ApiEnvelopeError {
  return {
    data: null,
    error: { code, message },
    meta: buildMeta(requestId),
  };
}

/**
 * Fastify helper.
 *
 * (We keep this as a convenience wrapper to avoid repeating `.code().send()` patterns.)
 */
export function sendFastifySuccess<T>(
  reply: Pick<FastifyReply, "code" | "send">,
  requestId: string,
  data: T,
  status = 200
): void {
  reply.code(status).send(buildSuccessEnvelope(requestId, data));
}

/**
 * Fastify helper.
 *
 * (We keep this as a convenience wrapper to avoid repeating `.code().send()` patterns.)
 */
export function sendFastifyError(
  reply: Pick<FastifyReply, "code" | "send">,
  requestId: string,
  status: number,
  code: string,
  message: string
): void {
  reply.code(status).send(buildErrorEnvelope(requestId, code, message));
}

export function sendExpressSuccess<T>(
  res: ExpressResponse,
  requestId: string,
  data: T,
  status = 200
): void {
  res.status(status).json(buildSuccessEnvelope(requestId, data));
}

export function sendExpressError(
  res: ExpressResponse,
  requestId: string,
  status: number,
  code: string,
  message: string
): void {
  res.status(status).json(buildErrorEnvelope(requestId, code, message));
}
