import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";

export async function SiteHeader() {
  const t = await getTranslations("Nav");
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="font-semibold tracking-tight">
          {t("brandPlaceholder")}
        </Link>
        <nav aria-label={t("label")} className="flex gap-5 text-sm">
          <Link href="/projects" className="hover:underline">{t("projects")}</Link>
          <Link href="/contact" className="hover:underline">{t("contact")}</Link>
        </nav>
        <LocaleSwitcher />
      </div>
    </header>
  );
}
