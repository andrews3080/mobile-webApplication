import { useCallback, useEffect, useState } from "react";
import type { OfficerApi, OfficerReportSummary } from "@asaase-ani/shared";
import { categoryLabel, describeStatus } from "@asaase-ani/shared";
import { formatDate } from "@asaase-ani/shared";
import { StatusBadge } from "../StatusBadge";
import { isSessionEnded, officerErrorMessage } from "@asaase-ani/shared";

interface Props {
  api: OfficerApi;
  token: string;
  onOpen(code: string): void;
  filter: string | null; // null = all. Kept by the parent, so it survives opening a report and coming back
  onFilter(status: string | null): void;
  onSessionEnded(): void;
}

// Work order: what needs attention first
const STATUS_ORDER = ["received", "under_review", "more_information_requested", "verified", "rejected", "referred_for_action", "closed"];

export function ReportList({ api, token, onOpen, onSessionEnded, filter: chosenFilter, onFilter }: Props) {
  const [reports, setReports] = useState<OfficerReportSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReports(await api.listReports(token));
      setLoadedAt(new Date());
    } catch (failure) {
      if (isSessionEnded(failure)) onSessionEnded();
      else setError(officerErrorMessage(failure));
    } finally {
      setLoading(false);
    }
  }, [api, token, onSessionEnded]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = new Map<string, number>();
  for (const report of reports ?? []) counts.set(report.status, (counts.get(report.status) ?? 0) + 1);
  const statuses = [...STATUS_ORDER.filter((s) => counts.has(s)), ...[...counts.keys()].filter((s) => !STATUS_ORDER.includes(s))];
  // A status can disappear after a refresh; then show everything rather than an empty list
  const filter = chosenFilter !== null && counts.has(chosenFilter) ? chosenFilter : null;
  const shown = (reports ?? []).filter((report) => filter === null || report.status === filter);

  const chip = (value: string | null, label: string, count: number) => (
    <button
      key={value ?? "all"}
      type="button"
      className="chip"
      aria-pressed={filter === value}
      onClick={() => onFilter(value)}
    >
      {label} <span className="chip-count">{count}</span>
    </button>
  );

  return (
    <div className="officer-list">
      <div className="list-head">
        <h1>Reports in your areas</h1>
        <div className="refresh">
          <button type="button" className="secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
          {loadedAt && <span className="note">Updated {formatDate(loadedAt.toISOString())}</span>}
        </div>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {reports === null && !error && <p role="status">Loading reports…</p>}

      {reports !== null && (
        <>
          {reports.length > 0 && (
            <div className="chips" role="group" aria-label="Show reports by status">
              {chip(null, "All", reports.length)}
              {statuses.map((status) => chip(status, describeStatus(status).label, counts.get(status) ?? 0))}
            </div>
          )}

          {reports.length === 0 ? (
            <p className="card empty">No reports in your areas yet.</p>
          ) : (
            <ul className="report-rows" aria-label={`${shown.length} reports`}>
              {shown.map((report) => (
                <li key={report.reference}>
                  <button type="button" className="report-row" onClick={() => onOpen(report.reference)}>
                    <span className="row-code">{report.reference}</span>
                    <StatusBadge status={report.status} />
                    <span className="row-what">{categoryLabel(report.category)}</span>
                    <span className="row-where">{report.area}</span>
                    <span className="row-when">{formatDate(report.submittedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
