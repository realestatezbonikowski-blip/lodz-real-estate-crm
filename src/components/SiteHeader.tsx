import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { SiteNav } from "./SiteNav";

export async function SiteHeader() {
  const t = await getTranslations("Nav");
  const a11y = await getTranslations("A11y");
  return (
    <header className="surface-night sticky top-0 z-40 border-b border-border bg-paper/92 backdrop-blur-sm">
      <div className="wrap flex min-h-16 items-center justify-between gap-4">
        <Link href="/" className="display min-w-0 truncate text-xl tracking-tight sm:text-2xl">
          {t("brandPlaceholder")}
        </Link>
        <div className="flex shrink-0 items-center gap-1 md:gap-8">
          <SiteNav
            items={[
              { href: "/projects", label: t("projects") },
              { href: "/contact", label: t("contact") },
            ]}
            navLabel={t("label")}
            openLabel={a11y("openMenu")}
            closeLabel={a11y("closeMenu")}
          />
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
