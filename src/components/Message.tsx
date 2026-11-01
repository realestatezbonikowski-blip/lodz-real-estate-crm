import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

const TONES = {
  error: { Icon: CircleAlert, className: "text-danger", role: "alert" },
  warning: { Icon: TriangleAlert, className: "text-warning", role: "status" },
  success: { Icon: CircleCheck, className: "text-success", role: "status" },
  info: { Icon: Info, className: "text-info", role: "status" },
} as const;

export type MessageTone = keyof typeof TONES;

/** Inline feedback: tone colour + icon + text (never colour alone). Errors are announced assertively. */
export function Message({ tone, id, className = "", children }: {
  tone: MessageTone; id?: string; className?: string; children: React.ReactNode;
}) {
  const { Icon, className: toneClass, role } = TONES[tone];
  return (
    <p id={id} role={role} className={`message ${toneClass} ${className}`.trim()}>
      <Icon size={16} strokeWidth={2} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
