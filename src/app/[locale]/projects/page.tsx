import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArchitecturalMotif } from "@/components/ArchitecturalMotif";
import { Link } from "@/i18n/navigation";
import { projects } from "@/features/projects/data";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as never, namespace: "Projects" });
  return { title: t("title") };
}

export default async function ProjectsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as never);
  const t = await getTranslations("Projects");
  const home = await getTranslations("Home");

  return (
    <main id="content" className="wrap py-12 lg:py-20">
      <h1 className="display text-5xl sm:text-6xl">{t("title")}</h1>
      <p className="mt-4 max-w-xl text-muted">{t("intro")}</p>

      <ul className="mt-12 grid gap-8 md:grid-cols-2">
        {projects.map((p) => (
          <li key={p.slug} className="reveal">
            <Link href={`/projects/${p.slug}`} className="card card-lift group block overflow-hidden">
              <div className="aspect-[4/3] overflow-hidden border-b border-border">
                <ArchitecturalMotif label={home("visualLabel")} className="h-full w-full" />
              </div>
              <div className="p-5">
                <p className="flex flex-wrap gap-2">
                  {p.provisional && <span className="tag">{t("provisional")}</span>}
                  <span className="tag">{t(`status.${p.status}`)}</span>
                </p>
                <h2 className="display mt-4 text-3xl">{t(`items.${p.slug}.name` as never)}</h2>
                <p className="mt-2 text-muted">{t(`items.${p.slug}.summary` as never)}</p>
                <span className="link mt-4 inline-block">{t("details")}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-muted">{home("visualCaption")}</p>
    </main>
  );
}
