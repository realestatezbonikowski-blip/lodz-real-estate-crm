import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

// Placeholder page. No legal wording is written here: the real policy is a decision for the data
// controller and their legal adviser (docs/gdpr-open-questions.md). Never indexed in the meantime.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as never, namespace: "Privacy" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as never);
  const t = await getTranslations("Privacy");
  const placeholder = await getTranslations("Placeholder");

  return (
    <main id="content" className="wrap py-12 lg:py-20">
      <h1 className="display text-5xl sm:text-6xl">{t("title")}</h1>
      <p className="mt-6 max-w-xl text-lg text-muted">{t("body")}</p>
      <p className="mt-6"><span className="tag">{placeholder("badge")}</span></p>
    </main>
  );
}
