import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ApiError } from "../core/errors";
import type { PublicReportView, TrackApi } from "../core/ports";
import { categoryLabel, checkTrackingCode, describeStatus } from "@asaase-ani/shared";
import { Icon } from "./Icon";

interface Props {
  tracking: TrackApi;
}

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : dateTime.format(date);
};

function lookupFailureMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return "We could not find a report with this code. Check each letter and number and try again.";
  }
  if (error instanceof ApiError && error.kind === "rate_limited") return "Too many tries. Please wait a minute and try again.";
  if (error instanceof ApiError && error.kind === "network") return "We could not reach the server. Check your connection and try again.";
  return "Something went wrong on our side. Please try again in a few minutes.";
}

// Lets an anonymous reporter check their report with the code they were given.
// The code is never put in the address bar or saved on the device: on a shared phone, that would let
// the next person see the report.
export function TrackPage({ tracking }: Props) {
  const [input, setInput] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [report, setReport] = useState<PublicReportView | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (report) resultHeading.current?.focus();
  }, [report]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (checking) return;
    setFailure(null);
    setReport(null);

    const check = checkTrackingCode(input);
    if (!check.ok) {
      setProblem(check.problem);
      inputRef.current?.focus();
      return;
    }
    setProblem(null);
    setInput(check.code); // show it the way it is printed, so mistakes are easier to spot

    setChecking(true);
    try {
      setReport(await tracking.track(check.code));
    } catch (error) {
      setFailure(lookupFailureMessage(error));
    } finally {
      setChecking(false);
    }
  }

  const status = report ? describeStatus(report.status) : null;
  const timeline = report ? [...report.timeline].reverse() : []; // newest first

  return (
    <div className="track">
      <div className="intro">
        <h1>Check a report</h1>
        <p className="lead">Enter the tracking code you got when you sent your report.</p>
      </div>

      <form className="card track-form" onSubmit={(event) => void onSubmit(event)} noValidate aria-busy={checking}>
        <div className="field">
          <label htmlFor="tracking-code">Tracking code</label>
          <p className="hint" id="tracking-code-hint">
            12 letters and numbers, for example <span className="nowrap">ABCD-EFGH-JKMN</span>
          </p>
          <input
            ref={inputRef}
            id="tracking-code"
            className="code-input"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={20}
            value={input}
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? "tracking-code-hint tracking-code-problem" : "tracking-code-hint"}
            onChange={(e) => {
              setInput(e.target.value);
              setProblem(null);
            }}
          />
          {problem && (
            <p className="problem" id="tracking-code-problem">
              {problem}
            </p>
          )}
        </div>
        <button type="submit" className="full-width" disabled={checking}>
          {checking ? "Checking…" : "Check status"}
        </button>
        {failure && (
          <p className="error" role="alert">
            {failure}
          </p>
        )}
      </form>

      {report && status && (
        <section className="card result" aria-labelledby="result-title">
          <h2 id="result-title" tabIndex={-1} ref={resultHeading} className="result-code">
            Report {report.reference}
          </h2>

          <div className={`status status-${status.tone}`}>
            <span className="status-label">{status.label}</span>
            {status.explanation && <p>{status.explanation}</p>}
          </div>

          <dl className="facts">
            <div>
              <dt>What</dt>
              <dd>{categoryLabel(report.category)}</dd>
            </div>
            <div>
              <dt>Where</dt>
              <dd>{report.area}</dd>
            </div>
            <div>
              <dt>Sent</dt>
              <dd>{formatDate(report.submittedAt)}</dd>
            </div>
            <div>
              <dt>Photos</dt>
              <dd>{report.photoCount === 0 ? "None" : report.photoCount}</dd>
            </div>
          </dl>

          <h3>What has happened</h3>
          <ol className="timeline">
            {timeline.map((event, index) => (
              <li key={`${event.status}-${event.at}`} className={index === 0 ? "current" : undefined}>
                <span className="dot" aria-hidden="true">
                  {index === 0 && <Icon name="check" size={14} />}
                </span>
                <span className="timeline-label">{describeStatus(event.status).label}</span>
                <time dateTime={event.at}>{formatDate(event.at)}</time>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
