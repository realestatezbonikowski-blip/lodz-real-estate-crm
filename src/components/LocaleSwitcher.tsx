"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LABELS = { pl: "Polski", uk: "Українська", en: "English" } as const;

export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const current = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")}>
      <ul className="flex gap-4 text-sm">
        {routing.locales.map((locale) => (
          <li key={locale}>
            <Link
              href={pathname}
              locale={locale}
              hrefLang={locale}
              lang={locale}
              aria-current={locale === current ? "true" : undefined}
              className={
                locale === current
                  ? "font-semibold underline underline-offset-4"
                  : "text-muted hover:text-foreground"
              }
            >
              {LABELS[locale]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
