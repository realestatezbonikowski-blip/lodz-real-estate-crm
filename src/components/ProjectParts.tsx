import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import type { ProjectEntry, ProjectMedia } from "@/features/projects/data";

/** Key facts. A null value renders as "to be confirmed": nothing is guessed. */
export async function FactList({ project, dark = false }: { project: ProjectEntry; dark?: boolean }) {
  const t = await getTranslations("Projects");
  return (
    <dl className={`grid gap-px ${dark ? "bg-paper/20" : "bg-border"}`}>
      {project.facts.map((f) => (
        <div key={f.id} className={`flex flex-wrap justify-between gap-x-6 gap-y-1 py-3 ${dark ? "bg-stone" : "bg-paper"}`}>
          <dt className={`text-sm ${dark ? "text-paper/70" : "text-muted"}`}>{t(`facts.${f.id}`)}</dt>
          <dd className={f.value ? "font-medium" : dark ? "text-paper/70" : "text-muted"}>
            {f.value ?? t("factPending")}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One visual asset. The kind label (Wizualizacja / Szkic / Rzut / Zdjęcie) is always shown, so a
 * render can never be mistaken for a photograph. Without a `src` it is a labelled placeholder.
 */
export async function MediaFigure({ item }: { item: ProjectMedia }) {
  const t = await getTranslations("Projects");
  const locale = (await getLocale()) as "pl" | "uk" | "en";
  const label = t(`media.${item.kind}`);
  const alt = item.alt?.[locale];

  return (
    <figure>
      <div className="relative aspect-[4/3] overflow-hidden border border-border bg-paper-deep">
        {item.src && alt && item.width && item.height ? (
          <Image src={item.src} alt={alt} width={item.width} height={item.height} sizes="(min-width: 768px) 33vw, 100vw" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
            {t("mediaPending")}
          </div>
        )}
      </div>
      <figcaption className="mt-2 text-[0.8125rem] uppercase tracking-[0.1em] text-muted">{label}</figcaption>
    </figure>
  );
}
