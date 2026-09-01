import type { Response } from "express";

type ApiMeta = {
  requestId: string;
  timestamp: string;
  [key: string]: unknown;
};

type ApiErrorPayload = {
  code: string;
  message: string;
};

function readRequestId(res: Response): string {
  const requestId = (res.locals as { requestId?: string }).requestId;
  return typeof requestId === "string" && requestId ? requestId : "unknown";
}

function buildMeta(res: Response, extraMeta: Record<string, unknown> = {}): ApiMeta {
  return {
    requestId: readRequestId(res),
    timestamp: new Date().toISOString(),
    ...extraMeta,
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  options: { status?: number; meta?: Record<string, unknown> } = {}
): void {
  const status = options.status ?? 200;
  res.status(status).json({
    data,
    error: null,
    meta: buildMeta(res, options.meta),
  });
}

export function sendError(
  res: Response,
  status: number,
  error: ApiErrorPayload,
  meta: Record<string, unknown> = {}
): void {
  res.status(status).json({
    data: null,
    error,
    meta: buildMeta(res, meta),
  });
}
