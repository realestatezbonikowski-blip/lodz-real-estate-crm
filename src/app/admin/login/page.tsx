import type { Metadata } from "next";
import { Message } from "@/components/Message";
import { SubmitButton } from "@/components/SubmitButton";
import { redirect } from "next/navigation";
import { AdminPrefs } from "@/features/admin-prefs/controls";
import { getT } from "@/features/admin-prefs/server";
import { signIn, signOut } from "@/features/crm/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("login.title") };
}
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { t } = await getT();

  // Fixed messages only: an unknown ?error= value is never rendered.
  const ERRORS: Record<string, string> = {
    invalid: t("login.errInvalid"),
    rate: t("login.errRate"),
    unavailable: t("login.errUnavailable"),
    "no-access": t("login.errNoAccess"),
    invite: t("login.errInvite"),
  };

  let configured = true;
  let signedIn = false;
  let active = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      signedIn = true;
      const { data: p } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle();
      active = Boolean(p?.is_active);
    }
  } catch {
    configured = false;
  }
  if (signedIn && active) redirect("/admin/leads"); // outside the try: redirect() works by throwing

  return (
    <main id="content" className="wrap relative grid min-h-dvh content-center py-12">
      <div className="absolute right-4 top-4"><AdminPrefs /></div>
      <div className="mx-auto w-full max-w-sm">
        <p className="eyebrow">{t("common.panel")}</p>
        <h1 className="display mt-3 text-5xl">{t("login.title")}</h1>

        {!configured && (
          <Message tone="error" className="mt-6">
            {t("login.noConfig")}
          </Message>
        )}

        {signedIn && !active ? (
          <div className="mt-8 grid gap-4">
            <Message tone="error">{ERRORS["no-access"]}</Message>
            <form action={signOut}><SubmitButton className="btn btn-ghost" pendingLabel={t("common.working")}>{t("nav.signOut")}</SubmitButton></form>
          </div>
        ) : (
          configured && (
            <form action={signIn} className="mt-8 grid gap-5">
              <div>
                <label htmlFor="email" className="mb-1 block text-sm">{t("login.email")}</label>
                <input id="email" name="email" type="email" required autoComplete="username" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={254} className="field" />
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-sm">{t("login.password")}</label>
                <input id="password" name="password" type="password" required autoComplete="current-password" autoCapitalize="none" maxLength={200} className="field" />
              </div>
              {error && ERRORS[error] && <Message tone="error">{ERRORS[error]}</Message>}
              <SubmitButton pendingLabel={t("login.submitting")}>{t("login.submit")}</SubmitButton>
            </form>
          )
        )}
      </div>
    </main>
  );
}
