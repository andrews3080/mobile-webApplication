import type { PoolClient } from "pg";
import { normaliseArea } from "../../domain/area";
import type { ReferenceCode } from "../../domain/reference-code";
import { Report } from "../../domain/report";
import type { Contact, StatusEvent } from "../../domain/report";
import type { ReportStatus } from "../../domain/status";
import type { ReportRepository } from "../../application/ports";
import type { Database } from "./pool";

type ReportRow = {
  reference: string;
  description: string;
  category: string;
  observed_at: Date;
  created_at: Date;
  area: string;
  latitude: number | null;
  longitude: number | null;
  place_details: string | null;
  photo_keys: string[];
  contact: Contact | null;
  status: ReportStatus;
};

type EventRow = {
  reference: string;
  from_status: ReportStatus;
  to_status: ReportStatus;
  officer_id: string;
  reason: string | null;
  at: Date;
};

const INSERT_REPORT = `
  INSERT INTO reports (
    reference, idempotency_key, description, category, observed_at, created_at,
    area, area_key, latitude, longitude, photo_keys, contact, status, place_details
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14)
  ON CONFLICT (idempotency_key) DO NOTHING`;

async function insertEvents(client: PoolClient, report: Report): Promise<void> {
  const reference = report.reference.toString();
  for (const [index, event] of report.history.entries()) {
    await client.query(
      `INSERT INTO status_events (reference, seq, from_status, to_status, officer_id, reason, at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [reference, index, event.from, event.to, event.officerId, event.reason ?? null, event.at],
    );
  }
}

// Stores reports in PostgreSQL. Must behave exactly like InMemoryReportRepository,
// and the shared contract tests prove it.
export class PostgresReportRepository implements ReportRepository {
  constructor(private readonly pool: Database) {}

  async saveIfNew(report: Report, idempotencyKey: string): Promise<{ report: Report; created: boolean }> {
    const client = await this.pool.connect();
    let created = false;
    try {
      await client.query("BEGIN");
      // The UNIQUE key makes this atomic: when two copies of the same submission
      // arrive at once, the database lets exactly one of them insert.
      const inserted = await client.query(INSERT_REPORT, [
        report.reference.toString(),
        idempotencyKey,
        report.description,
        report.category,
        report.observedAt,
        report.createdAt,
        report.location.area,
        normaliseArea(report.location.area),
        report.location.latitude ?? null,
        report.location.longitude ?? null,
        [...report.photoKeys],
        report.contact ? JSON.stringify(report.contact) : null,
        report.status,
        report.location.placeDetails ?? null,
      ]);
      created = (inserted.rowCount ?? 0) > 0;
      if (created) await insertEvents(client, report);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    if (created) return { report, created: true };

    // Same key seen before: return the CURRENT version of the original report
    const result = await this.pool.query<ReportRow>("SELECT * FROM reports WHERE idempotency_key = $1", [idempotencyKey]);
    const existing = (await this.hydrate(result.rows))[0];
    if (!existing) throw new Error("A report with this idempotency key was expected but not found");
    return { report: existing, created: false };
  }

  async findByReference(reference: ReferenceCode): Promise<Report | null> {
    const result = await this.pool.query<ReportRow>("SELECT * FROM reports WHERE reference = $1", [reference.toString()]);
    return (await this.hydrate(result.rows))[0] ?? null;
  }

  async listByAreas(areas: readonly string[]): Promise<Report[]> {
    if (areas.length === 0) return [];
    const result = await this.pool.query<ReportRow>(
      "SELECT * FROM reports WHERE area_key = ANY($1::text[]) ORDER BY created_at DESC",
      [areas.map(normaliseArea)],
    );
    return this.hydrate(result.rows);
  }

  async replace(report: Report, expectedStatus: ReportStatus): Promise<boolean> {
    const reference = report.reference.toString();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Changes the row ONLY if its status is still what the officer saw.
      // If another officer got there first, zero rows match and we report "stale".
      const updated = await client.query("UPDATE reports SET status = $1 WHERE reference = $2 AND status = $3", [
        report.status,
        reference,
        expectedStatus,
      ]);
      if ((updated.rowCount ?? 0) === 0) {
        await client.query("ROLLBACK");
        return false;
      }
      // We now hold the row lock, so nobody else can change the history meanwhile
      await client.query("DELETE FROM status_events WHERE reference = $1", [reference]);
      await insertEvents(client, report);
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  // Turns database rows into domain reports (loading all their status events in ONE query)
  private async hydrate(rows: ReportRow[]): Promise<Report[]> {
    if (rows.length === 0) return [];

    const events = await this.pool.query<EventRow>(
      `SELECT reference, from_status, to_status, officer_id, reason, at
       FROM status_events WHERE reference = ANY($1::text[]) ORDER BY reference, seq`,
      [rows.map((row) => row.reference)],
    );

    const byReference = new Map<string, StatusEvent[]>();
    for (const event of events.rows) {
      const list = byReference.get(event.reference) ?? [];
      list.push({
        from: event.from_status,
        to: event.to_status,
        officerId: event.officer_id,
        reason: event.reason ?? undefined,
        at: event.at,
      });
      byReference.set(event.reference, list);
    }

    return rows.map((row) =>
      Report.restore({
        reference: row.reference,
        description: row.description,
        category: row.category,
        observedAt: row.observed_at,
        createdAt: row.created_at,
        area: row.area,
        latitude: row.latitude ?? undefined,
        longitude: row.longitude ?? undefined,
        placeDetails: row.place_details ?? undefined,
        photoKeys: row.photo_keys,
        contact: row.contact ?? undefined,
        status: row.status,
        history: byReference.get(row.reference) ?? [],
      }),
    );
  }
}
