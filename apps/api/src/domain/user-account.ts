import type { Actor, Role } from "./actor";

// A person who can log in. Reporters are anonymous, so they never have accounts.
export interface UserAccount {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string; // never the password itself
  readonly role: Role;
  readonly areas: readonly string[];
  readonly active: boolean;
}

// The Actor is what the access rules look at. It never includes the password hash.
export function toActor(account: UserAccount): Actor {
  return { id: account.id, role: account.role, areas: account.areas, active: account.active };
}
