"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArchitecturalMotif } from "./ArchitecturalMotif";

// Decorative only. The figure is revealed once with a clip-path wipe (CSS), and the artwork drifts
// a few pixels against the scroll. The transform is passed as a full string so it can stay on the
// compositor; with reduced motion the artwork does not move at all.
export function HeroVisual({ label, caption }: { label: string; caption: string }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const transform = useTransform(scrollYProgress, [0, 1], ["translateY(20px)", "translateY(-20px)"]);

  return (
    <figure ref={ref}>
      <div className="clip-reveal relative aspect-[5/6] overflow-hidden border border-border">
        <motion.div className="absolute inset-[-24px]" style={reduce ? undefined : { transform }}>
          <ArchitecturalMotif label={label} className="h-full w-full" />
        </motion.div>
      </div>
      <figcaption className="mt-3 text-[0.8125rem] text-muted">{caption}</figcaption>
    </figure>
  );
}
