import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LeadForm } from "@/features/leads/components/LeadForm";
import { getProject, projects } from "@/features/projects/data";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => projects.map((p) => ({ locale, slug: p.slug })));
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale as never);
  const project = getProject(slug);
  if (!project) notFound();
  const t = await getTranslations("Projects");

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      {project.isPlaceholder && <p className="text-xs uppercase text-muted">{t("placeholderBadge")}</p>}
      <h1 className="text-3xl font-semibold tracking-tight">{t(`items.${slug}.name` as never)}</h1>
      <p className="mt-1 text-sm text-muted">{t(`status.${project.status}`)}</p>
      <p className="mt-4">{t(`items.${slug}.summary` as never)}</p>

      <section className="mt-10" aria-labelledby="enquiry">
        <h2 id="enquiry" className="text-xl font-medium">{t("enquiryTitle")}</h2>
        <div className="mt-4">
          <LeadForm projectSlug={project.slug} />
        </div>
      </section>
    </main>
  );
}
