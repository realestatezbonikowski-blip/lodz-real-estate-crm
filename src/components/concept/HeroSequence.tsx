"use client";

import { ArrowDown } from "lucide-react";
import { useEffect, useRef } from "react";

// Cinematic hero. The supplied walkthrough video is NOT scrubbed directly: it seeks slowly (about
// 1 s per jump) and carries a baked-in website overlay. Instead its clean, cropped segment was
// exported once to a numbered WebP sequence (public/concept/seq) and is painted on a canvas,
// following the scroll position. Without JS, with reduced motion, or with data-saver the page shows
// the first frame as a still: the hero is complete without any animation.

const DESKTOP = { prefix: "d", count: 70 };
const MOBILE = { prefix: "m", count: 70 };
const frameUrl = (set: typeof DESKTOP, i: number) => `/concept/seq/${set.prefix}-${String(i + 1).padStart(2, "0")}.webp`;

type Props = {
  region: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  lead: string;
  ctaApartments: string;
  ctaFinancing: string;
  beat: string;
  end: string;
  scroll: string;
  poster: string;
  disclaimer: string;
  stages: [string, string, string];
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function HeroSequence(p: Props) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const bridge = useRef<HTMLDivElement>(null);
  const beat = useRef<HTMLParagraphElement>(null);
  const endCue = useRef<HTMLParagraphElement>(null);
  const hint = useRef<HTMLParagraphElement>(null);
  const stageEls = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const el = section.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lean = nav.connection?.saveData || /(^|-)2g$/.test(nav.connection?.effectiveType ?? "") || (nav.deviceMemory ?? 8) < 2;
    if (reduced || lean) return; // stays a still image

    const narrow = window.matchMedia("(max-width: 767px)").matches;
    const set = narrow ? MOBILE : DESKTOP;
    const frames: (HTMLImageElement | null)[] = new Array(set.count).fill(null);
    let alive = true;
    let target = 0;
    let shown = -1;
    let raf = 0;
    let inView = true;

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.min(Math.round(cv.clientWidth * dpr), 1600);
      const h = Math.round((w * cv.clientHeight) / Math.max(cv.clientWidth, 1));
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
        shown = -1;
      }
    };

    // Nearest loaded frame at or below i (so a slow connection degrades to a stepped playback).
    const have = (i: number) => {
      for (let k = Math.min(i, set.count - 1); k >= 0; k--) if (frames[k]?.complete && frames[k]!.naturalWidth) return frames[k]!;
      return null;
    };

    // Narrow screens crop a landscape frame to portrait; follow the subject (building, door, hall).
    const focal = (t: number) => (narrow ? 0.7 - 0.22 * smooth(0, 0.9, t) : 0.5);

    const drawFrame = (img: HTMLImageElement, alpha: number, t: number) => {
      const s = Math.max(cv.width / img.naturalWidth, cv.height / img.naturalHeight);
      const w = img.naturalWidth * s;
      const h = img.naturalHeight * s;
      const x = -(w - cv.width) * focal(t);
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, x, (cv.height - h) / 2, w, h);
    };

    const paint = (t: number) => {
      const f = clamp01(t / 0.9) * (set.count - 1);
      const i = Math.floor(f);
      const a = have(i);
      if (!a) return;
      const b = have(Math.min(i + 1, set.count - 1));
      size();
      drawFrame(a, 1, t);
      // Short crossfade at the middle of each step: smooth, without ghosting fast movement.
      const mix = smooth(0.3, 0.7, f - i);
      if (b && b !== a && mix > 0.01) drawFrame(b, mix, t);
      ctx.globalAlpha = 1;
      cv.dataset.on = "true";
    };

    const choreograph = (t: number) => {
      if (copy.current) {
        const o = 1 - smooth(0.05, 0.2, t);
        copy.current.style.opacity = String(o);
        copy.current.style.transform = `translate3d(0, ${(-1 + o) * 28}px, 0)`;
        copy.current.style.visibility = o < 0.02 ? "hidden" : "visible";
      }
      // The scrim lightens once the headline has gone, so the architecture is not left dim.
      if (scrim.current) scrim.current.style.opacity = String(0.55 + 0.45 * (1 - smooth(0.06, 0.26, t)));
      if (beat.current) {
        const o = smooth(0.24, 0.34, t) * (1 - smooth(0.5, 0.6, t));
        beat.current.style.opacity = String(o);
        beat.current.style.transform = `translate3d(0, ${(1 - o) * 18}px, 0)`;
      }
      if (hint.current) hint.current.style.opacity = String(1 - smooth(0.04, 0.14, t));
      if (bridge.current) bridge.current.style.opacity = String(smooth(0.84, 1, t));
      if (endCue.current) {
        const o = smooth(0.9, 0.98, t);
        endCue.current.style.opacity = String(o);
        endCue.current.style.transform = `translate3d(0, ${(1 - o) * 10}px, 0)`;
      }
      if (rail.current) rail.current.style.transform = `scaleX(${t.toFixed(4)})`;
      const mid = [0.08, 0.5, 0.9];
      stageEls.current.forEach((s, k) => {
        if (!s) return;
        const d = Math.abs(t - (mid[k] ?? 0));
        s.style.opacity = String(1 - smooth(0.08, 0.2, d));
      });
    };

    const tick = () => {
      raf = 0;
      const next = shown < 0 ? target : shown + (target - shown) * 0.2;
      shown = Math.abs(target - next) < 0.0004 ? target : next;
      paint(shown);
      choreograph(shown);
      if (shown !== target) raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf && alive && inView) raf = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      const r = el.getBoundingClientRect();
      const run = r.height - window.innerHeight;
      target = run > 0 ? clamp01(-r.top / run) : 0;
      kick();
    };

    // Load the rest of the sequence after the first paint, a few at a time.
    let cursor = 1;
    const loadMore = () => {
      if (!alive) return;
      let started = 0;
      while (started < 4 && cursor < set.count) {
        const i = cursor++;
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          frames[i] = img;
          kick();
          loadMore();
        };
        img.onerror = () => loadMore();
        img.src = frameUrl(set, i);
        started++;
      }
    };

    const first = new Image();
    first.onload = () => {
      frames[0] = first;
      el.dataset.scrub = "true"; // CSS now gives the section its scroll length
      onScroll();
      paint(shown < 0 ? 0 : shown);
      choreograph(target);
      const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
      if (idle) idle(loadMore);
      else setTimeout(loadMore, 200);
    };
    first.src = frameUrl(set, 0);

    const io = new IntersectionObserver(([e]) => {
      inView = e?.isIntersecting ?? true;
      if (inView) onScroll();
    });
    io.observe(el);
    const onResize = () => {
      shown = -1;
      onScroll();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      delete el.dataset.scrub;
    };
  }, []);

  return (
    <section ref={section} aria-label={p.region} className="hero surface-night relative">
      <div className="hero-pin">
        <picture>
          <source media="(max-width: 767px)" srcSet="/concept/seq/m-01.webp" />
          {/* LCP element: a plain, eagerly fetched image so it paints before any script runs. */}
          <img src="/concept/seq/d-01.webp" alt={p.poster} width={960} height={640} fetchPriority="high" decoding="async" className="hero-media" />
        </picture>
        <canvas ref={canvas} aria-hidden="true" className="hero-media hero-canvas" />
        <div ref={scrim} aria-hidden="true" className="hero-scrim" />

        <div ref={bridge} aria-hidden="true" className="hero-bridge" />

        <p ref={beat} aria-hidden="true" className="hero-beat display">{p.beat}</p>
        <p ref={endCue} aria-hidden="true" className="hero-end">{p.end}<ArrowDown size={16} strokeWidth={1.75} aria-hidden="true" /></p>

        <div ref={copy} className="hero-copy wrap">
          <p className="eyebrow text-ink">{p.eyebrow}</p>
          <h1 className="display lining mt-4 text-[clamp(3.25rem,10vw,8.5rem)]">{p.title}</h1>
          <p className="mt-3 max-w-xl text-lg text-ink/90 sm:text-xl">{p.subtitle}</p>
          <p className="hero-lead mt-5 max-w-lg text-ink/85">{p.lead}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#apartments" className="btn btn-primary">{p.ctaApartments}</a>
            <a href="#financing" className="btn btn-ghost">{p.ctaFinancing}</a>
          </div>
        </div>

        <div className="hero-foot wrap">
          <p ref={hint} className="hero-hint flex items-center gap-2 text-sm text-ink/85">
            <ArrowDown size={16} strokeWidth={1.75} aria-hidden="true" />
            {p.scroll}
          </p>
          <div aria-hidden="true" className="hero-stages">
            {p.stages.map((s, k) => (
              <span key={s} ref={(n) => { stageEls.current[k] = n; }} style={{ opacity: k === 0 ? 1 : 0 }}>0{k + 1} — {s}</span>
            ))}
          </div>
          <p className="hero-disclaimer text-[0.8125rem] text-ink/80">{p.disclaimer}</p>
        </div>
        <div aria-hidden="true" className="hero-railwrap"><div ref={rail} className="hero-rail" /></div>
      </div>
    </section>
  );
}
