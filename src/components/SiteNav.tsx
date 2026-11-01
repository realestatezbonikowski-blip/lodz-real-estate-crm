"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Link, usePathname } from "@/i18n/navigation";

type Item = { href: string; label: string };

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function SiteNav({
  items,
  navLabel,
  openLabel,
  closeLabel,
}: {
  items: Item[];
  navLabel: string;
  openLabel: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const current = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const dist = reduce ? 0 : 8;

  return (
    <>
      <nav aria-label={navLabel} className="hidden md:block">
        <ul className="flex gap-8 text-sm">
          {items.map((it) => (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={current(it.href) ? "page" : undefined}
                className="inline-flex min-h-11 items-center border-b border-transparent hover:border-ink aria-[current=page]:border-ink"
              >
                {it.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <button
        type="button"
        className="btn btn-ghost w-11 px-0 md:hidden"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? closeLabel : openLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          {open ? <path d="M4 4l12 12M16 4L4 16" /> : <path d="M3 6h14M3 14h14" />}
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-nav"
            aria-label={navLabel}
            className="absolute inset-x-0 top-full border-b border-border bg-paper md:hidden"
            initial={{ opacity: 0, transform: `translateY(-${dist}px)` }}
            animate={{ opacity: 1, transform: "translateY(0px)", transition: { duration: reduce ? 0 : 0.2, ease: EASE_OUT } }}
            exit={{ opacity: 0, transform: `translateY(-${dist}px)`, transition: { duration: reduce ? 0 : 0.14, ease: EASE_OUT } }}
          >
            <ul className="wrap flex flex-col py-2">
              {items.map((it) => (
                <li key={it.href} className="border-t border-border first:border-t-0">
                  <Link
                    href={it.href}
                    aria-current={current(it.href) ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className="flex min-h-12 items-center text-lg aria-[current=page]:font-medium"
                  >
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}
