import type { ErrorCode } from "./errorCodes.js";

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;

  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export type DbError = {
  code?: string;
  detail?: string;
  constraint?: string;
};

export function isDbError(error: unknown): error is DbError {
  return typeof error === "object" && error !== null && "code" in error;
}

type JsonParserErrorShape = SyntaxError & {
  status?: number;
  type?: string;
};

export function isJsonParserError(error: unknown): error is JsonParserErrorShape {
  if (!(error instanceof SyntaxError)) {
    return false;
  }

  const candidate = error as JsonParserErrorShape;
  return candidate.status === 400 || candidate.type === "entity.parse.failed";
}
