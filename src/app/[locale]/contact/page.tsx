import { getTranslations, setRequestLocale } from "next-intl/server";
import { LeadForm } from "@/features/leads/components/LeadForm";

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as never);
  const t = await getTranslations("Contact");

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-muted">{t("intro")}</p>
      <div className="mt-8">
        <LeadForm />
      </div>
    </main>
  );
}
