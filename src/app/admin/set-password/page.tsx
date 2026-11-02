import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminPrefs } from "@/features/admin-prefs/controls";
import { getT } from "@/features/admin-prefs/server";
import { PasswordForm } from "@/features/team/components";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("pw.title") };
}
export const dynamic = "force-dynamic";

// Reached from the invitation link after /admin/auth/confirm has verified the one-time token.
export default async function SetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/admin/login?error=invite");
  const { t } = await getT();
  return (
    <main id="content" className="wrap relative grid min-h-dvh content-center py-12">
      <div className="absolute right-4 top-4"><AdminPrefs /></div>
      <div className="mx-auto w-full max-w-sm">
        <p className="eyebrow">{t("common.panel")}</p>
        <h1 className="display mt-3 text-4xl">{t("pw.title")}</h1>
        <p className="mt-3 text-muted">{t("pw.intro")}</p>
        <PasswordForm />
      </div>
    </main>
  );
}
