// Polish UI text for the CRM (the CRM is Polish only; docs/decisions.md, row 4).
import type { LeadStatus } from "./schema";
import { pluralPl } from "../../lib/plural.ts";

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Nowy",
  contacted: "Po kontakcie",
  interested: "Zainteresowany",
  meeting: "Spotkanie",
  converted: "Zrealizowany",
  not_interested: "Niezainteresowany",
  unreachable: "Nieosiągalny",
};

export const ACTIVITY_LABELS = {
  note: "Notatka",
  call: "Rozmowa telefoniczna",
  email: "E-mail",
  meeting: "Spotkanie",
  status_change: "Zmiana statusu",
} as const;

export const SOURCE_LABELS = { web_form: "Formularz na stronie", manual: "Dodany ręcznie" } as const;
export const ROLE_LABELS = { owner: "Właściciel", assistant: "Opiekun" } as const;
export const LOCALE_LABELS: Record<string, string> = { pl: "polski", uk: "ukraiński", en: "angielski" };

/** "1 lead", "2 leady", "5 leadów", "12 leadów", "22 leady" (Polish has three plural forms). */
export const leadCount = (n: number) => `${n} ${pluralPl(n, { one: "lead", few: "leady", many: "leadów" })}`;

export const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Warsaw" }).format(new Date(iso));
