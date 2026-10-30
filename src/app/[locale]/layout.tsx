import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { routing } from "@/i18n/routing";
import { display, inter } from "@/lib/fonts";
import "../globals.css";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });
  // Not indexable until launch: the content is placeholder (docs/content-needed.md). Set
  // NEXT_PUBLIC_ALLOW_INDEXING=true only after the launch gate has been cleared.
  return {
    title: { default: t("title"), template: `%s | ${t("title")}` },
    description: t("description"),
    robots: process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true" ? undefined : { index: false, follow: false },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const a11y = await getTranslations("A11y");

  return (
    <html lang={locale} className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-screen antialiased">
        <NextIntlClientProvider>
          <a
            href="#content"
            className="absolute left-3 top-3 z-50 -translate-y-20 bg-ink px-4 py-3 text-paper focus:translate-y-0"
          >
            {a11y("skipToContent")}
          </a>
          <SiteHeader />
          {children}
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
