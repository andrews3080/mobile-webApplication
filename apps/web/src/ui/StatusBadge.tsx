import { describeStatus } from "../core/tracking";

// The status in words, with a matching colour. Colour is never the only signal.
export function StatusBadge({ status }: { status: string }) {
  const info = describeStatus(status);
  return <span className={`badge badge-${info.tone}`}>{info.label}</span>;
}
