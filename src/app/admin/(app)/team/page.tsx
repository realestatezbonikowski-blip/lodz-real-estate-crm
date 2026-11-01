import type { Metadata } from "next";
import Link from "next/link";
import { Message } from "@/components/Message";
import { requireOwner } from "@/features/crm/auth";
import { ROLE_LABELS } from "@/features/crm/labels";
import { ActiveToggle, InviteForm } from "@/features/team/components";
import { inviteStates, listTeam } from "@/features/team/queries";
import { createTeamAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Zespół" };

export default async function TeamPage() {
  const { supabase, user } = await requireOwner(); // owners only; an opiekun is redirected away
  const team = await listTeam(supabase);
  const admin = createTeamAdminClient();
  const states = admin && team ? await inviteStates(admin, team.map((m) => m.id)) : new Map();

  return (
    <main id="content" className="wrap py-8 lg:py-12">
      <h1 className="display text-4xl sm:text-5xl">Zespół</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Tu dodajesz opiekunów, czyli osoby, które kontaktują się z klientami, i decydujesz, kto ma dostęp do panelu.
        Leady przypisujesz w widoku leada (pole „Opiekun”).
      </p>

      {!admin && (
        <Message tone="warning" className="mt-6">
          Wysyłanie zaproszeń nie jest jeszcze włączone na serwerze: brakuje zmiennej SUPABASE_TEAM_ADMIN_KEY. Lista zespołu i dezaktywacja działają.
          Konfiguracja krok po kroku: docs/overnight/TEAM-WORKFLOW.md.
        </Message>
      )}

      <section aria-labelledby="members" className="mt-8">
        <h2 id="members" className="eyebrow">Członkowie zespołu</h2>
        {team === null ? (
          <Message tone="error" className="mt-4">Nie udało się wczytać zespołu. Odśwież stronę.</Message>
        ) : (
          <ul className="mt-4 grid gap-2">
            {team.map((m) => {
              const inv = states.get(m.id);
              return (
                <li key={m.id} className="crm-panel grid gap-3 p-4 md:grid-cols-12 md:items-center">
                  <div className="md:col-span-3">
                    <p className="font-medium">{m.full_name}{m.id === user.id && <span className="ml-2 text-sm text-muted">(Ty)</span>}</p>
                    <p className="break-all text-sm text-muted">{inv?.email ?? "e-mail widoczny po włączeniu zaproszeń"}</p>
                  </div>
                  <p className="text-sm md:col-span-2"><span className="tag">{ROLE_LABELS[m.role]}</span></p>
                  <p className="text-sm md:col-span-3">
                    <span className={m.is_active ? "text-success" : "text-danger"}>{m.is_active ? "Konto aktywne" : "Konto nieaktywne"}</span>
                    <span className="block text-muted">
                      {inv
                        ? inv.state === "active" ? "Logowanie ustawione" : inv.state === "invited" ? "Zaproszenie wysłane, hasło jeszcze nie ustawione" : "Stan zaproszenia nieznany"
                        : "Stan zaproszenia: niedostępny bez klucza"}
                    </span>
                  </p>
                  <p className="text-sm md:col-span-2">
                    <Link className="link" href={`/admin/leads?assigned=${m.id}`}>{m.openLeads} {m.openLeads === 1 ? "otwarty lead" : "otwartych leadów"}</Link>
                  </p>
                  <div className="md:col-span-2 md:justify-self-end">
                    {m.id !== user.id && <ActiveToggle userId={m.id} active={m.is_active} name={m.full_name} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="invite" className="crm-panel mt-10 p-5">
        <h2 id="invite" className="eyebrow">Dodaj opiekuna</h2>
        <div className="mt-4"><InviteForm enabled={Boolean(admin)} /></div>
      </section>
    </main>
  );
}
