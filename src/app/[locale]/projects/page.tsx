import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { projects } from "@/features/projects/data";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as never);
  const t = await getTranslations("Projects");

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-muted">{t("intro")}</p>
      <ul className="mt-8 grid gap-4">
        {projects.map((p) => (
          <li key={p.slug} className="rounded-md border border-border p-4">
            {p.isPlaceholder && <p className="text-xs uppercase text-muted">{t("placeholderBadge")}</p>}
            <h2 className="text-xl font-medium">{t(`items.${p.slug}.name` as never)}</h2>
            <p className="text-sm text-muted">{t(`status.${p.status}`)}</p>
            <p className="mt-2">{t(`items.${p.slug}.summary` as never)}</p>
            <Link href={`/projects/${p.slug}`} className="mt-3 inline-block underline underline-offset-4">
              {t("details")}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
