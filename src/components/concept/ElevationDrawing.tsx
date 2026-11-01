// Schematic facade: three storeys of three windows over a dark base. A line drawing for the
// concept section, not a survey of the building; it carries a text alternative.
export function ElevationDrawing({ label, className }: { label: string; className?: string }) {
  const cols = [0, 1, 2];
  const rows = [0, 1, 2];
  return (
    <svg viewBox="0 0 400 460" role="img" aria-label={label} className={className} fill="none" stroke="var(--accent)" strokeWidth="1.25">
      <line x1="0" y1="420" x2="400" y2="420" strokeOpacity="0.7" />
      <rect x="40" y="40" width="320" height="300" strokeOpacity="0.9" />
      <rect x="40" y="340" width="320" height="80" fill="var(--accent)" fillOpacity="0.14" />
      <line x1="40" y1="340" x2="360" y2="340" />
      {rows.map((r) =>
        cols.map((c) => (
          <g key={`${r}-${c}`}>
            <rect x={78 + c * 96} y={70 + r * 90} width="44" height="62" strokeOpacity="0.95" />
            <line x1={72 + c * 96} y1={70 + r * 90} x2={72 + c * 96} y2={132 + r * 90} strokeOpacity="0.4" />
            <line x1={128 + c * 96} y1={70 + r * 90} x2={128 + c * 96} y2={132 + r * 90} strokeOpacity="0.4" />
          </g>
        )),
      )}
      <rect x="250" y="360" width="52" height="60" strokeOpacity="0.95" />
      <line x1="28" y1="40" x2="28" y2="420" strokeOpacity="0.35" />
      {[40, 130, 220, 310, 340, 420].map((y) => (
        <line key={y} x1="22" y1={y} x2="34" y2={y} strokeOpacity="0.5" />
      ))}
    </svg>
  );
}
