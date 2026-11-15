import express from "express";
import type { Request, RequestHandler, Response } from "express";
import type { RateLimiter } from "../application/security-ports";
import type { Services } from "../composition-root";
import { actorOf, authenticate } from "./authenticate";
import { errorHandler } from "./error-handler";
import { rateLimit } from "./rate-limit";
import { parseLoginRequest, parseStatusFilter, parseSubmitRequest, parseTextField } from "./request-parsers";

export interface Limiters {
  submit: RateLimiter;
  track: RateLimiter;
  login: RateLimiter;
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

  // ---------- Fallbacks ----------

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "not_found", message: "No such route" } });
  });
  app.use(errorHandler(options.onUnexpectedError ?? ((error) => console.error(error))));

  return app;
}
