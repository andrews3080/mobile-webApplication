import { ApiError, formatDate } from "@asaase-ani/shared";
import { useId, useState } from "react";
import type { FormEvent } from "react";
import type { PublicReportView, TrackApi } from "../core/ports";

interface Props {
  tracking: TrackApi;
  report: PublicReportView;
  onUpdated(report: PublicReportView): void;
}

const MAX_ANSWER = 1000; // the API refuses longer

function failureMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) return "This report was just updated. Please check the status again.";
  if (error instanceof ApiError && error.kind === "network") return "We could not reach the server. Your answer is still here; try again.";
  if (error instanceof ApiError && error.kind === "rate_limited") return "Too many tries. Please wait a minute and try again.";
  if (error instanceof ApiError && error.kind === "rejected") return error.message; // e.g. already answered
  return "Something went wrong on our side. Please try again in a few minutes.";
}

// The officer's question, and a way for an anonymous reporter to answer it without giving their identity.
// The answer is never shown back on this public page: only that it was sent.
export function AnswerBox({ tracking, report, onUpdated }: Props) {
  const [answer, setAnswer] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const id = useId();
  const question = report.question;
  if (!question) return null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    if (answer.trim().length < 2) {
      setProblem("Please write your answer.");
      return;
    }
    setProblem(null);
    setFailure(null);
    setSending(true);
    try {
      onUpdated(await tracking.answer(report.reference, answer.trim()));
      setAnswer("");
    } catch (error) {
      setFailure(failureMessage(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="question" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>An officer asked you</h3>
      <blockquote className="question-text">{question.text}</blockquote>
      <p className="note">Asked {formatDate(question.askedAt)}</p>

      {question.answeredAt ? (
        <p className="success" role="status">
          Thank you. Your answer was sent {formatDate(question.answeredAt)}. An officer will continue checking your report.
        </p>
      ) : (
        <form onSubmit={(event) => void onSubmit(event)} noValidate aria-busy={sending}>
          <div className="field">
            <label htmlFor={`${id}-answer`}>Your answer</label>
            <p className="hint" id={`${id}-hint`}>
              Only officers will read it. You do not need to give your name. Describe what you saw, not who did it.
            </p>
            <textarea
              id={`${id}-answer`}
              rows={4}
              maxLength={MAX_ANSWER}
              value={answer}
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? `${id}-hint ${id}-problem` : `${id}-hint`}
              onChange={(e) => {
                setAnswer(e.target.value);
                setProblem(null);
              }}
            />
            {problem && (
              <p className="problem" id={`${id}-problem`}>
                {problem}
              </p>
            )}
          </div>
          <button type="submit" className="full-width" disabled={sending}>
            {sending ? "Sending…" : "Send answer"}
          </button>
          {failure && (
            <p className="error" role="alert">
              {failure}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
