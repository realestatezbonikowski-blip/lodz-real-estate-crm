// Payment structure: a 30% block, then 25 yearly segments for the remainder. Purely illustrative
// proportions of the proposed (unconfirmed) model; it carries a text alternative. The bars draw in
// on scroll with CSS only (see .draw in globals.css).
export function FinanceBar({ label, initial, rest, axis }: { label: string; initial: string; rest: string; axis: string }) {
  const years = Array.from({ length: 25 }, (_, i) => i);
  return (
    <figure role="img" aria-label={label} className="w-full">
      <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 text-sm">
        <span className="text-accent">{initial}</span>
        <span className="text-muted">{rest}</span>
      </div>
      <div className="mt-3 flex h-16 gap-[3px] sm:h-20" aria-hidden="true">
        <div className="draw relative h-full bg-accent" style={{ flex: "30 1 0" }} />
        <div className="grid h-full" style={{ flex: "70 1 0", gridTemplateColumns: "repeat(25, minmax(0, 1fr))", gap: "3px" }}>
          {years.map((y) => (
            <i key={y} className="draw block border border-accent/60 bg-accent/10" style={{ "--n": y } as React.CSSProperties} />
          ))}
        </div>
      </div>
      <div className="mt-2 flex text-[0.8125rem] text-muted" aria-hidden="true">
        <span style={{ flex: "30 1 0" }}>0</span>
        <span className="flex justify-between" style={{ flex: "70 1 0" }}>
          {[5, 10, 15, 20, 25].map((n) => (
            <span key={n}>{n === 25 ? `${n} ${axis}` : n}</span>
          ))}
        </span>
      </div>
    </figure>
  );
}
