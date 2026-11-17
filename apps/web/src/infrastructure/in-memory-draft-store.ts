import type { DraftStore } from "../core/ports";
import type { ReportDraft } from "../core/report-draft";

// Keeps the draft in memory. For tests, and as a fallback.
export class InMemoryDraftStore implements DraftStore {
  private stored: ReportDraft | null = null;

  async load(): Promise<ReportDraft | null> {
    return this.stored ? structuredClone(this.stored) : null; // copies, so callers cannot change what is stored
  }

  async save(draft: ReportDraft): Promise<void> {
    this.stored = structuredClone(draft);
  }

  async clear(): Promise<void> {
    this.stored = null;
  }
}
