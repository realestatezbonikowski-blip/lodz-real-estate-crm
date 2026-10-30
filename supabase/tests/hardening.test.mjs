// Phase 1B tests: gaps found in review. Same approach and same limits as rls.test.mjs
// (in-process Postgres + a stub of Supabase's roles; it does not prove live Supabase behaviour).
//   npm run test:db
//
// The small harness below is intentionally duplicated from rls.test.mjs to keep the two files
// independent; merge them into a shared helper if more test files are added.

import { describe, test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const here = import.meta.dirname;
const migrationsDir = process.env.MIGRATIONS_DIR ?? join(here, "..", "migrations");
const plannedMfa = join(here, "..", "planned", "mfa_enforcement.sql");

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const OWNER = id(1), ASSIST = id(2), ASSIST2 = id(3), INACTIVE = id(4), OWNER2 = id(6);
const PROJ_PUB = id(11), PROJ_UNPUB = id(12);
const LEAD1 = id(21), LEAD2 = id(22);

const anon = { role: "anon" };
const service = { role: "service_role" };
const as = (uid, aal) => ({ role: "authenticated", uid, aal });
const owner = as(OWNER), assistant = as(ASSIST), inactive = as(INACTIVE);

let db;

async function run(ctx, sql, params = []) {
  const claims = ctx.uid ? JSON.stringify({ sub: ctx.uid, role: ctx.role, ...(ctx.aal && { aal: ctx.aal }) }) : "";
  await db.query("select set_config('request.jwt.claims', $1, false)", [claims]);
  await db.exec(`set role ${ctx.role}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims', '', false)");
  }
}
const su = (sql, params = []) => db.query(sql, params);
const count = async (sql, params) => Number((await su(sql, params)).rows[0].n);

async function assertFails(ctx, sql, params, code) {
  await assert.rejects(run(ctx, sql, params), (e) => {
    assert.equal(e.code, code, `expected SQLSTATE ${code}, got ${e.code}: ${e.message}`);
    return true;
  });
}
const denied = (ctx, sql, params) => assertFails(ctx, sql, params, "42501");

async function freshDb({ mfa = false } = {}) {
  db = new PGlite();
  await db.exec(readFileSync(join(here, "supabase_stub.sql"), "utf8"));
  for (const f of readdirSync(migrationsDir).filter((n) => n.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(migrationsDir, f), "utf8"));
  }
  if (mfa) await db.exec(readFileSync(plannedMfa, "utf8"));
  await db.exec(`
    insert into auth.users (id, email) values
      ('${OWNER}', 'owner@test'), ('${ASSIST}', 'a1@test'), ('${ASSIST2}', 'a2@test'),
      ('${INACTIVE}', 'inactive@test'), ('${OWNER2}', 'owner2@test');
    insert into public.profiles (id, full_name, role, is_active) values
      ('${OWNER}', 'Owner', 'owner', true),
      ('${ASSIST}', 'Assistant One', 'assistant', true),
      ('${ASSIST2}', 'Assistant Two', 'assistant', true),
      ('${INACTIVE}', 'Inactive Assistant', 'assistant', false);
    insert into public.projects (id, slug, name, is_published) values
      ('${PROJ_PUB}', 'alpha', 'Alpha', true), ('${PROJ_UNPUB}', 'beta', 'Beta', false);
    insert into public.leads (id, first_name, last_name, phone, email, locale, privacy_notice_version, project_id) values
      ('${LEAD1}', 'Jan', 'Kowalski', '+48 600 100 200', 'jan@example.com', 'pl', 'test-v0', '${PROJ_PUB}'),
      ('${LEAD2}', 'Anna', 'Nowak', '+48 600 100 201', 'anna@example.com', 'uk', 'test-v0', null);
  `);
}

const submitArgs = (over = {}) => {
  const a = {
    first: "Ewa", last: "Zielińska", phone: "+48 500 000 001", email: "ewa@example.com", project: "alpha",
    message: "Hello", locale: "en", s: "google", m: "cpc", c: "spring", path: "/en", ref: "https://example.org/",
    ver: "test-v0", ...over,
  };
  return [a.first, a.last, a.phone, a.email, a.project, a.message, a.locale, a.s, a.m, a.c, a.path, a.ref, a.ver];
};
const SUBMIT = "select public.submit_lead($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) as r";

const MANUAL = `insert into public.leads (first_name, last_name, phone, email, locale, source, created_by, project_id)
                values ('Tomasz', 'Wójcik', '+48 601 000 111', 'tomasz@example.com', 'pl', 'manual', $1, $2)`;

// ---------------------------------------------------------------------------------------------
describe("manual leads from phone enquiries (authorized staff only)", () => {
  before(() => freshDb());

  test("an assistant can add a manual lead attributed to themselves", async () => {
    assert.equal((await run(assistant, MANUAL, [ASSIST, PROJ_PUB])).affectedRows, 1);
    const l = (await su("select source, created_by, status, privacy_notice_version, utm_source, project_id from public.leads where email = 'tomasz@example.com'")).rows[0];
    assert.deepEqual(l, { source: "manual", created_by: ASSIST, status: "new", privacy_notice_version: null, utm_source: null, project_id: PROJ_PUB });
  });

  test("staff may attach a manual lead to an unpublished project (the web form may not)", async () => {
    const q = MANUAL.replace("tomasz@example.com", "tomasz2@example.com").replace("+48 601 000 111", "+48 601 000 112");
    assert.equal((await run(owner, q, [OWNER, PROJ_UNPUB])).affectedRows, 1);
  });

  test("cannot attribute the lead to someone else", () =>
    denied(assistant, MANUAL.replace("tomasz@example.com", "x1@example.com"), [ASSIST2, null]));

  test("cannot pose as a web-form lead", () =>
    denied(assistant, `insert into public.leads (first_name,last_name,phone,email,locale,source,created_by,privacy_notice_version)
                       values ('A','B','+48 600 000 000','x2@example.com','pl','web_form',$1,'v')`, [ASSIST]));

  test("cannot set attribution, notice-version or status columns", async () => {
    for (const col of ["utm_source = 'x'", "referrer = 'x'", "landing_path = '/x'", "privacy_notice_version = 'v'", "status = 'converted'", "created_at = now()"]) {
      const [name, value] = col.split(" = ");
      await denied(assistant,
        `insert into public.leads (first_name,last_name,phone,email,locale,source,created_by,${name})
         values ('A','B','+48 600 000 000','x3@example.com','pl','manual',$1,${value})`, [ASSIST]);
    }
  });

  test("anonymous and deactivated users cannot add leads", async () => {
    await denied(anon, MANUAL.replace("tomasz@example.com", "x4@example.com"), [ASSIST, null]);
    await denied(inactive, MANUAL.replace("tomasz@example.com", "x5@example.com"), [INACTIVE, null]);
  });

  test("the database refuses a manual lead that carries web attribution, even from a privileged path", () =>
    assertFails({ role: "service_role" },
      `insert into public.leads (first_name,last_name,phone,email,locale,source,utm_source)
       values ('A','B','+48 600 000 000','x6@example.com','pl','manual','google')`, [], "23514"));

  test("a manual lead then behaves like any other (status changes are logged)", async () => {
    const lead = (await su("select id from public.leads where email = 'tomasz@example.com'")).rows[0].id;
    await run(assistant, "update public.leads set status = 'contacted' where id = $1", [lead]);
    assert.equal(await count("select count(*) n from public.lead_activities where lead_id = $1 and type = 'status_change'", [lead]), 1);
  });
});

// ---------------------------------------------------------------------------------------------
describe("submit_lead input hardening and abuse limits", () => {
  before(() => freshDb());

  test("rejects control characters in single-line fields", async () => {
    let n = 0;
    const fresh = () => ({ email: `c${++n}@example.com`, phone: `+48 510 000 ${String(n).padStart(3, "0")}` });
    for (const over of [
      { first: "Ewa\t" }, { first: "Ewa\nX" }, { last: "\u0001Nowak" }, { first: "Ewa\u007f" },
      { s: "go\togle" }, { path: "/en\n" }, { ref: "https://a.example/\r\nX: y" },
    ]) {
      await assertFails(service, SUBMIT, submitArgs({ ...fresh(), ...over }), "23514");
    }
    await assertFails(service, SUBMIT, submitArgs({ email: "a\u0001@example.com", phone: "+48 520 000 001" }), "23514");
    await assertFails(service, SUBMIT, submitArgs({ email: "ok@example.com", phone: "+48 520\n000 002" }), "23514");
    assert.equal(await count("select count(*) n from public.leads where email like 'c%@example.com'"), 0);
  });

  test("message: line breaks are allowed, other control characters are not", async () => {
    await assertFails(service, SUBMIT, submitArgs({ email: "m1@example.com", phone: "+48 530 000 001", message: "hi\u0001there" }), "23514");
    assert.equal((await run(service, SUBMIT, submitArgs({ email: "m2@example.com", phone: "+48 530 000 002", message: "line one\nline two\ttabbed" }))).rows[0].r, "created");
  });

  test("null required inputs are rejected and store nothing", async () => {
    const before = await count("select count(*) n from public.leads");
    for (const over of [{ first: null }, { last: null }, { phone: null }, { email: null }, { locale: null }]) {
      await assertFails(service, SUBMIT, submitArgs({ email: "n@example.com", phone: "+48 540 000 001", ...over }), "23502");
    }
    // A web lead without a privacy-notice version trips the source-shape rule (23514) first.
    await assertFails(service, SUBMIT, submitArgs({ email: "n@example.com", phone: "+48 540 000 001", ver: null }), "23514");
    assert.equal(await count("select count(*) n from public.leads"), before);
  });

  test("global circuit breaker: stops storing web leads past the hourly cap", async () => {
    await su(`insert into public.leads (first_name,last_name,phone,email,locale,privacy_notice_version)
              select 'F','L','+48 7' || lpad(g::text, 8, '0'), 'flood' || g || '@example.com', 'pl', 'v' from generate_series(1, 100) g`);
    const before = await count("select count(*) n from public.leads");
    assert.equal((await run(service, SUBMIT, submitArgs({ email: "late@example.com", phone: "+48 550 000 001" }))).rows[0].r, "rate_limited");
    assert.equal(await count("select count(*) n from public.leads"), before);
  });

  test("the breaker counts only the last hour and only web leads", async () => {
    await su("update public.leads set created_at = now() - interval '2 hours' where email like 'flood%'");
    assert.equal((await run(service, SUBMIT, submitArgs({ email: "later@example.com", phone: "+48 550 000 002" }))).rows[0].r, "created");
  });
});

// ---------------------------------------------------------------------------------------------
describe("activity history and project integrity", () => {
  before(() => freshDb());

  test("an activity may be backdated but not set in the future", async () => {
    const ins = (when) => run(assistant,
      `insert into public.lead_activities (lead_id, type, body, actor_id, occurred_at) values ($1, 'call', 'x', $2, ${when})`, [LEAD1, ASSIST]);
    assert.equal((await ins("now() - interval '2 days'")).affectedRows, 1);
    await assertFails(assistant,
      "insert into public.lead_activities (lead_id, type, body, actor_id, occurred_at) values ($1, 'call', 'x', $2, now() + interval '1 day')", [LEAD1, ASSIST], "23514");
    const r = (await su("select created_at > occurred_at as recorded_later from public.lead_activities where lead_id = $1", [LEAD1])).rows[0];
    assert.equal(r.recorded_later, true);
  });

  test("activity text rejects control characters but keeps line breaks", async () => {
    await assertFails(assistant, "insert into public.lead_activities (lead_id, type, body, actor_id) values ($1, 'note', $3, $2)", [LEAD1, ASSIST, "a\u0001b"], "23514");
    assert.equal((await run(assistant, "insert into public.lead_activities (lead_id, type, body, actor_id) values ($1, 'note', $3, $2)", [LEAD1, ASSIST, "a\nb"])).affectedRows, 1);
  });

  test("a project slug cannot be changed through the API", async () => {
    await denied(owner, "update public.projects set slug = 'renamed' where id = $1", [PROJ_PUB]);
    assert.equal((await run(owner, "update public.projects set name = 'Alpha II' where id = $1", [PROJ_PUB])).affectedRows, 1);
  });
});

// ---------------------------------------------------------------------------------------------
describe("audit trail survives staff changes", () => {
  before(() => freshDb());

  test("deleting a staff account does not erase who performed past audited actions", async () => {
    await su(`insert into public.profiles (id, full_name, role) values ('${OWNER2}', 'Second Owner', 'owner')`);
    await run(as(OWNER2), "delete from public.leads where id = $1", [LEAD2]);
    assert.equal(await count("select count(*) n from public.audit_log where action = 'lead.delete' and actor_id = $1", [OWNER2]), 1);
    await run(owner, "delete from public.profiles where id = $1", [OWNER2]);
    assert.equal(await count("select count(*) n from public.audit_log where action = 'lead.delete' and actor_id = $1", [OWNER2]), 1);
  });

  test("a staff member with recorded history cannot be deleted, only deactivated", async () => {
    await run(assistant, "insert into public.lead_activities (lead_id, type, body, actor_id) values ($1, 'note', 'x', $2)", [LEAD1, ASSIST]);
    await assertFails(owner, "delete from public.profiles where id = $1", [ASSIST], "23001");
    assert.equal((await run(owner, "update public.profiles set is_active = false where id = $1", [ASSIST])).affectedRows, 1);
    assert.equal((await run(assistant, "select * from public.leads")).rows.length, 0);
    assert.equal(await count("select count(*) n from public.lead_activities where actor_id = $1", [ASSIST]), 1);
  });

  test("actions by the service role or SQL editor are audited without an actor", async () => {
    // Profiles here were created by the superuser (like the SQL editor): audited, no actor.
    const created = await count("select count(*) n from public.audit_log where action = 'staff.create'");
    assert.ok(created >= 1);
    assert.equal(await count("select count(*) n from public.audit_log where action = 'staff.create' and actor_id is null"), created);
  });
});

// ---------------------------------------------------------------------------------------------
describe("service role works with the triggers (no access to the private schema)", () => {
  before(() => freshDb());

  test("precondition: service_role cannot use schema private", async () => {
    assert.equal((await su("select has_schema_privilege('service_role', 'private', 'usage') v")).rows[0].v, false);
  });

  test("status updates and deletes still log history and audit", async () => {
    await run(service, "update public.leads set status = 'converted' where id = $1", [LEAD1]);
    const a = (await su("select actor_id from public.lead_activities where lead_id = $1 and type = 'status_change'", [LEAD1])).rows;
    assert.deepEqual(a, [{ actor_id: null }]);
    await run(service, "delete from public.leads where id = $1", [LEAD2]);
    assert.equal(await count("select count(*) n from public.audit_log where action = 'lead.delete' and entity_id = $1", [LEAD2]), 1);
  });
});

// ---------------------------------------------------------------------------------------------
describe("audit of lead contact and assignment changes", () => {
  before(() => freshDb());
  const auditRows = async (action) =>
    (await su("select actor_id, entity_type, entity_id, details from public.audit_log where action = $1 order by id", [action])).rows;

  test("contact-detail changes are audited with the actor and the field NAMES only", async () => {
    await run(assistant, "update public.leads set phone = '+48 699 888 777', email = 'new.address@example.com' where id = $1", [LEAD1]);
    const rows = await auditRows("lead.update_contact");
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], { actor_id: ASSIST, entity_type: "lead", entity_id: LEAD1, details: { fields: ["phone", "email"] } });
    const raw = JSON.stringify(rows);
    for (const secret of ["699 888 777", "new.address", "Kowalski", "jan@example.com", "+48 600 100 200"]) {
      assert.ok(!raw.includes(secret), `audit must not contain personal data: ${secret}`);
    }
  });

  test("an update that changes nothing writes no audit row", async () => {
    await run(assistant, "update public.leads set first_name = first_name, assigned_to = assigned_to where id = $1", [LEAD1]);
    assert.equal((await auditRows("lead.update_contact")).length, 1);
    assert.equal((await auditRows("lead.assign")).length, 0);
  });

  test("assignment changes are audited with the previous and new assignee", async () => {
    await run(assistant, "update public.leads set assigned_to = $2 where id = $1", [LEAD1, ASSIST2]);
    await run(owner, "update public.leads set assigned_to = $2 where id = $1", [LEAD1, OWNER]);
    await run(owner, "update public.leads set assigned_to = null where id = $1", [LEAD1]);
    const rows = await auditRows("lead.assign");
    assert.deepEqual(rows.map((r) => [r.actor_id, r.details]), [
      [ASSIST, { from: null, to: ASSIST2 }],
      [OWNER, { from: ASSIST2, to: OWNER }],
      [OWNER, { from: OWNER, to: null }],
    ]);
  });

  test("status changes are recorded in the append-only history with actor; other edits are not audited", async () => {
    const auditBefore = await count("select count(*) n from public.audit_log");
    await run(assistant, "update public.leads set status = 'interested', message = 'edited', archived_at = now(), project_id = $2 where id = $1", [LEAD1, PROJ_UNPUB]);
    assert.equal(await count("select count(*) n from public.audit_log"), auditBefore);
    const h = (await su("select actor_id, from_status, to_status from public.lead_activities where lead_id = $1 and type = 'status_change'", [LEAD1])).rows;
    assert.deepEqual(h, [{ actor_id: ASSIST, from_status: "new", to_status: "interested" }]);
  });

  test("one statement changing status and phone leaves one history row and one audit row", async () => {
    const hist = await count("select count(*) n from public.lead_activities where lead_id = $1", [LEAD2]);
    const aud = await count("select count(*) n from public.audit_log where entity_id = $1", [LEAD2]);
    await run(assistant, "update public.leads set status = 'contacted', phone = '+48 611 222 333' where id = $1", [LEAD2]);
    assert.equal(await count("select count(*) n from public.lead_activities where lead_id = $1", [LEAD2]), hist + 1);
    assert.equal(await count("select count(*) n from public.audit_log where entity_id = $1", [LEAD2]), aud + 1);
  });

  test("changes made with the service role or SQL editor are audited without an actor", async () => {
    await run(service, "update public.leads set last_name = 'Changed' where id = $1", [LEAD2]);
    const rows = await auditRows("lead.update_contact");
    assert.equal(rows.at(-1).actor_id, null);
    assert.deepEqual(rows.at(-1).details, { fields: ["last_name"] });
  });

  test("assistants cannot forge, alter or remove audit records", async () => {
    await denied(assistant, "insert into public.audit_log (action, entity_type, entity_id) values ('lead.assign', 'lead', $1)", [LEAD1]);
    await denied(assistant, "update public.audit_log set actor_id = $1", [ASSIST]);
    await denied(assistant, "delete from public.audit_log");
    assert.equal((await run(assistant, "select * from public.audit_log")).rows.length, 0);
  });
});

// ---------------------------------------------------------------------------------------------
describe("operational limits are configured in one place", () => {
  before(() => freshDb());
  const setting = async (key) => (await su("select int_value v from private.settings where key = $1", [key])).rows[0]?.v;

  test("defaults are the approved 100 web leads per hour and a 10-minute duplicate window", async () => {
    assert.equal(await setting("intake.max_web_leads_per_hour"), 100);
    assert.equal(await setting("intake.duplicate_window_minutes"), 10);
  });

  test("the settings table is unreachable from every API role", async () => {
    await denied(anon, "select * from private.settings");
    for (const who of [assistant, owner, service]) {
      await denied(who, "select * from private.settings");
      await denied(who, "update private.settings set int_value = 1000");
    }
  });

  test("values outside safe bounds, unknown keys and non-numbers are refused", async () => {
    for (const sql of [
      "update private.settings set int_value = 0 where key = 'intake.max_web_leads_per_hour'",
      "update private.settings set int_value = 1001 where key = 'intake.max_web_leads_per_hour'",
      "update private.settings set int_value = 0 where key = 'intake.duplicate_window_minutes'",
      "update private.settings set int_value = 1441 where key = 'intake.duplicate_window_minutes'",
      "insert into private.settings (key, int_value) values ('intake.something_else', 5)",
    ]) {
      await assert.rejects(su(sql), (e) => e.code === "23514", sql);
    }
    await assert.rejects(su("update private.settings set int_value = 'x' where key = 'intake.max_web_leads_per_hour'"), (e) => e.code === "22P02");
  });

  test("changing a limit is audited with key and old/new value", async () => {
    await su("update private.settings set int_value = 3 where key = 'intake.max_web_leads_per_hour'");
    const a = (await su("select actor_id, entity_type, details from public.audit_log where action = 'settings.update'")).rows;
    assert.deepEqual(a, [{ actor_id: null, entity_type: "setting", details: { key: "intake.max_web_leads_per_hour", from: 100, to: 3 } }]);
  });

  test("submit_lead honours the configured hourly cap", async () => {
    const mk = (i) => `('F','L','+48 72${i}00000','cap${i}@example.com','pl','v')`;
    await su(`insert into public.leads (first_name,last_name,phone,email,locale,privacy_notice_version) values ${[1, 2, 3].map(mk)}`);
    assert.equal((await run(service, SUBMIT, submitArgs({ email: "cap-new@example.com", phone: "+48 580 000 001" }))).rows[0].r, "rate_limited");
    await su("update private.settings set int_value = 100 where key = 'intake.max_web_leads_per_hour'");
    assert.equal((await run(service, SUBMIT, submitArgs({ email: "cap-new@example.com", phone: "+48 580 000 001" }))).rows[0].r, "created");
  });

  test("submit_lead honours the configured duplicate window", async () => {
    await su("update public.leads set created_at = now() - interval '2 minutes' where email = 'cap-new@example.com'");
    const again = () => run(service, SUBMIT, submitArgs({ email: "cap-new@example.com", phone: "+48 580 000 009" }));
    assert.equal((await again()).rows[0].r, "duplicate");                       // 2 min ago, window 10
    await su("update private.settings set int_value = 1 where key = 'intake.duplicate_window_minutes'");
    assert.equal((await again()).rows[0].r, "created");                         // window now 1 min
    await su("update private.settings set int_value = 10 where key = 'intake.duplicate_window_minutes'");
  });

  test("a missing setting makes submit_lead fail closed instead of running unlimited", async () => {
    await su("delete from private.settings where key = 'intake.max_web_leads_per_hour'");
    const before = await count("select count(*) n from public.leads");
    await assertFails(service, SUBMIT, submitArgs({ email: "closed@example.com", phone: "+48 590 000 001" }), "55000");
    assert.equal(await count("select count(*) n from public.leads"), before);
  });

  test("the numbers exist in exactly one place in the migrations", () => {
    const text = readdirSync(migrationsDir).filter((n) => n.endsWith(".sql")).map((n) => readFileSync(join(migrationsDir, n), "utf8")).join("\n");
    assert.equal((text.match(/>= 100\b/g) ?? []).length, 0, "no hard-coded cap in function code");
    assert.equal((text.match(/interval '10 minutes'/g) ?? []).length, 0, "no hard-coded window in function code");
    assert.equal((text.match(/\(\s*'intake\.max_web_leads_per_hour',\s*100\)/g) ?? []).length, 1, "default defined once");
  });
});

// ---------------------------------------------------------------------------------------------
describe("function privileges are explicit", () => {
  before(() => freshDb());

  test("no function in public or private grants EXECUTE to PUBLIC", async () => {
    const r = await su(`select n.nspname || '.' || p.proname as fn
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
           lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where n.nspname in ('public','private') and a.grantee = 0 and a.privilege_type = 'EXECUTE'`);
    assert.deepEqual(r.rows, []);
  });

  test("submit_lead is not callable by anon, authenticated or PUBLIC, whatever the arguments", async () => {
    for (const who of [anon, assistant, owner, inactive]) await denied(who, SUBMIT, submitArgs());
  });

  test("every function is accounted for", async () => {
    const r = await su(`select n.nspname || '.' || p.proname as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                        where n.nspname in ('public','private') order by 1`);
    assert.deepEqual(r.rows.map((x) => x.fn), [
      "private.audit_lead_change", "private.audit_lead_delete", "private.audit_profile_change", "private.audit_project_change",
      "private.audit_settings_change", "private.is_active_staff", "private.is_owner", "private.log_lead_status_change",
      "private.protect_last_owner", "private.set_updated_at", "private.write_audit",
      "public.record_lead_export", "public.submit_lead",
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
describe("least-privilege intake role (migration 20261030110000_lead_intake_role.sql)", () => {
  const intake = { role: "lead_intake" };
  // The role is created by the migration itself, which freshDb() applies with the others.
  before(() => freshDb());

  test("it can execute submit_lead and no other function", async () => {
    const r = await su(`select n.nspname || '.' || p.proname as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                        where n.nspname in ('public','private') and has_function_privilege('lead_intake', p.oid, 'execute')`);
    assert.deepEqual(r.rows.map((x) => x.fn), ["public.submit_lead"]);
  });

  test("it cannot create objects, read settings or reach the private schema", async () => {
    await denied(intake, "create table public.zz_intake_probe (id int)");
    await denied(intake, "select * from private.settings");
    await denied(intake, "update private.settings set int_value = 1000");
  });

  test("can submit a lead and nothing else", async () => {
    assert.equal((await run(intake, SUBMIT, submitArgs({ email: "intake@example.com", phone: "+48 570 000 001" }))).rows[0].r, "created");
  });

  test("cannot read, write or delete any table, or call any other function", async () => {
    for (const t of ["leads", "profiles", "projects", "lead_activities", "audit_log"]) {
      await denied(intake, `select * from public.${t}`);
    }
    await denied(intake, "update public.leads set status = 'converted'");
    await denied(intake, "delete from public.leads");
    await denied(intake, `insert into public.leads (first_name,last_name,phone,email,locale,privacy_notice_version)
                          values ('A','B','+48 600 000 000','z@example.com','pl','v')`);
    await denied(intake, "select public.record_lead_export(1, 'all')");
    await denied(intake, "select private.is_owner()");
  });

  test("is not a member of any role and cannot bypass RLS", async () => {
    const r = (await su("select rolbypassrls, rolsuper, rolcanlogin, rolconnlimit, (select count(*) from pg_auth_members m where m.member = r.oid) as memberships from pg_roles r where rolname = 'lead_intake'")).rows[0];
    assert.deepEqual({ ...r, memberships: Number(r.memberships) }, { rolbypassrls: false, rolsuper: false, rolcanlogin: false, rolconnlimit: 5, memberships: 0 });
  });
});

// ---------------------------------------------------------------------------------------------
describe("planned MFA enforcement (supabase/planned/mfa_enforcement.sql)", () => {
  before(() => freshDb({ mfa: true }));

  test("a password-only (aal1) session sees and changes nothing, even as owner", async () => {
    for (const who of [as(ASSIST, "aal1"), as(OWNER, "aal1"), as(ASSIST), as(OWNER)]) {
      assert.equal((await run(who, "select * from public.leads")).rows.length, 0);
      assert.equal((await run(who, "select * from public.profiles")).rows.length, 0);
      assert.equal((await run(who, "update public.leads set status = 'contacted'")).affectedRows, 0);
      assert.equal((await run(who, "delete from public.leads")).affectedRows, 0);
    }
    await denied(as(ASSIST, "aal1"), "insert into public.lead_activities (lead_id, type, body, actor_id) values ($1, 'note', 'x', $2)", [LEAD1, ASSIST]);
    await denied(as(OWNER, "aal1"), "select public.record_lead_export(1, 'all')");
  });

  test("with a second factor (aal2) the normal permissions apply", async () => {
    const a2 = as(ASSIST, "aal2"), o2 = as(OWNER, "aal2");
    assert.equal((await run(a2, "select * from public.leads")).rows.length, 2);
    assert.equal((await run(a2, "delete from public.leads where id = $1", [LEAD2])).affectedRows, 0);
    assert.equal((await run(o2, "delete from public.leads where id = $1", [LEAD2])).affectedRows, 1);
    assert.equal((await run(a2, "select * from public.audit_log")).rows.length, 0);
    assert.ok((await run(o2, "select * from public.audit_log")).rows.length > 0);
  });

  test("anonymous access and the server-side intake path are unaffected", async () => {
    await denied(anon, "select * from public.leads");
    assert.equal((await run(service, SUBMIT, submitArgs({ email: "mfa@example.com", phone: "+48 560 000 001" }))).rows[0].r, "created");
  });
});
