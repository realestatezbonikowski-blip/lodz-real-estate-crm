// Isometric concept illustration for the location section. It is NOT a map: the neighbouring
// volumes are neutral stand-ins and do not represent real buildings, streets or distances.
// Only the highlighted volume stands for Radomska 5.

const OX = 400;
const OY = 80;
const U = 38; // half-width of one grid unit on screen
const ZU = U * 0.95; // screen pixels per unit of height
const iso = (x: number, y: number, z = 0): [number, number] => [OX + (x - y) * U, OY + (x + y) * (U / 2) - z * ZU];
const pts = (a: [number, number][]) => a.map((p) => p.join(",")).join(" ");

function Block({ x, y, w, d, h, accent, cls, i }: { x: number; y: number; w: number; d: number; h: number; accent?: boolean; cls?: string; i: number }) {
  const c = accent ? { l: "#c9cfcf", r: "#eceeed", t: "#ffffff" } : { l: "#222c32", r: "#2c383f", t: "#35434b" };
  const top = pts([iso(x, y, h), iso(x + w, y, h), iso(x + w, y + d, h), iso(x, y + d, h)]);
  const left = pts([iso(x, y + d, h), iso(x + w, y + d, h), iso(x + w, y + d, 0), iso(x, y + d, 0)]);
  const right = pts([iso(x + w, y, h), iso(x + w, y + d, h), iso(x + w, y + d, 0), iso(x + w, y, 0)]);
  return (
    <g className={`extrude ${cls ?? ""}`} style={{ "--i": i } as React.CSSProperties}>
      <polygon points={left} fill={c.l} stroke="var(--line)" strokeWidth="1" />
      <polygon points={right} fill={c.r} stroke="var(--line)" strokeWidth="1" />
      <polygon points={top} fill={c.t} stroke={accent ? "var(--accent)" : "var(--line)"} strokeWidth={accent ? 2.5 : 1} />
    </g>
  );
}

export function IsoLocation({ label, building, context }: { label: string; building: string; context: string }) {
  const ground = pts([iso(-1, -1), iso(9, -1), iso(9, 9), iso(-1, 9)]);
  const gridLines = Array.from({ length: 10 }, (_, k) => k);
  const target = { x: 4, y: 3.2 };
  const [lx, ly] = iso(target.x + 0.9, target.y + 0.9, 4.2);
  return (
    <figure className="iso-scene">
      <svg viewBox="0 -60 800 520" role="img" aria-label={label} className="h-auto w-full">
        <polygon points={ground} fill="var(--paper-deep)" stroke="var(--line)" />
        {gridLines.map((k) => (
          <g key={k} stroke="var(--ink)" strokeOpacity="0.07">
            <line x1={iso(k - 1, -1)[0]} y1={iso(k - 1, -1)[1]} x2={iso(k - 1, 9)[0]} y2={iso(k - 1, 9)[1]} />
            <line x1={iso(-1, k - 1)[0]} y1={iso(-1, k - 1)[1]} x2={iso(9, k - 1)[0]} y2={iso(9, k - 1)[1]} />
          </g>
        ))}
        {/* neutral stand-ins for surrounding volumes */}
        <Block x={0} y={0} w={2.2} d={2} h={2.4} i={0} />
        <Block x={2.8} y={-0.2} w={1.6} d={1.8} h={1.8} i={1} />
        <Block x={6.2} y={0.2} w={2} d={2.4} h={3} i={2} />
        <Block x={0.2} y={3.4} w={1.8} d={2.2} h={1.6} i={3} />
        <Block x={0.4} y={6.4} w={2.4} d={2} h={2.2} i={4} />
        <Block x={5.8} y={4.2} w={2.2} d={2} h={1.9} i={5} />
        <Block x={4.6} y={6.8} w={2.6} d={1.8} h={2.6} i={6} />
        {/* Radomska 5 */}
        <Block x={target.x} y={target.y} w={1.8} d={1.8} h={4.2} accent cls="extrude-main" i={7} />
        <g className="beacon" aria-hidden="true">
          <ellipse cx={iso(target.x + 0.9, target.y + 0.9)[0]} cy={iso(target.x + 0.9, target.y + 0.9)[1] + 6} rx="92" ry="46" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
        </g>
        <line x1={lx} y1={ly} x2={lx} y2={ly - 70} stroke="var(--accent)" strokeWidth="1.5" />
        <circle cx={lx} cy={ly - 70} r="4" fill="var(--accent)" />
        <text x={lx + 12} y={ly - 66} fontSize="22" fill="var(--ink)" fontFamily="var(--font-inter), sans-serif" fontWeight="500">{building}</text>
      </svg>
      <figcaption className="mt-3 flex items-center gap-2 text-[0.8125rem] text-muted">
        <i aria-hidden="true" className="block h-2.5 w-2.5 border border-accent bg-ink" /> {building}
        <i aria-hidden="true" className="ml-4 block h-2.5 w-2.5 bg-paper-deep outline outline-1 outline-border" /> {context}
      </figcaption>
    </figure>
  );
}
