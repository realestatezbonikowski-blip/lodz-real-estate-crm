"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LABELS = { pl: "PL", uk: "UA", en: "EN" } as const;
const NAMES = { pl: "Polski", uk: "Українська", en: "English" } as const;

export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const current = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")}>
      <ul className="flex text-sm">
        {routing.locales.map((locale) => (
          <li key={locale}>
            <Link
              href={pathname}
              locale={locale}
              hrefLang={locale}
              lang={locale}
              title={NAMES[locale]}
              aria-label={NAMES[locale]}
              aria-current={locale === current ? "true" : undefined}
              className="inline-flex min-h-11 min-w-10 items-center md:min-w-11 justify-center tracking-wider text-muted aria-[current=true]:font-semibold aria-[current=true]:text-ink aria-[current=true]:underline aria-[current=true]:underline-offset-8 hover:text-ink"
            >
              {LABELS[locale]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
