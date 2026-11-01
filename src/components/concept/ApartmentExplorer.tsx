"use client";

import { useMemo, useState } from "react";
import type { Apartment } from "@/features/apartments/data";

type Labels = {
  levels: string; all: string; level: string; roomsFilter: string; roomsAny: string; rooms: string; area: string;
  floor: string; unit: string; priceLabel: string; pending: string; example: string; showing: string; none: string; sqm: string;
};

// Level marker: a small isometric slab, lit when its level is selected.
function Slab({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 64 34" width="56" height="30" aria-hidden="true" className="shrink-0">
      <polygon points="32,2 62,14 32,26 2,14" fill={on ? "var(--brass-lit)" : "var(--paper-deep)"} stroke="var(--ink)" strokeOpacity="0.5" strokeWidth="1" />
      <polygon points="2,14 32,26 32,32 2,20" fill={on ? "var(--brass-shade)" : "var(--line)"} stroke="var(--ink)" strokeOpacity="0.5" strokeWidth="1" />
      <polygon points="32,26 62,14 62,20 32,32" fill={on ? "var(--brass-shade)" : "var(--line)"} stroke="var(--ink)" strokeOpacity="0.35" strokeWidth="1" />
    </svg>
  );
}

export function ApartmentExplorer({ apartments, floors, locale, labels }: { apartments: readonly Apartment[]; floors: readonly number[]; locale: string; labels: Labels }) {
  const [floor, setFloor] = useState(0);
  const [rooms, setRooms] = useState(0);
  const fmt = useMemo(() => new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), [locale]);
  const shown = apartments.filter((a) => (floor === 0 || a.floor === floor) && (rooms === 0 || (rooms === 4 ? a.rooms >= 4 : a.rooms === rooms)));
  const roomOptions = [0, 1, 2, 3, 4];

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-3">
        <div className="lg:sticky lg:top-24">
          <h3 className="eyebrow">{labels.levels}</h3>
          <div role="group" aria-label={labels.levels} className="mt-4 flex gap-1 overflow-x-auto pb-1 lg:grid lg:overflow-visible">
            {[0, ...[...floors].reverse()].map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={floor === f}
                onClick={() => setFloor(f)}
                className="level-btn flex min-h-11 shrink-0 items-center gap-3 whitespace-nowrap px-2 pr-3 text-left text-sm"
              >
                {f === 0 ? <Slab on={floor === 0} /> : <Slab on={floor === f} />}
                <span className="font-medium">{f === 0 ? labels.all : `${labels.level} ${f}`}</span>
              </button>
            ))}
          </div>

          <h3 className="eyebrow mt-8">{labels.roomsFilter}</h3>
          <div role="group" aria-label={labels.roomsFilter} className="mt-3 flex flex-wrap gap-2">
            {roomOptions.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={rooms === r}
                onClick={() => setRooms(r)}
                className="chip"
                aria-label={r === 0 ? labels.roomsAny : r === 4 ? "4+" : String(r)}
              >
                {r === 0 ? labels.roomsAny : r === 4 ? "4+" : r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-w-0 lg:col-span-9">
        <p className="mb-5 text-sm text-muted" role="status" aria-live="polite">
          {labels.showing.replace("{shown}", String(shown.length)).replace("{total}", String(apartments.length))}
        </p>
        {shown.length === 0 ? (
          <p className="border border-dashed border-border p-8 text-muted">{labels.none}</p>
        ) : (
          <ul className="apt-grid grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((a) => (
              <li key={a.id}>
                <article className="apt-card">
                  <header className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.8125rem] font-medium uppercase tracking-[0.14em] text-muted">{labels.floor}</p>
                      <p className="display lining text-6xl leading-none">{String(a.floor).padStart(2, "0")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{a.id}</p>
                      {a.sample && <p className="tag mt-2">{labels.example}</p>}
                    </div>
                  </header>

                  <dl className="mt-8 grid gap-5 border-t border-border pt-5">
                    <div>
                      <dt className="text-[0.8125rem] uppercase tracking-[0.14em] text-muted">{labels.area}</dt>
                      <dd className="display lining mt-1 whitespace-nowrap text-5xl leading-none">
                        {fmt.format(a.area)} <span className="font-sans text-base">{labels.sqm}</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.8125rem] uppercase tracking-[0.14em] text-muted">{labels.rooms}</dt>
                      <dd className="mt-1 flex items-end gap-3">
                        <span className="display lining text-5xl leading-none">{a.rooms}</span>
                        <span aria-hidden="true" className="mb-1.5 flex gap-1">
                          {Array.from({ length: a.rooms }, (_, i) => (
                            <i key={i} className="block h-3 w-3 bg-ink" />
                          ))}
                        </span>
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-6 flex items-baseline justify-between gap-3 border-t border-border pt-4 text-sm">
                    <span className="text-muted">{labels.priceLabel}</span>
                    <span className="font-medium">{labels.pending}</span>
                  </p>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
