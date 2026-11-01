import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { activeSchema, followUpSchema, followUpState, inviteSchema, parseFilters, passwordSchema, todayWarsaw } from "../crm/schema.ts";

const read = (p: string) => readFileSync(p, "utf8");
function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(ts|tsx)$/.test(name)) yield p;
  }
}

describe("follow-up dates", () => {
  test("todayWarsaw uses the Warsaw calendar day, not UTC", () => {
    assert.equal(todayWarsaw(new Date("2026-06-30T22:30:00Z")), "2026-07-01"); // 00:30 in Warsaw (CEST)
    assert.equal(todayWarsaw(new Date("2026-01-15T12:00:00Z")), "2026-01-15");
  });
  test("followUpState", () => {
    assert.equal(followUpState(null, "2026-11-01"), null);
    assert.equal(followUpState("2026-10-31", "2026-11-01"), "overdue");
    assert.equal(followUpState("2026-11-01", "2026-11-01"), "today");
    assert.equal(followUpState("2026-11-02", "2026-11-01"), "upcoming");
  });
  test("followUpSchema: empty clears, real dates pass, impossible dates and control characters fail", () => {
    assert.deepEqual(followUpSchema.parse({ followUpOn: "", nextAction: "" }), { followUpOn: null, nextAction: null });
    assert.deepEqual(followUpSchema.parse({ followUpOn: "2026-11-05", nextAction: " oddzwonić " }), { followUpOn: "2026-11-05", nextAction: "oddzwonić" });
    for (const bad of ["2026-02-30", "2026-13-01", "05.11.2026", "2026-11-5", "x"]) assert.equal(followUpSchema.safeParse({ followUpOn: bad, nextAction: "" }).success, false, bad);
    assert.equal(followUpSchema.safeParse({ followUpOn: "", nextAction: "a".repeat(201) }).success, false);
    assert.equal(followUpSchema.safeParse({ followUpOn: "", nextAction: "a\u0000b" }).success, false);
    assert.equal(followUpSchema.safeParse({ followUpOn: "", nextAction: "", extra: 1 }).success, false);
  });
  test("the follow-up filter is tolerant: only \"due\" is accepted", () => {
    assert.equal(parseFilters({ followup: "due" }).followUp, "due");
    assert.equal(parseFilters({ followup: "anything" }).followUp, undefined);
  });
});

describe("team input", () => {
  test("invite: e-mail is normalised and the role can NOT be supplied", () => {
    assert.deepEqual(inviteSchema.parse({ email: "  Jan.Nowak@Example.COM ", fullName: "  Jan Nowak " }), { email: "jan.nowak@example.com", fullName: "Jan Nowak" });
    assert.equal(inviteSchema.safeParse({ email: "a@b.pl", fullName: "A", role: "owner" }).success, false);
    assert.equal(inviteSchema.safeParse({ email: "not-an-email", fullName: "A" }).success, false);
    assert.equal(inviteSchema.safeParse({ email: "a@b.pl", fullName: "" }).success, false);
  });
  test("active toggle needs a uuid and a strict boolean string", () => {
    assert.deepEqual(activeSchema.parse({ userId: "11111111-1111-4111-8111-111111111111", active: "false" }), { userId: "11111111-1111-4111-8111-111111111111", active: false });
    assert.equal(activeSchema.safeParse({ userId: "x", active: "true" }).success, false);
    assert.equal(activeSchema.safeParse({ userId: "11111111-1111-4111-8111-111111111111", active: "yes" }).success, false);
  });
  test("password: 12 to 72 characters and a matching confirmation", () => {
    assert.equal(passwordSchema.safeParse({ password: "short", confirm: "short" }).success, false);
    assert.equal(passwordSchema.safeParse({ password: "a-long-enough-pass", confirm: "different-pass-1" }).success, false);
    assert.equal(passwordSchema.safeParse({ password: "a-long-enough-pass", confirm: "a-long-enough-pass" }).success, true);
  });
});

describe("team security structure", () => {
  test("every owner action starts with requireOwner(); only setPassword is session-based", () => {
    const src = read("src/features/team/actions.ts");
    for (const fn of ["inviteOpiekun", "setMemberActive"]) {
      const body = src.slice(src.indexOf(`export async function ${fn}`));
      assert.ok(/requireOwner\(\)/.test(body.slice(0, 200)), `${fn} must call requireOwner() first`);
    }
    assert.ok(/getUser\(\)/.test(src.slice(src.indexOf("export async function setPassword"))));
  });
  test("the invited role is hard-coded to the least-privileged one", () => {
    assert.ok(/role: "assistant"/.test(read("src/features/team/actions.ts")));
  });
  test("the privileged client is created only in server modules and never exposed to the browser", () => {
    for (const f of files("src")) {
      const text = read(f);
      const usesAdmin = /createTeamAdminClient|SUPABASE_TEAM_ADMIN_KEY/.test(text);
      if (!usesAdmin) continue;
      assert.ok(!/^\s*["']use client["']/.test(text), `${f} must not be a client component`);
      assert.ok(!/NEXT_PUBLIC_[A-Z_]*ADMIN/.test(text));
    }
    const allowed = ["src/lib/supabase/admin.ts", "src/features/team/actions.ts", "src/features/team/queries.ts", "src/app/admin/(app)/team/page.tsx"].map((p) => p.replace(/\//g, "\\"));
    for (const f of files("src")) {
      if (/createTeamAdminClient|SUPABASE_TEAM_ADMIN_KEY/.test(read(f)) && !f.endsWith(".test.ts")) assert.ok(allowed.some((a) => f === a || f.replace(/\\/g, "/") === a.replace(/\\/g, "/")), `${f} is not an approved user of the privileged client`);
    }
  });
  test("the team page is owner-only and the invitation route accepts only invite/recovery tokens", () => {
    assert.ok(/requireOwner\(\)/.test(read("src/app/admin/(app)/team/page.tsx")));
    const route = read("src/app/admin/auth/confirm/route.ts");
    assert.ok(/type !== "invite" && type !== "recovery"/.test(route));
  });
  test("the follow-up migration adds nullable columns only and grants nothing wider", () => {
    const sql = read("supabase/migrations/20261101090000_lead_follow_up.sql");
    assert.ok(/add column follow_up_on date/.test(sql) && /grant update \(follow_up_on, next_action\) on public\.leads/.test(sql));
    assert.ok(!/drop |disable row level|create policy|to anon/i.test(sql));
  });
});
