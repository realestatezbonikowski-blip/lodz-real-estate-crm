// Shared shapes for the MFA server actions and their client forms (a "use server" module may only
// export async functions, so the types live here).
export type MfaResult = { ok: true; message: string } | { ok: false; message: string } | null;

export type EnrolState =
  | { step: "idle" }
  | { step: "error"; message: string }
  | { step: "scan"; factorId: string; qrSrc: string | null; secret: string | null; otpUri: string | null };

export const MESSAGES = {
  invalid: "Nieprawidłowy lub wygasły kod. Spróbuj ponownie.",
  rate: "Zbyt wiele prób. Spróbuj ponownie za kilka minut.",
  unavailable: "Weryfikacja jest chwilowo niedostępna. Spróbuj ponownie za chwilę.",
  failed: "Nie udało się wykonać operacji. Spróbuj ponownie.",
} as const;
