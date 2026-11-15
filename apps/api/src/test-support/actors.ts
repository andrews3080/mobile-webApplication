import type { Actor } from "../domain/actor";

// The default officer works in "Sample Community", the same area aReport() uses
export function anOfficer(overrides: Partial<Actor> = {}): Actor {
  return { id: "officer-1", role: "officer", areas: ["Sample Community"], active: true, ...overrides };
}

export function anAdmin(overrides: Partial<Actor> = {}): Actor {
  return { id: "admin-1", role: "admin", areas: [], active: true, ...overrides };
}
