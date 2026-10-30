import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LeadForm } from "@/features/leads/components/LeadForm";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as never, namespace: "Contact" });
  return { title: t("title") };
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as never);
  const t = await getTranslations("Contact");
  const placeholder = await getTranslations("Placeholder");

  const rows = ["address", "phone", "email", "hours"] as const;

  return (
    <main id="content" className="wrap py-12 lg:py-20">
      <h1 className="display text-5xl sm:text-6xl">{t("title")}</h1>
      <p className="mt-4 max-w-xl text-muted">{t("intro")}</p>

      <div className="mt-12 grid gap-12 lg:grid-cols-12">
        <section className="lg:col-span-5" aria-labelledby="details">
          <h2 id="details" className="eyebrow">{t("detailsTitle")}</h2>
          <dl className="mt-4 grid gap-px bg-border">
            {rows.map((r) => (
              <div key={r} className="bg-paper py-3">
                <dt className="text-sm text-muted">{t(r)}</dt>
                <dd>{t("pending")}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4"><span className="tag">{placeholder("badge")}</span></p>
        </section>
        <section className="lg:col-span-6 lg:col-start-7" aria-labelledby="form">
          <h2 id="form" className="eyebrow mb-4">{t("formTitle")}</h2>
          <LeadForm />
        </section>
      </div>
    </main>
  );
}
