import { CalendarCheck, CircleCheck, CircleDot, CircleX, PhoneCall, PhoneOff, Star, type LucideIcon } from "lucide-react";
import type { LeadStatus } from "../schema";

// Colour is never the only signal: every status has its own icon and always prints its label.
// "New" is informational (not the brand terracotta); only a booked meeting gets the solid treatment.
const STATUS: Record<LeadStatus, { tone: string; Icon: LucideIcon }> = {
  new: { tone: "tone-info", Icon: CircleDot },
  contacted: { tone: "tone-neutral", Icon: PhoneCall },
  interested: { tone: "tone-warning", Icon: Star },
  meeting: { tone: "tone-info badge-solid", Icon: CalendarCheck },
  converted: { tone: "tone-success", Icon: CircleCheck },
  not_interested: { tone: "tone-neutral", Icon: CircleX },
  unreachable: { tone: "tone-neutral", Icon: PhoneOff },
};

/** `label` is the already-translated status name (see labels.ts), so this component stays language-free. */
export function StatusBadge({ status, label }: { status: LeadStatus; label: string }) {
  const { tone, Icon } = STATUS[status];
  return (
    <span className={`badge ${tone}`}>
      <Icon size={14} strokeWidth={2} aria-hidden="true" />
      {label}
    </span>
  );
}
