export type Role = "officer" | "admin";

// The person doing something. Reporters are anonymous, so they are not actors.
export interface Actor {
  readonly id: string;
  readonly role: Role;
  readonly areas: readonly string[]; // districts an officer is assigned to
  readonly active: boolean; // a disabled account is refused everything
}
