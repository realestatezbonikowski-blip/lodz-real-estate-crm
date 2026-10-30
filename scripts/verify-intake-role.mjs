// Verifies the lead_intake role through the real pooler:   npm run verify:intake
//
// READ-ONLY. It never calls submit_lead (that would create a lead) and never writes. Every denied
// statement is expected to fail with SQLSTATE 42501. Prints pass/fail and SQLSTATE codes only,
// never the connection string, host, password or server messages.
//
// It stops at the first connection/authentication failure and does NOT retry: repeated failed
// logins can trigger Supabase's automatic network bans.
import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";

if (!existsSync(".env.local")) { console.log("✖ .env.local not found."); process.exit(1); }
let url = "";
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*LEAD_INTAKE_DATABASE_URL\s*=\s*(.*?)\s*$/);
  if (m && !line.trimStart().startsWith("#")) url = m[1].replace(/^(['"])(.*)\1$/, "$2");
}
if (!url) { console.log("✖ LEAD_INTAKE_DATABASE_URL is not set in .env.local. Run `npm run setup:intake` first."); process.exit(1); }

let failed = false;
const ok = (m) => console.log(`✔ ${m}`);
const bad = (m) => { failed = true; console.log(`✖ ${m}`); };

function open(connectionUrl) {
  return postgres(connectionUrl, { prepare: false, max: 1, connect_timeout: 10, idle_timeout: 5, ssl: "require", onnotice: () => {} });
}

async function expectDenied(sql, label) {
  try { await sql.unsafe(label.stmt); bad(`${label.name}: was ALLOWED (expected 42501)`); }
  catch (e) {
    if (e?.code === "42501") ok(`${label.name}: denied (42501)`);
    else bad(`${label.name}: failed with ${e?.code ?? "unknown"}, expected 42501`);
  }
}

async function checks(connectionUrl, tag) {
  const sql = open(connectionUrl);
  try {
    let who;
    try { who = (await sql`select current_user as u, current_setting('statement_timeout') as t`)[0]; }
    catch (e) { bad(`[${tag}] connection or login failed (${e?.code ?? e?.name ?? "error"}). Stopping; not retrying.`); return false; }
    if (who.u === "lead_intake") ok(`[${tag}] connected as lead_intake`);
    else bad(`[${tag}] connected as an unexpected role`);
    if (who.t === "5s") ok(`[${tag}] statement_timeout is 5s`);
    else bad(`[${tag}] statement_timeout is not 5s`);

    const can = (await sql`select has_function_privilege(current_user, 'public.submit_lead(text,text,text,text,text,text,text,text,text,text,text,text,text)', 'execute') as e`)[0].e;
    if (can) ok(`[${tag}] can execute submit_lead (not called)`);
    else bad(`[${tag}] cannot execute submit_lead`);

    if (tag === "primary") {
      for (const l of [
        { name: "select from public.leads", stmt: "select count(*) from public.leads" },
        { name: "select from public.profiles", stmt: "select count(*) from public.profiles" },
        { name: "select from private.settings", stmt: "select * from private.settings" },
        { name: "create table", stmt: "create table public.zz_intake_probe (id int)" },
        { name: "call record_lead_export", stmt: "select public.record_lead_export(1, 'all')" },
        { name: "call private.is_owner", stmt: "select private.is_owner()" },
      ]) await expectDenied(sql, l);
    }
    return true;
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {});
  }
}

const u = new URL(url);
console.log(`Target: user ${u.username.split(".")[0]}.<ref>, pooler port ${u.port || "5432"} (host and password not shown)`);
const connected = await checks(url, "primary");
if (connected) {
  // Fallback transport check: the other pooler mode.
  const other = new URL(url);
  other.port = u.port === "6543" ? "5432" : "6543";
  await checks(other.toString(), u.port === "6543" ? "session-mode 5432" : "transaction-mode 6543");
}
console.log(failed ? "\n✖ Some checks failed. Do not adopt Option B until they pass; do not fall back to the secret key." : "\n✔ All checks passed. Idle-reconnect, concurrency and rotation (docs/lead-intake-credential.md, criteria 6-8) are separate manual checks; no lead was created.");
process.exit(failed ? 1 : 0);
