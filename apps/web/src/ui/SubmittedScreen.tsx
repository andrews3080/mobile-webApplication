import { useEffect, useRef, useState } from "react";
import type { SubmitReceipt } from "../core/ports";
import { Icon } from "./Icon";

interface Props {
  receipt: SubmitReceipt;
  onAnother(): void;
}

// The reporter's ONLY way back to their report is this code, so it is big, copyable and explained.
export function SubmittedScreen({ receipt, onAnother }: Props) {
  const [copied, setCopied] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), []);

  const canCopy = typeof navigator !== "undefined" && navigator.clipboard !== undefined;

  return (
    <section className="card submitted">
      <span className="success-mark">
        <Icon name="check" size={32} />
      </span>
      <h1 tabIndex={-1} ref={heading}>
        {receipt.alreadyReceived ? "We already have your report" : "Thank you. Your report was sent."}
      </h1>

      <div className="code-box">
        <p className="code-label">Your tracking code</p>
        <p className="code" data-testid="reference">
          {receipt.reference}
        </p>
        {canCopy && (
          <button
            type="button"
            className="secondary with-icon"
            onClick={() =>
              void navigator.clipboard
                .writeText(receipt.reference)
                .then(() => setCopied(true))
                .catch(() => setCopied(false))
            }
          >
            {copied && <Icon name="check" />}
            {copied ? "Copied" : "Copy code"}
          </button>
        )}
      </div>

      <p className="safety">
        <Icon name="alert" size={22} />
        <span>
          <strong>Write this code down or take a screenshot.</strong> It is the only way to check on your report, and we
          cannot find it for you later.
        </span>
      </p>

      <button type="button" onClick={onAnother}>
        Make another report
      </button>
      <a href="#/track" className="button secondary">
        Check a report
      </a>
    </section>
  );
}
