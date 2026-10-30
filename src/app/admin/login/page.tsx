import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/features/crm/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Logowanie" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid: "Nieprawidłowy e-mail lub hasło.",
  rate: "Zbyt wiele prób logowania. Spróbuj ponownie za kilka minut.",
  "no-access": "To konto nie ma dostępu do panelu. Skontaktuj się z właścicielem.",
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
          <p role="alert" className="mt-6 text-sm text-accent">
            Brak konfiguracji Supabase (NEXT_PUBLIC_SUPABASE_URL i klucz publiczny). Panel jest niedostępny.
          </p>
        )}

        {signedIn && !active ? (
          <div className="mt-8 grid gap-4">
            <p role="alert" className="text-sm text-accent">{ERRORS["no-access"]}</p>
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
              {error && ERRORS[error] && <p role="alert" className="text-sm text-accent">{ERRORS[error]}</p>}
              <button className="btn btn-primary">Zaloguj</button>
            </form>
          )
        )}
      </div>
    </main>
  );
}
