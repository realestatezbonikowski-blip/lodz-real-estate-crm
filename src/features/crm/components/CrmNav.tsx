"use client";

import { CircleHelp, LayoutList, LogOut, Menu, ShieldCheck, UserPlus, Users, X, type LucideIcon } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Item = { href: string; label: string; icon: "leads" | "new" | "security" | "team" | "help" };
const ICONS: Record<Item["icon"], LucideIcon> = { leads: LayoutList, new: UserPlus, security: ShieldCheck, team: Users, help: CircleHelp };

/** Active tab: /admin/leads covers the list and a lead's detail, but not the "new lead" form. */
function isActive(item: Item, path: string) {
  if (item.href === "/admin/leads") return path.startsWith("/admin/leads") && path !== "/admin/leads/new";
  return path === item.href || path.startsWith(item.href + "/");
}

/**
 * Tells the person the tap was registered while the next page loads. It sits inside a <Link> and shows
 * only if the navigation takes longer than ~150 ms (CSS delay), so fast navigations stay quiet. It is a
 * small dot, not a movement-heavy animation.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return <span aria-hidden="true" className="link-pending" data-active={pending || undefined} />;
}

/**
 * CRM navigation. Desktop: illuminated tabs (CSS only: glow + a single light sweep on hover, an
 * accent bar for the active tab). Mobile: a menu button opening a full-width drawer with large
 * touch rows. Pressed feedback (:active) replaces hover on touch. Sign-out and the theme/language
 * controls are passed in as server-rendered nodes, so no auth logic lives here and the labels arrive
 * already translated.
 */
export function CrmNav({ items, label, menuOpen, menuClose, userName, role, signOut, prefs }: {
  items: Item[]; label: string; menuOpen: string; menuClose: string; userName: string; role: string; signOut: ReactNode; prefs: ReactNode;
}) {
  const path = usePathname();
  // The drawer belongs to the page it was opened on: navigating closes it without an effect.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === path;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => setOpenPath((cur) => ((typeof v === "function" ? v(cur === path) : v) ? path : null));
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenPath(null);
        button.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <nav aria-label={label} className="hidden lg:block">
        <ul className="flex gap-1">
          {items.map((it) => {
            const Icon = ICONS[it.icon];
            return (
              <li key={it.href}>
                <Link href={it.href} aria-current={isActive(it, path) ? "page" : undefined} className="crm-tab">
                  <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                  {it.label}
                  <LinkPending />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex items-center gap-2 sm:gap-3">
        <p className="hidden items-center gap-2 text-sm xl:flex">
          <span>{userName}</span>
          <span className="tag">{role}</span>
        </p>
        {prefs}
        <div className="hidden lg:block">{signOut}</div>
        <button
          ref={button}
          type="button"
          className="crm-tab lg:hidden"
          aria-expanded={open}
          aria-controls="crm-drawer"
          aria-label={open ? menuClose : menuOpen}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <div id="crm-drawer" className="crm-drawer lg:hidden">
          <nav aria-label={label}>
            <ul className="wrap py-2">
              {items.map((it) => {
                const Icon = ICONS[it.icon];
                return (
                  <li key={it.href}>
                    <Link href={it.href} aria-current={isActive(it, path) ? "page" : undefined} className="crm-tab w-full justify-start text-base" style={{ minHeight: "3.25rem" }}>
                      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                      {it.label}
                      <LinkPending />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="wrap flex items-center justify-between gap-3 border-t border-border py-3 text-sm">
            <p className="flex items-center gap-2">
              <span>{userName}</span>
              <span className="tag">{role}</span>
            </p>
            {signOut}
          </div>
        </div>
      )}
    </>
  );
}

export function SignOutIcon() {
  return <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />;
}
