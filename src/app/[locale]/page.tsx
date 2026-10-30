import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as never);
  const t = await getTranslations("Home");

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {t("heading")}
      </h1>
      <p className="text-muted">{t("status")}</p>
      <p>
        <Link href="/projects" className="underline underline-offset-4">
          {t("cta")}
        </Link>
      </p>
    </main>
  );
}
