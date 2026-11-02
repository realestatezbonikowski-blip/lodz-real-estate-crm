// Shared shapes for the MFA server actions and their client forms (a "use server" module may only
// export async functions, so the types live here).
export type MfaResult = { ok: true; message: string } | { ok: false; message: string } | null;

export type EnrolState =
  | { step: "idle" }
  | { step: "error"; message: string }
  | { step: "scan"; factorId: string; qrSrc: string | null; secret: string | null; otpUri: string | null };
