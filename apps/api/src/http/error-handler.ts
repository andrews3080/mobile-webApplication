import type { NextFunction, Request, Response } from "express";
import { ConflictError, ForbiddenError, InvalidRequestError, NotFoundError } from "../application/errors";
import { InvalidCredentialsError, TooManyRequestsError, UnauthorizedError } from "../application/security-errors";
import { DomainError } from "../domain/errors";

interface HttpProblem {
  status: number;
  code: string;
  message: string;
}

function describe(error: unknown): HttpProblem {
  if (error instanceof DomainError) return { status: 422, code: "validation_failed", message: error.message };
  if (error instanceof InvalidRequestError) return { status: 400, code: "bad_request", message: error.message };
  if (error instanceof InvalidCredentialsError) return { status: 401, code: "invalid_credentials", message: error.message };
  if (error instanceof UnauthorizedError) return { status: 401, code: "unauthorized", message: error.message };
  if (error instanceof ForbiddenError) return { status: 403, code: "forbidden", message: error.message };
  if (error instanceof NotFoundError) return { status: 404, code: "not_found", message: error.message };
  if (error instanceof ConflictError) return { status: 409, code: "conflict", message: error.message };
  if (error instanceof TooManyRequestsError) return { status: 429, code: "too_many_requests", message: error.message };

  // Errors raised by the JSON body parser carry a "type"
  const type = typeof error === "object" && error !== null && "type" in error ? (error as { type: unknown }).type : undefined;
  if (type === "entity.parse.failed") return { status: 400, code: "bad_request", message: "The request body is not valid JSON" };
  if (type === "entity.too.large") return { status: 413, code: "too_large", message: "The request body is too large" };

  return { status: 500, code: "server_error", message: "Something went wrong on our side" };
}

// Express recognises an error handler by its FOUR parameters, so keep all four.
export function errorHandler(onUnexpected: (error: unknown) => void) {
  return (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    const problem = describe(error);
    if (problem.status === 500) onUnexpected(error); // log it, but never show details to the caller
    res.status(problem.status).json({ error: { code: problem.code, message: problem.message } });
  };
}
