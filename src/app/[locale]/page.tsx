import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ApartmentExplorer } from "@/components/concept/ApartmentExplorer";
import { ElevationDrawing } from "@/components/concept/ElevationDrawing";
import { FinanceBar } from "@/components/concept/FinanceBar";
import { HeroSequence } from "@/components/concept/HeroSequence";
import { IsoLocation } from "@/components/concept/IsoLocation";
import { SAMPLE_APARTMENTS, SAMPLE_FLOORS } from "@/features/apartments/data";
import { Link } from "@/i18n/navigation";

// Radomska 5 concept home, "Graphite & Light". Sections, in order of the story:
//   hero (scroll-linked walkthrough) -> architecture -> gallery -> financing concept -> apartments
//   -> interior -> location -> enquiry.
// Everything shown is a supplied concept visualisation (always labelled), an address, an explicitly
// provisional statement, or clearly labelled SAMPLE data. Nothing states a price, availability, date,
// guarantee or neighbourhood claim.

const H2 = "display text-[clamp(2.5rem,6vw,5.5rem)]";
const step = (i: number) => ({ "--i": i }) as React.CSSProperties;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as never);
  const t = await getTranslations("Concept");

  const aptLabels = {
    levels: t("apartments.levels"), all: t("apartments.all"), level: t("apartments.level"), roomsFilter: t("apartments.roomsFilter"),
    roomsAny: t("apartments.roomsAny"), rooms: t("apartments.rooms"), area: t("apartments.area"), floor: t("apartments.floor"),
    unit: t("apartments.unit"), priceLabel: t("apartments.priceLabel"), pending: t("apartments.pending"), example: t("apartments.example"),
    // The ICU placeholders are filled in by the client component, so read the raw template.
    showing: t.raw("apartments.showing") as string, none: t("apartments.none"), sqm: t("apartments.sqm"),
  };
  const points = ["p1", "p2", "p3", "p4"] as const;

  return (
    <main id="content">
      {/* 1. Cinematic hero: scroll-linked frame sequence from the supplied walkthrough. */}
      <HeroSequence
        region={t("hero.region")}
        eyebrow={t("hero.eyebrow")}
        title={t("hero.title")}
        subtitle={t("hero.subtitle")}
        lead={t("hero.lead")}
        ctaApartments={t("hero.ctaApartments")}
        ctaFinancing={t("hero.ctaFinancing")}
        scroll={t("hero.scroll")}
        poster={t("hero.poster")}
        disclaimer={t("hero.disclaimer")}
        beat={t("hero.beat")}
        end={t("hero.end")}
        stages={[t("hero.stages.facade"), t("hero.stages.entrance"), t("hero.stages.lobby")]}
      />

      {/* 2. Architecture and overview: continues straight from the dark end of the hero. */}
      <section id="project" className="surface-night overflow-hidden">
        <div className="wrap grid gap-12 pb-20 pt-16 lg:grid-cols-12 lg:pb-32 lg:pt-24">
          <div className="lg:col-span-7">
            <p className="eyebrow mark lift">{t("concept.eyebrow")}</p>
            <h2 className={`${H2} lift mt-6`} style={step(1)}>{t("concept.title")}</h2>
            <p className="lift mt-8 max-w-xl text-lg text-muted" style={step(2)}>{t("concept.body")}</p>
          </div>
          <div className="relative lg:col-span-4 lg:col-start-9">
            <ElevationDrawing label={t("concept.drawing")} className="float-y mx-auto h-auto w-full max-w-sm" />
          </div>

          <dl className="lift grid border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-border lg:col-span-12 [&>div]:py-8 sm:[&>div]:px-8 sm:[&>div:first-child]:pl-0">
            <div>
              <dt className="eyebrow">{t("concept.address")}</dt>
              <dd className="display mt-3 text-3xl leading-tight sm:text-4xl">{t("concept.addressValue")}</dd>
            </div>
            <div>
              <dt className="eyebrow">{t("concept.scale")}</dt>
              <dd className="mt-3">
                <span className="display text-6xl leading-none text-accent">{t("concept.scaleValue")}</span>
                <span className="mt-2 block text-sm text-muted">{t("concept.scaleUnit")}</span>
              </dd>
            </div>
            <div>
              <dt className="eyebrow">{t("concept.stage")}</dt>
              <dd className="mt-3">
                <span className="display text-5xl leading-none sm:text-6xl">{t("concept.stageValue")}</span>
                <span className="mt-2 block text-sm text-muted">{t("concept.stageUnit")}</span>
              </dd>
            </div>
          </dl>
          <p className="text-sm text-muted lg:col-span-12">{t("concept.note")}</p>
        </div>
      </section>

      {/* 3. Gallery: one wide frontal view, then a balanced pair. The white facades sit on the light surface. */}
      <section className="bg-paper">
        <div className="wrap py-20 lg:py-32">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-8">
              <p className="eyebrow mark lift">{t("gallery.eyebrow")}</p>
              <h2 className={`${H2} lift mt-6`} style={step(1)}>{t("gallery.title")}</h2>
            </div>
            <p className="lift max-w-sm text-sm text-muted lg:col-span-4 lg:col-start-9" style={step(2)}>{t("gallery.note")}</p>
          </div>

          <figure className="mt-14">
            <div className="frame aspect-[4/3] sm:aspect-[6/5]">
              <Image src="/concept/exterior-front.jpg" fill sizes="(min-width: 1152px) 1088px, 100vw" alt={t("gallery.frontAlt")} className="parallax object-[50%_30%]" style={{ "--drift": "2%", "--zoom": 1.05 } as React.CSSProperties} />
            </div>
            <figcaption className="cap"><span>01 — {t("gallery.front")}</span><span>{t("gallery.kind")}</span></figcaption>
          </figure>

          <div className="mt-12 grid gap-x-8 gap-y-12 lg:grid-cols-12">
            <figure className="lg:col-span-7">
              <div className="frame aspect-[4/3] lg:aspect-auto lg:h-[36rem]">
                <Image src="/concept/exterior-angle-1.jpg" fill sizes="(min-width: 1152px) 640px, 100vw" alt={t("gallery.angle1Alt")} className="parallax object-[50%_55%]" style={{ "--drift": "2%", "--zoom": 1.06 } as React.CSSProperties} />
              </div>
              <figcaption className="cap"><span>02 — {t("gallery.angle1")}</span><span>{t("gallery.kind")}</span></figcaption>
            </figure>
            <figure className="lg:col-span-5">
              <div className="frame aspect-[4/3] lg:aspect-auto lg:h-[36rem]">
                <Image src="/concept/exterior-angle-2.jpg" fill sizes="(min-width: 1152px) 460px, 100vw" alt={t("gallery.angle2Alt")} className="parallax object-[50%_28%]" style={{ "--drift": "2%", "--zoom": 1.06 } as React.CSSProperties} />
              </div>
              <figcaption className="cap"><span>03 — {t("gallery.angle2")}</span><span>{t("gallery.kind")}</span></figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* 4. Financing concept: the proposed model, clearly marked as unconfirmed. */}
      <section id="financing" className="surface-night relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[60%] opacity-70" style={{ background: "radial-gradient(60% 80% at 80% 0%, rgb(210 164 106 / 0.16), transparent 70%)" }} />
        <div className="wrap relative py-20 lg:py-32">
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="eyebrow mark lift">{t("finance.eyebrow")}</p>
              <h2 className={`${H2} lift mt-6`} style={step(1)}>{t("finance.title")}</h2>
            </div>
            <div className="lift lg:col-span-4 lg:col-start-9 lg:self-end" style={step(2)}>
              <p className="text-muted">{t("finance.lead")}</p>
            </div>
          </div>

          <div className="mt-16 grid gap-12 lg:grid-cols-12 lg:gap-8">
            <div className="lift lg:col-span-6">
              <p className="fig text-[clamp(7rem,20vw,16rem)] text-accent">{t("finance.initialValue")}</p>
              <p className="mt-4 border-t border-accent pt-4 text-lg">{t("finance.initial")}</p>
            </div>
            <div className="lift lg:col-span-6" style={step(2)}>
              <p className="flex flex-wrap items-end gap-x-4 gap-y-2 leading-none">
                <span className="text-lg text-muted">{t("finance.termPrefix")}</span>
                <span className="fig text-[clamp(7rem,20vw,16rem)]">{t("finance.termValue")}</span>
                <span className="display pb-3 text-[clamp(2rem,5vw,3.5rem)] leading-none">{t("finance.termUnit")}</span>
              </p>
              <p className="mt-4 border-t border-border pt-4 text-lg">{t("finance.term")}</p>
            </div>
          </div>

          <div className="mt-16">
            <FinanceBar label={t("finance.barLabel")} initial={t("finance.barInitial")} rest={t("finance.barRest")} axis={t("finance.axisYears")} />
          </div>

          <div className="mt-16 grid gap-10 lg:grid-cols-12">
            <ul className="grid border-y border-border [&>li+li]:border-t [&>li+li]:border-border lg:col-span-7">
              {points.map((p, i) => (
                <li key={p} className="lift grid grid-cols-[2.5rem_1fr] items-baseline gap-3 py-4" style={step(i)}>
                  <span className="display lining text-2xl text-accent">0{i + 1}</span>
                  <span className={p === "p4" ? "text-muted" : ""}>{t(`finance.${p}`)}</span>
                </li>
              ))}
            </ul>
            <div className="lg:col-span-4 lg:col-start-9">
              <p className="tag !border-accent !text-accent normal-case tracking-normal">{t("finance.badge")}</p>
              <p className="mt-6">
                <Link href="/contact" className="btn btn-primary">{t("finance.cta")}</Link>
              </p>
              <p className="mt-6 text-[0.8125rem] leading-relaxed text-muted">{t("finance.fine")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Apartments: dimensional cards with clearly labelled SAMPLE data (src/features/apartments/data.ts). */}
      <section id="apartments" className="bg-paper">
        <div className="wrap py-20 lg:py-32">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <p className="eyebrow mark lift">{t("apartments.eyebrow")}</p>
              <h2 className={`${H2} lift mt-6`} style={step(1)}>{t("apartments.title")}</h2>
            </div>
            <p className="lift max-w-md text-muted lg:col-span-4 lg:col-start-9" style={step(2)}>{t("apartments.lead")}</p>
          </div>
          <p className="mt-10 border-l-2 border-accent bg-paper-deep px-5 py-4 text-sm font-medium" role="note">{t("apartments.sample")}</p>
          <div className="mt-12">
            <ApartmentExplorer apartments={SAMPLE_APARTMENTS} floors={SAMPLE_FLOORS} locale={locale} labels={aptLabels} />
          </div>
        </div>
      </section>

      {/* 6. Interior: the destination of the hero sequence, shown whole and uncropped. */}
      <section className="surface-night overflow-hidden">
        <div className="wrap grid items-center gap-12 py-20 lg:grid-cols-12 lg:gap-16 lg:py-32">
          <figure className="lg:col-span-6">
            <div className="frame aspect-[3/4]">
              <Image src="/concept/lobby-interior.jpg" fill sizes="(min-width: 1152px) 540px, 100vw" alt={t("interior.alt")} className="parallax" style={{ "--drift": "2%", "--zoom": 1.05 } as React.CSSProperties} />
            </div>
          </figure>
          <div className="lg:col-span-5 lg:col-start-8">
            <p className="eyebrow mark lift">{t("interior.eyebrow")}</p>
            <h2 className={`${H2} lift mt-6`} style={step(1)}>{t("interior.title")}</h2>
            <p className="lift mt-6 max-w-md text-muted" style={step(2)}>{t("interior.body")}</p>
            <p className="mt-6"><span className="tag">{t("interior.badge")}</span></p>
          </div>
        </div>
      </section>

      {/* 7. Location: a conceptual isometric illustration, explicitly not a map. */}
      <section id="location" className="surface-slate overflow-hidden">
        <div className="wrap grid items-center gap-12 py-20 lg:grid-cols-12 lg:py-32">
          <div className="lg:col-span-5">
            <p className="eyebrow mark lift">{t("location.eyebrow")}</p>
            <h2 className="display lift mt-6 text-balance text-[clamp(2rem,3.6vw,3.25rem)]" style={step(1)}>{t("location.title")}</h2>
            <p className="lift mt-6 text-muted" style={step(2)}>{t("location.body")}</p>
            <p className="mt-6"><span className="tag">{t("location.badge")}</span></p>
          </div>
          <div className="lg:col-span-7">
            <IsoLocation label={t("location.illustration")} building={t("location.legendBuilding")} context={t("location.legendContext")} />
          </div>
        </div>
      </section>

      {/* 8. Enquiry: points to the existing contact route and its (unchanged) lead form. */}
      <section className="surface-night border-t border-border">
        <div className="wrap flex flex-col items-start justify-between gap-10 py-20 md:flex-row md:items-end lg:py-28">
          <div className="max-w-2xl">
            <p className="eyebrow mark lift">{t("cta.eyebrow")}</p>
            <h2 className={`${H2} lift mt-6`} style={step(1)}>{t("cta.title")}</h2>
            <p className="lift mt-6 text-muted" style={step(2)}>{t("cta.body")}</p>
          </div>
          <Link href="/contact" className="btn btn-primary">{t("cta.link")}</Link>
        </div>
      </section>
    </main>
  );
}
