import type { Metadata } from "next";
import { AdminPrefsProvider } from "@/features/admin-prefs/provider";
import { getPrefs, getT } from "@/features/admin-prefs/server";
import { clientMessages } from "@/features/admin-prefs/translate";
import { inter } from "@/lib/fonts";
import "../globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: { default: t("common.panel"), template: "%s | Panel" },
    robots: { index: false, follow: false },
  };
}

// Texts that client components need. Server components translate on the server and send none of this.
const CLIENT_PREFIXES = ["common.", "leads.general", "prefs.", "nav.", "form.", "status.", "act.", "login.", "pw.", "team.", "mfa.", "err."] as const;

// Theme and language come from cookies read on the server, so the first HTML already has the right
// `data-theme` and `lang`: no flash of the wrong theme and no language swap after hydration.
// No cookie = the previous behaviour (dark, Polish).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { theme, lang } = await getPrefs();
  return (
    <html lang={lang} data-theme={theme} className={`${inter.variable} crm`}>
      <body className="min-h-dvh antialiased">
        <AdminPrefsProvider lang={lang} theme={theme} messages={clientMessages(lang, CLIENT_PREFIXES)}>
          {children}
        </AdminPrefsProvider>
      </body>
    </html>
  );
}
