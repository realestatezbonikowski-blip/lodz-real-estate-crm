import type { Metadata } from "next";
import Link from "next/link";
import { Message } from "@/components/Message";
import { getT } from "@/features/admin-prefs/server";
import { requireOwner } from "@/features/crm/auth";
import { roleLabel } from "@/features/crm/labels";
import { ActiveToggle, InviteForm } from "@/features/team/components";
import { inviteStates, listTeam } from "@/features/team/queries";
import { createTeamAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("team.title") };
}

export default async function TeamPage() {
  const { supabase, user } = await requireOwner(); // owners only; an opiekun is redirected away
  const { t, tn } = await getT();
  const team = await listTeam(supabase);
  const admin = createTeamAdminClient();
  const states = admin && team ? await inviteStates(admin, team.map((m) => m.id)) : new Map();

  return (
    <main id="content" className="wrap py-8 lg:py-12">
      <h1 className="display text-4xl sm:text-5xl">{t("team.title")}</h1>
      <p className="mt-2 max-w-2xl text-muted">{t("team.intro")}</p>

      {!admin && (
        <Message tone="warning" className="mt-6">{t("team.noKey", { key: "SUPABASE_TEAM_ADMIN_KEY" })}</Message>
      )}

      <section aria-labelledby="members" className="mt-8">
        <h2 id="members" className="eyebrow">{t("team.members")}</h2>
        {team === null ? (
          <Message tone="error" className="mt-4">{t("team.loadError")}</Message>
        ) : (
          <ul className="mt-4 grid gap-2">
            {team.map((m) => {
              const inv = states.get(m.id);
              return (
                <li key={m.id} className="crm-panel grid gap-3 p-4 md:grid-cols-12 md:items-center">
                  <div className="min-w-0 md:col-span-3">
                    <p className="font-medium">{m.full_name}{m.id === user.id && <span className="ml-2 text-sm text-muted">{t("team.you")}</span>}</p>
                    <p className="break-all text-sm text-muted">{inv?.email ?? t("team.emailHidden")}</p>
                  </div>
                  <p className="text-sm md:col-span-2"><span className="tag">{roleLabel(t, m.role)}</span></p>
                  <p className="text-sm md:col-span-3">
                    <span className={m.is_active ? "text-success" : "text-danger"}>{m.is_active ? t("team.active") : t("team.inactive")}</span>
                    <span className="block text-muted">
                      {inv
                        ? inv.state === "active" ? t("team.stateActive") : inv.state === "invited" ? t("team.stateInvited") : t("team.stateUnknown")
                        : t("team.stateNA")}
                    </span>
                  </p>
                  <p className="text-sm md:col-span-2">
                    <Link className="link" href={`/admin/leads?assigned=${m.id}`}>{tn("team.openLeads", m.openLeads)}</Link>
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
        <h2 id="invite" className="eyebrow">{t("team.inviteTitle")}</h2>
        <div className="mt-4"><InviteForm enabled={Boolean(admin)} /></div>
      </section>
    </main>
  );
}
