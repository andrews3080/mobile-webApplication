import { InvalidRequestError } from "../application/errors";
import type { SubmitReportInput } from "../application/submit-report";
import type { Contact } from "../domain/report";
import { REPORT_STATUSES } from "../domain/status";
import type { ReportStatus } from "../domain/status";

// Everything arriving over HTTP is untrusted. These helpers check SHAPES (is it text? a number?).
// The domain then checks MEANING (is the description long enough? is the date sensible?).

type JsonObject = Record<string, unknown>;

function asObject(value: unknown, what: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InvalidRequestError(`${what} must be a JSON object`);
  }
  return value as JsonObject;
}

function optionalString(obj: JsonObject, field: string): string | undefined {
  const value = obj[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new InvalidRequestError(`"${field}" must be text`);
  return value;
}

function requiredString(obj: JsonObject, field: string): string {
  const value = optionalString(obj, field);
  if (value === undefined) throw new InvalidRequestError(`"${field}" is required`);
  return value;
}

function optionalNumber(obj: JsonObject, field: string): number | undefined {
  const value = obj[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number") throw new InvalidRequestError(`"${field}" must be a number`);
  return value;
}

function optionalStringList(obj: JsonObject, field: string): string[] | undefined {
  const value = obj[field];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new InvalidRequestError(`"${field}" must be a list of text`);
  }
  return value as string[];
}

export function parseSubmitRequest(idempotencyKey: string | undefined, rawBody: unknown): SubmitReportInput {
  const body = asObject(rawBody, "The request body");

  let contact: Contact | undefined;
  const contactRaw = body["contact"];
  if (contactRaw !== undefined && contactRaw !== null) {
    const c = asObject(contactRaw, '"contact"');
    contact = {
      name: optionalString(c, "name"),
      phone: optionalString(c, "phone"),
      email: optionalString(c, "email"),
    };
  }

  return {
    idempotencyKey: idempotencyKey ?? "", // the use case rejects a missing or short key
    description: requiredString(body, "description"),
    category: requiredString(body, "category"),
    observedAt: new Date(requiredString(body, "observedAt")),
    area: requiredString(body, "area"),
    latitude: optionalNumber(body, "latitude"),
    longitude: optionalNumber(body, "longitude"),
    photoKeys: optionalStringList(body, "photoKeys"),
    contact,
  };
}

export function parseLoginRequest(rawBody: unknown): { email: string; password: string } {
  const body = asObject(rawBody, "The request body");
  const email = requiredString(body, "email");
  const password = requiredString(body, "password");
  // Very long passwords would make the slow hash a way to overload the server
  if (email.length > 254 || password.length > 200) {
    throw new InvalidRequestError("Email or password is too long");
  }
  return { email, password };
}

export function parseTextField(rawBody: unknown, field: string): string {
  return requiredString(asObject(rawBody, "The request body"), field);
}

export function parseStatusFilter(value: unknown): ReportStatus | undefined {
  if (value === undefined) return undefined;
  const found = REPORT_STATUSES.find((status) => status === value);
  if (!found) throw new InvalidRequestError("Unknown status filter");
  return found;
}

// ---------- Photo uploads ----------

export function parseUploadSlotRequest(rawBody: unknown): { contentType: string; sizeBytes: number } {
  const body = asObject(rawBody, "The request body");
  const sizeBytes = optionalNumber(body, "sizeBytes");
  if (sizeBytes === undefined) throw new InvalidRequestError('"sizeBytes" is required');
  return { contentType: requiredString(body, "contentType"), sizeBytes };
}

// The upload link carries ?expires=<milliseconds>&sig=<64 hex characters>
export function parseUploadQuery(expires: unknown, signature: unknown): { expiresAtMs: number; signature: string } {
  if (typeof expires !== "string" || !/^\d{10,15}$/.test(expires)) {
    throw new InvalidRequestError("The upload link is not valid");
  }
  if (typeof signature !== "string" || !/^[0-9a-f]{64}$/.test(signature)) {
    throw new InvalidRequestError("The upload link is not valid");
  }
  return { expiresAtMs: Number(expires), signature };
}
