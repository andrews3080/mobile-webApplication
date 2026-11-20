import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { actionsFor, checkReason } from "../../core/officer";
import type { ActionInfo, OfficerApi, OfficerReportView } from "../../core/officer";
import { categoryLabel, describeStatus } from "../../core/tracking";
import { formatDate } from "../format";
import { StatusBadge } from "../StatusBadge";
import { AuthPhoto } from "./AuthPhoto";
import { isConflict, isSessionEnded, officerErrorMessage } from "./officer-errors";

interface Props {
  api: OfficerApi;
  token: string;
  code: string;
  onBack(): void;
  onSessionEnded(): void;
}

const DONE_MESSAGE: Record<string, string> = {
  "start-review": "Review started.",
  verify: "Report confirmed.",
  reject: "Report marked as not confirmed.",
  "request-information": "Marked as needing more information.",
};

export function ReportDetail({ api, token, code, onBack, onSessionEnded }: Props) {
  const [report, setReport] = useState<OfficerReportView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<ActionInfo | null>(null); // an action that needs a written reason
  const [text, setText] = useState("");
  const [textProblem, setTextProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setReport(await api.getReport(token, code));
    } catch (failure) {
      if (isSessionEnded(failure)) onSessionEnded();
      else setLoadError(officerErrorMessage(failure));
    }
  }, [api, token, code, onSessionEnded]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    heading.current?.focus();
  }, [report?.reference]);

  useEffect(() => {
    if (chosen) reasonRef.current?.focus();
  }, [chosen]);

  async function act(action: ActionInfo, reason?: string) {
    setBusy(true);
    setActionError(null);
    setDone(null);
    try {
      await api.review(token, code, action.action, reason);
      setChosen(null);
      setText("");
      setDone(DONE_MESSAGE[action.action] ?? "Saved.");
      await load();
    } catch (failure) {
      if (isSessionEnded(failure)) return onSessionEnded();
      setActionError(officerErrorMessage(failure));
      if (isConflict(failure)) {
        setChosen(null);
        await load(); // show what the other officer changed
      }
    } finally {
      setBusy(false);
    }
  }

  function onConfirm(event: FormEvent) {
    event.preventDefault();
    if (!chosen) return;
    const problem = checkReason(text);
    setTextProblem(problem);
    if (problem) {
      reasonRef.current?.focus();
      return;
    }
    void act(chosen, text.trim());
  }

  const back = (
    <button type="button" className="link back" onClick={onBack}>
      ← Back to all reports
    </button>
  );

  if (!report) {
    return (
      <div className="officer-detail">
        {back}
        {loadError ? (
          <div className="card">
            <p className="error" role="alert">
              {loadError}
            </p>
            <button type="button" className="secondary" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : (
          <p role="status">Loading report…</p>
        )}
      </div>
    );
  }

  const actions = actionsFor(report.status);
  const hasPosition = report.latitude !== null && report.longitude !== null;
  const contact = report.contact;
  const hasContact = Boolean(contact && (contact.name || contact.phone || contact.email));
  const history = [...report.history].reverse(); // newest first

  return (
    <div className="officer-detail">
      {back}

      <div className="detail-head">
        <h1 tabIndex={-1} ref={heading} className="detail-code">
          {report.reference}
        </h1>
        <StatusBadge status={report.status} />
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="card" aria-labelledby="what-title">
            <h2 id="what-title">What was reported</h2>
            <p className="tag">{categoryLabel(report.category)}</p>
            <p className="description">{report.description}</p>
            <dl className="facts">
              <div>
                <dt>Seen</dt>
                <dd>{formatDate(report.observedAt)}</dd>
              </div>
              <div>
                <dt>Sent</dt>
                <dd>{formatDate(report.submittedAt)}</dd>
              </div>
            </dl>
          </section>

          <section className="card" aria-labelledby="where-title">
            <h2 id="where-title">Where</h2>
            <p className="strong">{report.area}</p>
            {hasPosition ? (
              <p>
                Position from the reporter's phone: {report.latitude!.toFixed(5)}, {report.longitude!.toFixed(5)}{" "}
                <a
                  href={`https://www.openstreetmap.org/?mlat=${report.latitude}&mlon=${report.longitude}#map=16/${report.latitude}/${report.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open map
                </a>
              </p>
            ) : (
              <p className="note">The reporter did not share an exact position.</p>
            )}
          </section>

          <section className="card" aria-labelledby="photos-title">
            <h2 id="photos-title">Photos ({report.photoKeys.length})</h2>
            {report.photoKeys.length === 0 ? (
              <p className="note">No photos were sent.</p>
            ) : (
              <ul className="officer-photos">
                {report.photoKeys.map((key, index) => (
                  <li key={key}>
                    <AuthPhoto api={api} token={token} code={report.reference} photoKey={key} alt={`Photo ${index + 1}`} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card" aria-labelledby="contact-title">
            <h2 id="contact-title">Reporter</h2>
            {hasContact && contact ? (
              <dl className="facts">
                {contact.name && (
                  <div>
                    <dt>Name</dt>
                    <dd>{contact.name}</dd>
                  </div>
                )}
                {contact.phone && (
                  <div>
                    <dt>Phone</dt>
                    <dd>{contact.phone}</dd>
                  </div>
                )}
                {contact.email && (
                  <div>
                    <dt>Email</dt>
                    <dd>{contact.email}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="note">The reporter chose to stay anonymous.</p>
            )}
          </section>
        </div>

        <div className="detail-side">
          <section className="card decide" aria-labelledby="decide-title">
            <h2 id="decide-title">Decision</h2>
            {done && (
              <p className="success" role="status">
                {done}
              </p>
            )}
            {actionError && (
              <p className="error" role="alert">
                {actionError}
              </p>
            )}

            {actions.length === 0 ? (
              <p className="note">
                Nothing more to do here. This report is {describeStatus(report.status).label.toLowerCase()}.
              </p>
            ) : chosen ? (
              <form onSubmit={onConfirm} noValidate>
                <div className="field">
                  <label htmlFor="review-text">{chosen.text?.label}</label>
                  <p className="hint" id="review-text-hint">
                    {chosen.text?.hint}
                  </p>
                  <textarea
                    ref={reasonRef}
                    id="review-text"
                    rows={4}
                    maxLength={1000}
                    value={text}
                    aria-invalid={textProblem ? true : undefined}
                    aria-describedby={textProblem ? "review-text-hint review-text-problem" : "review-text-hint"}
                    onChange={(e) => {
                      setText(e.target.value);
                      setTextProblem(null);
                    }}
                  />
                  {textProblem && (
                    <p className="problem" id="review-text-problem">
                      {textProblem}
                    </p>
                  )}
                </div>
                <div className="action-buttons">
                  <button type="submit" className={`tone-${chosen.tone}`} disabled={busy}>
                    {busy ? "Saving…" : chosen.label}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      setChosen(null);
                      setTextProblem(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="action-buttons stacked">
                {actions.map((action) => (
                  <button
                    key={action.action}
                    type="button"
                    className={`tone-${action.tone}`}
                    disabled={busy}
                    onClick={() => {
                      setDone(null);
                      setActionError(null);
                      if (action.text) setChosen(action);
                      else void act(action);
                    }}
                  >
                    {busy && !action.text ? "Saving…" : action.label}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="card" aria-labelledby="history-title">
            <h2 id="history-title">History</h2>
            <ol className="timeline">
              {history.map((event, index) => (
                <li key={`${event.to}-${event.at}`} className={index === 0 ? "current" : undefined}>
                  <span className="dot" aria-hidden="true" />
                  <span className="timeline-label">{describeStatus(event.to).label}</span>
                  <span className="timeline-meta">
                    <time dateTime={event.at}>{formatDate(event.at)}</time> · <span className="nowrap">officer {event.officerId}</span>
                    {event.reason && <span className="timeline-reason">“{event.reason}”</span>}
                  </span>
                </li>
              ))}
              <li className={history.length === 0 ? "current" : undefined}>
                <span className="dot" aria-hidden="true" />
                <span className="timeline-label">Received</span>
                <span className="timeline-meta">
                  <time dateTime={report.submittedAt}>{formatDate(report.submittedAt)}</time>
                </span>
              </li>
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
