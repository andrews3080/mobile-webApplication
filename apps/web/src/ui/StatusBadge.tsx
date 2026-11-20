import { describeStatus } from "@asaase-ani/shared";

// The status in words, with a matching colour. Colour is never the only signal.
export function StatusBadge({ status }: { status: string }) {
  const info = describeStatus(status);
  return <span className={`badge badge-${info.tone}`}>{info.label}</span>;
}
