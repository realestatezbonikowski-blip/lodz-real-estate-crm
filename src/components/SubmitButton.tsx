"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button for a plain <form action={serverAction}>. While the action runs it is disabled (a second
 * tap cannot send the request twice, which matters on a slow phone connection and for the login limiter)
 * and shows `pendingLabel`. The progress is also announced to screen readers through a polite status
 * region next to the button, because a changing button label alone is not reliably read out.
 * For forms built with useActionState the form already knows `pending`; this is for the ones that do not.
 */
export function SubmitButton({ children, pendingLabel, className = "btn btn-primary", ...rest }: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type" | "disabled" | "children">) {
  const { pending } = useFormStatus();
  return (
    <>
      <button {...rest} type="submit" className={className} disabled={pending} aria-busy={pending || undefined} data-pending={pending || undefined}>
        {pending ? pendingLabel : children}
      </button>
      <span role="status" className="sr-only">{pending ? pendingLabel : ""}</span>
    </>
  );
}
