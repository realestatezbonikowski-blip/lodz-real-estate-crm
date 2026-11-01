// Pure helpers for the enrolment screen: what is safe to display from the Auth server's response.
// The QR code and the manual key are secrets of the owner's own session: they are shown once to
// that user, kept in React state only, never logged, and the page is served with Cache-Control:
// no-store (set by the proxy for everything under /admin).

/**
 * The Auth server returns the QR code as SVG markup (or as a ready-made data URI). It is only ever
 * placed in an <img src>, where an SVG cannot run scripts, and never injected into the DOM as markup.
 * Anything that is not an SVG image of reasonable size is rejected; the manual key still works.
 */
export function qrImageSrc(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 30_000) return null;
  const text = raw.trimStart();
  let src: string;
  if (/^data:image\/svg\+xml/i.test(text)) src = text;
  else if (/^<svg[\s>]/i.test(text)) src = "data:image/svg+xml;utf-8," + encodeURIComponent(raw);
  else return null;
  // Belt and braces: an <img> would not execute these, but nothing legitimate contains them.
  if (/<script|javascript:|onload\s*=|onerror\s*=|<foreignObject/i.test(decodeURIComponentSafe(src))) return null;
  return src;
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** The otpauth:// link lets a phone open the authenticator directly. Only a TOTP link is accepted. */
export function otpLink(raw: unknown): string | null {
  return typeof raw === "string" && raw.length <= 600 && /^otpauth:\/\/totp\/[^\s]+$/.test(raw) ? raw : null;
}

/** Groups the secret in fours for reading aloud / typing: "ABCD EFGH ...". Returns null for anything that is not base32. */
export function formatSecret(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z2-7]{16,128}$/.test(s)) return null;
  return s.match(/.{1,4}/g)!.join(" ");
}

/** A friendly name must be unique per user, so the default carries the date and time. */
export function factorName(input: unknown, now: Date = new Date()): string {
  const cleaned = typeof input === "string" ? input.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40) : "";
  if (cleaned) return cleaned;
  const p = (n: number) => String(n).padStart(2, "0");
  return `Aplikacja ${now.getUTCFullYear()}-${p(now.getUTCMonth() + 1)}-${p(now.getUTCDate())} ${p(now.getUTCHours())}:${p(now.getUTCMinutes())}`;
}
