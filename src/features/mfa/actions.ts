"use server";

// Server Actions for enrolling, verifying and removing TOTP factors. Every action starts with
// requireMfaSession() (a server-validated session). None reads an application table. Codes are
// never logged or echoed, every failure is a fixed message, and verification attempts go through
// the rate-limited attemptMfaVerify().
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { trustedClientKey } from "@/lib/security/client-ip";
import { createRateLimiter } from "@/lib/security/rate-limit";
import { factorName, formatSecret, otpLink, qrImageSrc } from "./enrol";
import { assessMfaRecency, safeNext } from "./policy";
import { requireMfaSession } from "./session";
import { loadMfaState } from "./state";
import { MESSAGES, type EnrolState, type MfaResult } from "./types";
import { attemptMfaVerify, classifyMfaError, newMfaGuard, type VerifyOutcome } from "./verify";

// Per server process, like the login guard (see src/lib/security/login-guard.ts for its limits).
const mfaGuard = newMfaGuard();
const enrolLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 10, maxKeys: 2000 });

const idSchema = z.string().uuid();
const text = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const REAUTH_MAX_AGE_SECONDS = 5 * 60;

const messageFor = (o: VerifyOutcome) => (o === "rate" ? MESSAGES.rate : o === "unavailable" ? MESSAGES.unavailable : MESSAGES.invalid);

async function verifyFactor(supabase: SupabaseClient, userId: string, factorId: string, code: unknown): Promise<VerifyOutcome> {
  const clientKey = trustedClientKey(await headers(), process.env);
  return attemptMfaVerify(
    {
      guard: mfaGuard,
      verify: async (c) => {
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: c });
        return classifyMfaError(error);
      },
    },
    { userId, code, clientKey },
  );
}

/** Step 1: create a pending TOTP factor and return what the user needs to scan or type. */
export async function startEnrollment(_prev: EnrolState, formData: FormData): Promise<EnrolState> {
  const { supabase, state } = await requireMfaSession();
  if (!enrolLimiter.check(state.userId).allowed) return { step: "error", message: MESSAGES.rate };

  // A previous, never-verified attempt would otherwise pile up (and count towards the factor limit).
  for (const f of state.factors.filter((x) => x.status === "unverified")) await supabase.auth.mfa.unenroll({ factorId: f.id });

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: factorName(text(formData, "name")), issuer: "Panel CRM" });
  if (error || !data) return { step: "error", message: MESSAGES.failed };

  return { step: "scan", factorId: data.id, qrSrc: qrImageSrc(data.totp.qr_code), secret: formatSecret(data.totp.secret), otpUri: otpLink(data.totp.uri) };
}

/** Step 2: prove the app works by entering a code. Success also upgrades this session to aal2. */
export async function confirmEnrollment(factorId: string, _prev: MfaResult, formData: FormData): Promise<MfaResult> {
  const { supabase, state } = await requireMfaSession();
  const target = idSchema.safeParse(factorId).success ? state.factors.find((f) => f.id === factorId) : undefined;
  if (!target || target.status !== "unverified" || target.type !== "totp") return { ok: false, message: MESSAGES.failed };

  const outcome = await verifyFactor(supabase, state.userId, factorId, text(formData, "code"));
  if (outcome !== "ok") return { ok: false, message: messageFor(outcome) };
  revalidatePath("/admin/security");
  return { ok: true, message: "Aplikacja została dodana. Ta sesja jest teraz zweryfikowana drugim składnikiem." };
}

/** Abandons a pending (unverified) enrolment. Needs no code: nothing is protected by it yet. */
export async function cancelEnrollment(factorId: string): Promise<void> {
  const { supabase, state } = await requireMfaSession();
  const target = idSchema.safeParse(factorId).success ? state.factors.find((f) => f.id === factorId) : undefined;
  if (target && target.status === "unverified") await supabase.auth.mfa.unenroll({ factorId });
  revalidatePath("/admin/security");
}

/** The challenge: answer with a code from an enrolled factor, then continue to a validated address. */
export async function challengeFactor(next: string, _prev: MfaResult, formData: FormData): Promise<MfaResult> {
  const { supabase, state } = await requireMfaSession();
  const requested = text(formData, "factorId");
  const factor = state.verifiedTotp.find((f) => f.id === requested) ?? (state.verifiedTotp.length === 1 ? state.verifiedTotp[0] : undefined);
  if (!factor) return { ok: false, message: MESSAGES.failed };

  const outcome = await verifyFactor(supabase, state.userId, factor.id, text(formData, "code"));
  if (outcome !== "ok") return { ok: false, message: messageFor(outcome) };
  redirect(safeNext(next)); // outside any try: redirect() works by throwing
}

/**
 * Removing a verified factor needs: an explicit confirmation, a code from an enrolled factor
 * (re-authentication), and then a server-validated TOTP event from the last 5 minutes. Removing the
 * LAST factor needs a second confirmation. A lost authenticator cannot be bypassed here: with no
 * working factor there is no code to give, which is intended.
 */
export async function removeFactor(factorId: string, _prev: MfaResult, formData: FormData): Promise<MfaResult> {
  const { supabase, state } = await requireMfaSession();
  const target = idSchema.safeParse(factorId).success ? state.factors.find((f) => f.id === factorId) : undefined;
  if (!target) return { ok: false, message: MESSAGES.failed };

  if (text(formData, "confirm") !== "on") return { ok: false, message: "Zaznacz potwierdzenie, aby usunąć aplikację." };
  const verified = state.factors.filter((f) => f.status === "verified");
  if (target.status === "verified" && verified.length === 1 && text(formData, "confirmLast") !== "on") {
    return { ok: false, message: "To jedyna aplikacja. Zaznacz, że rozumiesz skutki jej usunięcia." };
  }

  // Re-authenticate with an enrolled factor (the one being removed, or another one that still works).
  const verifier = state.verifiedTotp.find((f) => f.id === text(formData, "verifyWith")) ?? state.verifiedTotp.find((f) => f.id === factorId);
  if (!verifier) return { ok: false, message: MESSAGES.failed };
  const outcome = await verifyFactor(supabase, state.userId, verifier.id, text(formData, "code"));
  if (outcome !== "ok") return { ok: false, message: messageFor(outcome) };

  // Do not trust the call above alone: require a fresh TOTP event in the server-validated claims.
  const fresh = await loadMfaState(supabase);
  const recent = fresh.signedIn && fresh.currentLevel === "aal2" && assessMfaRecency({ amr: fresh.amr, now: Math.floor(Date.now() / 1000), maxAgeSeconds: REAUTH_MAX_AGE_SECONDS }) === "fresh";
  if (!recent) return { ok: false, message: "Nie udało się potwierdzić weryfikacji. Zaloguj się ponownie i spróbuj jeszcze raz." };

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { ok: false, message: MESSAGES.failed };
  revalidatePath("/admin/security");
  return { ok: true, message: "Aplikacja została usunięta." };
}
