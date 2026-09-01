import type { ErrorRequestHandler } from "express";
import { AppError, isDbError, isJsonParserError } from "../lib/errors.js";
import { sendError } from "../lib/http.js";
import { appLogger } from "../lib/logger.js";
import { incrementAuthFailure, isAuthFailureCode } from "../lib/metrics.js";
import { recordRefreshFailure } from "./metricsAuth.js";
import { readRequestPath } from "./paths.js";

export function createErrorHandler(): ErrorRequestHandler {
  return (error, req, res, _next) => {
    const requestId = (res.locals as { requestId?: string }).requestId ?? "unknown";
    const requestPath = readRequestPath(req);

    if (error instanceof AppError) {
      if (isAuthFailureCode(error.code)) {
        incrementAuthFailure(error.code, requestPath);
      }
      recordRefreshFailure(requestPath, error.code);

      const logMethod = error.status >= 500 ? appLogger.error.bind(appLogger) : appLogger.warn.bind(appLogger);
      logMethod(
        {
          requestId,
          code: error.code,
          status: error.status,
          err: error,
        },
        "Business error handled"
      );
      sendError(res, error.status, {
        code: error.code,
        message: error.message,
      });
      return;
    }

    if (isJsonParserError(error)) {
      recordRefreshFailure(requestPath, "INVALID_JSON");

      appLogger.warn(
        {
          requestId,
          err: error,
        },
        "Invalid JSON body"
      );
      sendError(res, 400, {
        code: "INVALID_JSON",
        message: "Body JSON invalid.",
      });
      return;
    }

    if (isDbError(error) && error.code === "23505") {
      recordRefreshFailure(requestPath, "CONFLICT");

      appLogger.warn(
        {
          requestId,
          code: error.code,
          constraint: error.constraint,
        },
        "Database conflict"
      );
      sendError(res, 409, {
        code: "CONFLICT",
        message: "Resursa exista deja.",
      });
      return;
    }

    appLogger.error(
      {
        requestId,
        err: error,
      },
      "Unhandled server error"
    );
    recordRefreshFailure(requestPath, "INTERNAL_SERVER_ERROR");
    sendError(res, 500, {
      code: "INTERNAL_SERVER_ERROR",
      message: "Eroare interna de server.",
    });
  };
}
