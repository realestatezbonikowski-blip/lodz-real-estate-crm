import type { Metadata } from "next";
import { Message } from "@/components/Message";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/features/crm/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Logowanie" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid: "Nieprawidłowy e-mail lub hasło.",
  rate: "Zbyt wiele prób logowania. Spróbuj ponownie za kilka minut.",
  unavailable: "Logowanie jest chwilowo niedostępne. Spróbuj ponownie za chwilę.",
  "no-access": "To konto nie ma dostępu do panelu. Skontaktuj się z właścicielem.",
  invite: "Link z zaproszenia jest nieprawidłowy lub wygasł. Poproś właściciela o nowe zaproszenie.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

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
    <main id="content" className="wrap grid min-h-screen content-center py-12">
      <div className="mx-auto w-full max-w-sm">
        <p className="eyebrow">Panel administracyjny</p>
        <h1 className="display mt-3 text-5xl">Logowanie</h1>

        {!configured && (
          <Message tone="error" className="mt-6">
            Brak konfiguracji Supabase (NEXT_PUBLIC_SUPABASE_URL i klucz publiczny). Panel jest niedostępny.
          </Message>
        )}

        {signedIn && !active ? (
          <div className="mt-8 grid gap-4">
            <Message tone="error">{ERRORS["no-access"]}</Message>
            <form action={signOut}><button className="btn btn-ghost">Wyloguj</button></form>
          </div>
        ) : (
          configured && (
            <form action={signIn} className="mt-8 grid gap-5">
              <div>
                <label htmlFor="email" className="mb-1 block text-sm">E-mail</label>
                <input id="email" name="email" type="email" required autoComplete="username" maxLength={254} className="field" />
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-sm">Hasło</label>
                <input id="password" name="password" type="password" required autoComplete="current-password" maxLength={200} className="field" />
              </div>
              {error && ERRORS[error] && <Message tone="error">{ERRORS[error]}</Message>}
              <button className="btn btn-primary">Zaloguj</button>
            </form>
          )
        )}
      </div>
    </main>
  );
}
