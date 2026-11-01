"use client";

import { useEffect, useRef } from "react";

/**
 * On a phone the status tabs scroll sideways; make sure the ACTIVE one is visible after navigation.
 * Renders nothing; it scrolls only its own scroll container (never the page).
 */
export function ActiveTabScroll() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const nav = marker.current?.parentElement;
    const active = nav?.querySelector<HTMLElement>("[aria-current]");
    if (!nav || !active) return;
    const left = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
    nav.scrollTo({ left: Math.max(0, left), behavior: "instant" });
  });
  return <span ref={marker} hidden />;
}
