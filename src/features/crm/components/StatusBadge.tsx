import { STATUS_LABELS } from "../labels";
import type { LeadStatus } from "../schema";

// Colour is never the only signal: the label is always printed.
const TONE: Record<LeadStatus, string> = {
  new: "bg-accent text-white border-accent",
  contacted: "bg-paper-deep border-border",
  interested: "bg-paper-deep border-ink",
  meeting: "bg-ink text-paper border-ink",
  converted: "bg-stone text-paper border-stone",
  not_interested: "border-border text-muted",
  unreachable: "border-border text-muted",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <span className={`inline-block border px-2 py-0.5 text-xs font-medium ${TONE[status]}`}>{STATUS_LABELS[status]}</span>;
}
