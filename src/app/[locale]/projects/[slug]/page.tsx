import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArchitecturalMotif } from "@/components/ArchitecturalMotif";
import { FactList, MediaFigure } from "@/components/ProjectParts";
import { LeadForm } from "@/features/leads/components/LeadForm";
import { getProject, projects } from "@/features/projects/data";
import { routing } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => projects.map((p) => ({ locale, slug: p.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!getProject(slug)) return {};
  const t = await getTranslations({ locale: locale as never, namespace: "Projects" });
  return { title: t(`items.${slug}.name` as never) };
}

export default async function ProjectPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale as never);
  const project = getProject(slug);
  if (!project) notFound();
  const t = await getTranslations("Projects");
  const home = await getTranslations("Home");

  return (
    <main id="content">
      <section className="wrap pb-12 pt-10 lg:pt-16">
        <p className="flex flex-wrap gap-2">
          {project.provisional && <span className="tag">{t("provisional")}</span>}
          <span className="tag">{t(`status.${project.status}`)}</span>
        </p>
        <h1 className="display mt-5 text-[clamp(3rem,9vw,7rem)]">{t(`items.${slug}.name` as never)}</h1>
        <p className="mt-6 max-w-xl text-lg text-muted">{t(`items.${slug}.summary` as never)}</p>
      </section>

      <section className="wrap grid gap-10 pb-16 lg:grid-cols-12">
        <figure className="lg:col-span-7">
          <div className="clip-reveal aspect-[4/3] overflow-hidden border border-border">
            <ArchitecturalMotif label={home("visualLabel")} className="h-full w-full" />
          </div>
          <figcaption className="mt-3 text-[0.8125rem] text-muted">{home("visualCaption")}</figcaption>
        </figure>
        <div className="lg:col-span-5">
          <FactList project={project} />
          <p className="mt-4 text-sm text-muted">{home("factsNote")}</p>
        </div>
      </section>

      <section className="border-t border-border" aria-labelledby="units">
        <div className="wrap py-16">
          <h2 id="units" className="display reveal text-4xl sm:text-5xl">{t("unitsTitle")}</h2>
          <p className="reveal mt-4 max-w-xl text-muted">{t("unitsEmpty")}</p>
        </div>
      </section>

      <section className="border-t border-border" aria-labelledby="media">
        <div className="wrap py-16">
          <h2 id="media" className="display reveal text-4xl sm:text-5xl">{t("mediaTitle")}</h2>
          <p className="reveal mt-4 max-w-xl text-muted">{t("mediaIntro")}</p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {project.media.map((m, i) => (
              <div key={`${m.kind}-${i}`} className="reveal"><MediaFigure item={m} /></div>
            ))}
          </div>
        </div>
      </section>

      <section id="enquiry" className="bg-paper-deep" aria-labelledby="enquiry-title">
        <div className="wrap grid gap-10 py-16 lg:grid-cols-12">
          <h2 id="enquiry-title" className="display text-4xl sm:text-5xl lg:col-span-5">{t("enquiryTitle")}</h2>
          <div className="lg:col-span-6 lg:col-start-7">
            <LeadForm projectSlug={project.slug} />
          </div>
        </div>
      </section>
    </main>
  );
}
