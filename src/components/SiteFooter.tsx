import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-muted">
        <p>{t("companyPlaceholder")}</p>
        <p>{t("legalPlaceholder")}</p>
      </div>
    </footer>
  );
}
