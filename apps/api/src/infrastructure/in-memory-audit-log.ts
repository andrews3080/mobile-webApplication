import type { AuditEntry, AuditLog } from "../application/ports";

// Append-only: there is no way to edit or delete an entry through this class
export class InMemoryAuditLog implements AuditLog {
  private readonly items: AuditEntry[] = [];

  async record(entry: AuditEntry): Promise<void> {
    this.items.push({ ...entry });
  }

  // For tests and the admin screen later. Returns a copy so callers cannot tamper with the log.
  entries(): readonly AuditEntry[] {
    return [...this.items];
  }
}
