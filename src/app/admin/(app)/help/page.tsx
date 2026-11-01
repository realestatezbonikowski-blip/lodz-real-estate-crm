import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/features/crm/auth";

export const metadata: Metadata = { title: "Pomoc" };

// A short guide that describes only what exists in this CRM: the real tabs, buttons, fields, statuses
// and permissions (see src/features/crm and the RLS policies). Update it when the workflow changes.

const OWNER = <span className="tag ml-2 align-middle">tylko właściciel</span>;

const STEPS: { title: string; owner?: boolean; body: React.ReactNode }[] = [
  {
    title: "1. Dodaj opiekuna",
    owner: true,
    body: (
      <>Wejdź w zakładkę <Link className="link" href="/admin/team">Zespół</Link>, wpisz imię, nazwisko i e-mail w sekcji „Dodaj opiekuna” i wyślij zaproszenie.
        Osoba dostaje e-mail, ustawia hasło i może się zalogować. Na liście widzisz, czy zaproszenie zostało przyjęte. Konto możesz w każdej chwili dezaktywować.</>
    ),
  },
  {
    title: "2. Odbierz nowy lead",
    body: (
      <>Zapytania z formularza na stronie trafiają do zakładki <Link className="link" href="/admin/leads">Leady</Link> ze statusem „Nowy”.
        Kafelek „Nowe” i widok „Nieprzypisane” pokazują, co czeka. Zapytanie telefoniczne dodasz przyciskiem „Nowy lead”.</>
    ),
  },
  {
    title: "3. Przypisz lead",
    owner: true,
    body: (
      <>Otwórz lead (kliknij wiersz), w sekcji „Obsługa” wybierz osobę w polu „Opiekun” i kliknij „Zapisz opiekuna”. Zmianę przypisania zrobisz tak samo.
        Zmiana jest rejestrowana w dzienniku zdarzeń. Każdy aktywny członek zespołu widzi wszystkie leady; „Moje leady” to filtr dla wygody.</>
    ),
  },
  {
    title: "4. Skontaktuj się i zapisz kontakt",
    body: (
      <>W leadzie, w „Historia kontaktu”, wybierz rodzaj wpisu (notatka, rozmowa, e-mail, spotkanie), opisz rozmowę i kliknij „Dodaj wpis”.
        Na liście leadów widać datę ostatniego kontaktu.</>
    ),
  },
  {
    title: "5. Zmień status",
    body: (
      <>W sekcji „Obsługa” wybierz status (Nowy, Po kontakcie, Zainteresowany, Spotkanie, Zrealizowany, Niezainteresowany, Nieosiągalny) i kliknij „Zapisz status”.
        Każda zmiana trafia do historii.</>
    ),
  },
  {
    title: "6. Zaplanuj następny kontakt",
    body: (
      <>W sekcji „Obsługa” ustaw „Następny kontakt (data)” i krótki „Następny krok”, potem „Zapisz termin”. Puste pola usuwają termin.
        Widok „Do kontaktu dziś i zaległe” na liście leadów zbiera leady, na które przyszła pora.</>
    ),
  },
  {
    title: "7. Szukaj, filtruj, archiwizuj",
    body: (
      <>Na liście użyj pola „Szukaj” (imię, nazwisko, e-mail, telefon), filtrów Inwestycja, Źródło i Opiekun oraz zakładek statusów.
        „Archiwizuj” w leadzie chowa go z listy; „Pokaż archiwum” + „Przywróć z archiwum” cofa to. Archiwizować i przywracać może każdy aktywny członek zespołu.</>
    ),
  },
];

const PERMISSIONS: [string, string, string][] = [
  ["Przeglądanie i wyszukiwanie leadów", "tak", "tak"],
  ["Dodawanie leadów ręcznie, notatki, kontakty, statusy, terminy", "tak", "tak"],
  ["Przypisywanie i zmiana opiekuna", "tak", "tak (technicznie), zwykle robi to właściciel"],
  ["Archiwizowanie i przywracanie", "tak", "tak"],
  ["Trwałe usuwanie leada", "tak", "nie"],
  ["Zespół: zaproszenia, dezaktywacja kont", "tak", "nie"],
];

export default async function HelpPage() {
  const { profile } = await requireStaff();
  const owner = profile.role === "owner";
  return (
    <main id="content" className="wrap py-8 lg:py-12">
      <h1 className="display text-4xl sm:text-5xl">Pomoc</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Jak pracować z leadami od zapytania klienta do zamknięcia sprawy.
        {owner ? " Kroki oznaczone „tylko właściciel” wykonujesz Ty." : " Kroki oznaczone „tylko właściciel” wykonuje właściciel."}
      </p>

      <ol className="mt-8 grid gap-3 lg:grid-cols-2">
        {STEPS.map((s) => (
          <li key={s.title} className="crm-panel p-5">
            <h2 className="text-lg font-semibold">{s.title}{s.owner && OWNER}</h2>
            <p className="mt-2 text-muted">{s.body}</p>
          </li>
        ))}
      </ol>

      <section aria-labelledby="perm" className="mt-10">
        <h2 id="perm" className="eyebrow">Kto co może</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border"><th scope="col" className="py-2 pr-4 font-medium">Czynność</th><th scope="col" className="py-2 pr-4 font-medium">Właściciel</th><th scope="col" className="py-2 font-medium">Opiekun</th></tr>
            </thead>
            <tbody>
              {PERMISSIONS.map(([a, o, p]) => (
                <tr key={a} className="border-b border-border"><td className="py-2 pr-4">{a}</td><td className="py-2 pr-4">{o}</td><td className="py-2">{p}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-8 text-sm text-muted">
        Bezpieczeństwo konta: w zakładce <Link className="link" href="/admin/security">Bezpieczeństwo</Link> możesz dodać aplikację uwierzytelniającą (drugi składnik). Kto ją ma, jest o nią pytany przy każdym logowaniu.
      </p>
    </main>
  );
}
