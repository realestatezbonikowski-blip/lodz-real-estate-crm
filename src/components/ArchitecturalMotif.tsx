// Abstract architectural composition used as a stand-in visual. It is deliberately NOT a building:
// no floors, windows, balconies or proportions are drawn, so it cannot be mistaken for the project.
// Replace with approved visualisations (see src/features/projects/data.ts, media).

export function ArchitecturalMotif({ label, className }: { label: string; className?: string }) {
  const hairlines = Array.from({ length: 24 }, (_, i) => 40 + i * 40);
  return (
    <svg
      viewBox="0 0 800 960"
      role="img"
      aria-label={label}
      className={className}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="800" height="960" fill="var(--paper-deep)" />
      {hairlines.map((y) => (
        <line key={y} x1="0" x2="800" y1={y} y2={y} stroke="var(--ink)" strokeOpacity="0.07" />
      ))}
      <circle cx="590" cy="250" r="96" fill="var(--accent)" />
      <rect x="120" y="300" width="250" height="560" fill="var(--stone)" />
      <rect x="330" y="410" width="230" height="450" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
      <rect x="520" y="520" width="190" height="340" fill="var(--ink)" />
      <line x1="60" x2="760" y1="860" y2="860" stroke="var(--ink)" strokeWidth="2" />
      <line x1="120" x2="120" y1="120" y2="860" stroke="var(--ink)" strokeOpacity="0.35" />
      <line x1="710" x2="710" y1="120" y2="860" stroke="var(--ink)" strokeOpacity="0.35" />
    </svg>
  );
}
