import express from "express";
import type { Request, RequestHandler, Response } from "express";
import { InvalidRequestError } from "../application/errors";
import { MAX_PHOTO_BYTES } from "../application/photo-rules";
import type { RateLimiter } from "../application/security-ports";
import type { Services } from "../composition-root";
import { IMAGE_TYPES } from "../domain/image-type";
import { actorOf, authenticate } from "./authenticate";
import { errorHandler } from "./error-handler";
import { rateLimit } from "./rate-limit";
import {
  parseLoginRequest,
  parseOptionalTextField,
  parseStatusFilter,
  parseSubmitRequest,
  parseTextField,
  parseUploadQuery,
  parseUploadSlotRequest,
} from "./request-parsers";

export interface Limiters {
  submit: RateLimiter;
  track: RateLimiter;
  login: RateLimiter;
  upload: RateLimiter;
}

export interface AppOptions {
  limiters: Limiters;
  onUnexpectedError?: (error: unknown) => void;
}

// Sends rejected promises to the error handler (works the same in Express 4 and 5)
function handle(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === "string" ? value : "";
}

// Routes only TRANSLATE: HTTP in, use case call, HTTP out. No business rules live here.
export function createApp(services: Services, options: AppOptions) {
  const { limiters } = options;
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store"); // never cache report data on shared phones
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // ---------- Public: reporters (no account) ----------

  app.post(
    "/api/reports",
    rateLimit(limiters.submit),
    handle(async (req, res) => {
      const input = parseSubmitRequest(req.header("Idempotency-Key"), req.body);
      const result = await services.submitReport.execute(input);
      res.status(result.alreadyReceived ? 200 : 201).json(result);
    }),
  );

  app.get(
    "/api/track/:code",
    rateLimit(limiters.track),
    handle(async (req, res) => {
      res.json(await services.trackReport.execute(param(req, "code")));
    }),
  );

  // ---------- Photo uploads (reporters, no account) ----------

  // Step 1: ask for a signed, expiring upload slot
  app.post(
    "/api/uploads",
    rateLimit(limiters.upload),
    handle(async (req, res) => {
      const { contentType, sizeBytes } = parseUploadSlotRequest(req.body);
      const slot = await services.createUploadSlot.execute({ contentType, sizeBytes });
      res.status(201).json({
        key: slot.key,
        uploadUrl: `/api/uploads/${slot.key.slice("photos/".length)}?expires=${slot.expiresAtMs}&sig=${slot.signature}`,
        expiresAt: new Date(slot.expiresAtMs).toISOString(),
        contentType: slot.contentType,
        maxBytes: slot.maxBytes,
      });
    }),
  );

  // Step 2: send the raw photo bytes to the slot. express.raw refuses anything over the size limit (413).
  app.put(
    "/api/uploads/:file",
    rateLimit(limiters.upload),
    express.raw({ type: [...IMAGE_TYPES], limit: MAX_PHOTO_BYTES }),
    handle(async (req, res) => {
      const { expiresAtMs, signature } = parseUploadQuery(req.query["expires"], req.query["sig"]);
      if (!Buffer.isBuffer(req.body)) {
        throw new InvalidRequestError("Send the photo as raw bytes with Content-Type image/jpeg, image/png or image/webp");
      }
      const stored = await services.storePhoto.execute({
        key: `photos/${param(req, "file")}`,
        expiresAtMs,
        signature,
        declaredType: req.header("Content-Type")?.split(";")[0]?.trim().toLowerCase(),
        bytes: req.body,
      });
      res.status(201).json(stored);
    }),
  );

  // ---------- Login ----------

  app.post(
    "/api/auth/login",
    rateLimit(limiters.login),
    handle(async (req, res) => {
      const { email, password } = parseLoginRequest(req.body);
      res.json(await services.login.execute(email, password));
    }),
  );

  // ---------- Officers ----------

  const officerOnly = authenticate(services.tokens, services.users);

  app.get(
    "/api/officer/reports",
    officerOnly,
    handle(async (req, res) => {
      const status = parseStatusFilter(req.query["status"]);
      const reports = await services.listReports.execute(actorOf(res), status ? { status } : {});
      res.json({ reports });
    }),
  );

  app.get(
    "/api/officer/reports/:code",
    officerOnly,
    handle(async (req, res) => {
      const report = await services.getReport.execute(actorOf(res), param(req, "code"));
      res.json(services.officerMapper.toView(report));
    }),
  );

  app.get(
    "/api/officer/reports/:code/photos/:file",
    officerOnly,
    handle(async (req, res) => {
      const photo = await services.getPhoto.execute(actorOf(res), param(req, "code"), param(req, "file"));
      res.setHeader("Content-Security-Policy", "default-src 'none'"); // a photo must never run anything
      res.type(photo.contentType).send(Buffer.from(photo.bytes));
    }),
  );

  app.post(
    "/api/officer/reports/:code/start-review",
    officerOnly,
    handle(async (req, res) => {
      res.json(await services.startReview.execute(actorOf(res), param(req, "code")));
    }),
  );

  app.post(
    "/api/officer/reports/:code/verify",
    officerOnly,
    handle(async (req, res) => {
      const reason = parseTextField(req.body, "reason");
      res.json(await services.verifyReport.execute(actorOf(res), param(req, "code"), reason));
    }),
  );

  app.post(
    "/api/officer/reports/:code/reject",
    officerOnly,
    handle(async (req, res) => {
      const reason = parseTextField(req.body, "reason");
      res.json(await services.rejectReport.execute(actorOf(res), param(req, "code"), reason));
    }),
  );

  app.post(
    "/api/officer/reports/:code/request-information",
    officerOnly,
    handle(async (req, res) => {
      const question = parseTextField(req.body, "question");
      res.json(await services.requestInformation.execute(actorOf(res), param(req, "code"), question));
    }),
  );

  app.post(
    "/api/officer/reports/:code/refer-for-action",
    officerOnly,
    handle(async (req, res) => {
      const note = parseTextField(req.body, "note");
      res.json(await services.referForAction.execute(actorOf(res), param(req, "code"), note));
    }),
  );

  app.post(
    "/api/officer/reports/:code/close",
    officerOnly,
    handle(async (req, res) => {
      const note = parseOptionalTextField(req.body, "note");
      res.json(await services.closeReport.execute(actorOf(res), param(req, "code"), note));
    }),
  );

  // ---------- Fallbacks ----------

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "not_found", message: "No such route" } });
  });
  app.use(errorHandler(options.onUnexpectedError ?? ((error) => console.error(error))));

  return app;
}
