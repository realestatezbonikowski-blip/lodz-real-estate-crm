import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PasswordForm } from "@/features/team/components";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ustaw hasło" };
export const dynamic = "force-dynamic";

// Reached from the invitation link after /admin/auth/confirm has verified the one-time token.
export default async function SetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/admin/login?error=invite");
  return (
    <main id="content" className="wrap grid min-h-screen content-center py-12">
      <div className="mx-auto w-full max-w-sm">
        <p className="eyebrow">Panel administracyjny</p>
        <h1 className="display mt-3 text-4xl">Ustaw hasło</h1>
        <p className="mt-3 text-muted">Zaproszenie zostało przyjęte. Wybierz hasło, którego użyjesz do logowania do CRM.</p>
        <PasswordForm />
      </div>
    </main>
  );
}
