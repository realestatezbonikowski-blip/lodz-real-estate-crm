import { setRequestLocale, getTranslations } from "next-intl/server";
import { HeroVisual } from "@/components/HeroVisual";
import { FactList } from "@/components/ProjectParts";
import { getProject } from "@/features/projects/data";
import { Link } from "@/i18n/navigation";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as never);
  const t = await getTranslations("Home");
  const p = await getTranslations("Projects");
  const placeholder = await getTranslations("Placeholder");
  const featured = getProject("rodomska");

  return (
    <main id="content">
      {/* Hero. The headline is static (it is the LCP element); secondary items rise in once. */}
      <section className="wrap grid items-end gap-10 pb-16 pt-10 lg:grid-cols-12 lg:pb-24 lg:pt-16">
        <div className="lg:col-span-7">
          <p className="eyebrow rise">{t("eyebrow")}</p>
          <h1 className="display mt-5 text-[clamp(3rem,8.5vw,7rem)]">{t("heading")}</h1>
          <p className="rise mt-8 max-w-xl text-lg text-muted" style={{ "--delay": "120ms" } as React.CSSProperties}>
            {t("lead")}
          </p>
          <div className="rise mt-10 flex flex-wrap gap-3" style={{ "--delay": "220ms" } as React.CSSProperties}>
            <Link href="/projects/rodomska" className="btn btn-primary">{t("ctaProject")}</Link>
            <Link href="/contact" className="btn btn-ghost">{t("ctaContact")}</Link>
          </div>
        </div>
        <div className="lg:col-span-5">
          <HeroVisual label={t("visualLabel")} caption={t("visualCaption")} />
        </div>
      </section>

      {/* Developer identity: placeholder until approved content is supplied. */}
      <section className="border-t border-border">
        <div className="wrap grid gap-8 py-16 lg:grid-cols-12 lg:py-24">
          <div className="reveal lg:col-span-5">
            <p className="eyebrow">{t("identityEyebrow")}</p>
            <h2 className="display mt-4 text-4xl sm:text-5xl">{t("identityTitle")}</h2>
          </div>
          <div className="reveal lg:col-span-6 lg:col-start-7">
            <p className="text-lg text-muted">{t("identityBody")}</p>
            <p className="mt-6"><span className="tag">{placeholder("badge")}</span></p>
          </div>
        </div>
      </section>

      {/* Development overview on a deep-stone panel (the one high-contrast moment). */}
      {featured && (
        <section className="bg-stone text-paper">
          <div className="wrap grid gap-10 py-16 lg:grid-cols-12 lg:py-24">
            <div className="reveal lg:col-span-6">
              <p className="eyebrow text-paper/70">{t("overviewEyebrow")}</p>
              <h2 className="display mt-4 text-[clamp(3rem,7vw,5.5rem)]">{p("items.rodomska.name")}</h2>
              <p className="mt-6 max-w-md text-paper/80">{t("overviewBody")}</p>
              <p className="mt-6 flex flex-wrap gap-2">
                <span className="tag border-paper/40 text-paper/80">{p("provisional")}</span>
                <span className="tag border-paper/40 text-paper/80">{p(`status.${featured.status}`)}</span>
              </p>
              <Link href="/projects/rodomska" className="btn mt-10 border-paper text-paper hover:bg-paper hover:text-ink">
                {t("overviewLink")}
              </Link>
            </div>
            <div className="reveal lg:col-span-5 lg:col-start-8">
              <h3 className="eyebrow mb-4 text-paper/70">{t("factsTitle")}</h3>
              <FactList project={featured} dark />
              <p className="mt-4 text-sm text-paper/70">{t("factsNote")}</p>
            </div>
          </div>
        </section>
      )}

      <section className="bg-paper-deep">
        <div className="wrap flex flex-col items-start justify-between gap-6 py-16 md:flex-row md:items-end">
          <div className="reveal max-w-xl">
            <h2 className="display text-4xl sm:text-5xl">{t("contactTitle")}</h2>
            <p className="mt-4 text-muted">{t("contactBody")}</p>
          </div>
          <Link href="/contact" className="btn btn-primary reveal">{t("contactLink")}</Link>
        </div>
      </section>
    </main>
  );
}
