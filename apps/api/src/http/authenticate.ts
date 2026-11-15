import type { RequestHandler, Response } from "express";
import type { Actor } from "../domain/actor";
import { toActor } from "../domain/user-account";
import { UnauthorizedError } from "../application/security-errors";
import type { TokenService, UserFinder } from "../application/security-ports";

// Reads "Authorization: Bearer <token>", finds the user, and attaches them as the Actor.
// A disabled user still passes through, so the AccessGate can REFUSE AND LOG them.
export function authenticate(tokens: TokenService, users: UserFinder): RequestHandler {
  return (req, res, next) => {
    const run = async (): Promise<void> => {
      const header = req.header("Authorization") ?? "";
      const token = /^Bearer (\S+)$/.exec(header)?.[1];
      const userId = token ? tokens.verify(token) : null;
      const account = userId ? await users.findById(userId) : null;
      if (!account) throw new UnauthorizedError();
      res.locals["actor"] = toActor(account);
      next();
    };
    run().catch(next);
  };
}

export function actorOf(res: Response): Actor {
  const actor: unknown = res.locals["actor"];
  if (!actor) throw new UnauthorizedError();
  return actor as Actor;
}
