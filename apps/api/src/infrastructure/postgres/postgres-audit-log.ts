import type { AuditEntry, AuditLog } from "../../application/ports";
import type { Database } from "./pool";

type AuditRow = {
  actor_id: string;
  action: string;
  target: string | null;
  outcome: "allowed" | "denied";
  detail: string | null;
  at: Date;
};

// The table itself refuses UPDATE and DELETE (see the migration), and this class only inserts
export class PostgresAuditLog implements AuditLog {
  constructor(private readonly pool: Database) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.pool.query(
      "INSERT INTO audit_log (actor_id, action, target, outcome, detail, at) VALUES ($1, $2, $3, $4, $5, $6)",
      [entry.actorId, entry.action, entry.target ?? null, entry.outcome, entry.detail ?? null, entry.at],
    );
  }

  // For tests and the admin screen later. Not part of the AuditLog port.
  async entries(): Promise<AuditEntry[]> {
    const result = await this.pool.query<AuditRow>(
      "SELECT actor_id, action, target, outcome, detail, at FROM audit_log ORDER BY id",
    );
    return result.rows.map((row) => ({
      actorId: row.actor_id,
      action: row.action,
      target: row.target ?? undefined,
      outcome: row.outcome,
      detail: row.detail ?? undefined,
      at: row.at,
    }));
  }
}
