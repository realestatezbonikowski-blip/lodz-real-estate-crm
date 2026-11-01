import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const nav = await getTranslations("Nav");
  return (
    <footer className="surface-night border-t border-border bg-paper">
      <div className="wrap grid gap-10 py-12 text-sm md:grid-cols-3">
        <div>
          <p className="display text-2xl">{nav("brandPlaceholder")}</p>
          <h2 className="eyebrow mt-6">{t("companyTitle")}</h2>
          <p className="mt-2 text-muted">{t("companyPlaceholder")}</p>
        </div>
        <div>
          <h2 className="eyebrow">{t("pagesTitle")}</h2>
          <ul className="mt-3 grid gap-1">
            <li><Link href="/" className="inline-flex min-h-11 items-center link">{nav("home")}</Link></li>
            <li><Link href="/projects" className="inline-flex min-h-11 items-center link">{nav("projects")}</Link></li>
            <li><Link href="/contact" className="inline-flex min-h-11 items-center link">{nav("contact")}</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="eyebrow">{t("legalTitle")}</h2>
          <ul className="mt-3 grid gap-1">
            <li><Link href="/privacy" className="inline-flex min-h-11 items-center link">{t("privacy")}</Link></li>
          </ul>
          <p className="mt-2 text-muted">{t("legalPlaceholder")}</p>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="wrap py-4 text-[0.8125rem] text-muted">{t("draftNote")}</p>
      </div>
    </footer>
  );
}
