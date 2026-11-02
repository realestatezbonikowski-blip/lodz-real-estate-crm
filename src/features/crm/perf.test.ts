// Responsiveness of the admin panel: how many requests a page needs and which navigations reload the
// page. Pure functions with a fake database plus static checks on the source; no network, no browser.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { COUNT_SCAN_LIMIT, statusCounts } from "./queries.ts";
import { LEAD_STATUSES, type LeadFilters } from "./schema.ts";

const read = (f: string) => readFileSync(f, "utf8");
const filters: LeadFilters = { includeArchived: false, page: 1 };

/**
 * A stand-in for the Supabase client: records every request and answers like PostgREST would.
 * `cap` is the project's Max Rows setting (a response never has more rows); `count` is only sent when asked for.
 */
function fakeDb(rows: { status: string }[], opts: { fail?: boolean; cap?: number; noCount?: boolean } = {}) {
  const calls: { head: boolean; status?: string }[] = [];
  const db = {
    from() {
      return {
        select(_cols: string, o?: { head?: boolean; count?: string }) {
          const call = { head: Boolean(o?.head), status: undefined as string | undefined };
          calls.push(call);
          let limit = Infinity;
          const b: Record<string, unknown> = {};
          for (const m of ["is", "lte", "or"]) b[m] = () => b;
          b.limit = (n: number) => { limit = n; return b; };
          b.eq = (col: string, v: string) => { if (col === "status") call.status = v; return b; };
          b.then = (resolve: (v: unknown) => void) =>
            resolve(
              opts.fail ? { data: null, count: null, error: { code: "XX000" } }
              : call.head ? { data: null, count: rows.filter((r) => r.status === call.status).length, error: null }
              : { data: rows.slice(0, Math.min(limit, opts.cap ?? Infinity)), count: o?.count && !opts.noCount ? rows.length : null, error: null },
            );
          return b;
        },
      };
    },
  };
  return { db: db as never, calls };
}

describe("statusCounts: one request for the usual case, exact numbers always", () => {
  const rows = [{ status: "new" }, { status: "new" }, { status: "meeting" }, { status: "converted" }];
  const exact = (rs: { status: string }[]) => Object.fromEntries(LEAD_STATUSES.map((s) => [s, rs.filter((r) => r.status === s).length]));

  test("tallies all statuses from a single request when the response holds every matching row", async () => {
    const { db, calls } = fakeDb(rows);
    const r = await statusCounts(db, filters);
    assert.equal(calls.length, 1, "was seven head-count requests before");
    assert.ok(r.ok);
    assert.deepEqual(r.data, { new: 2, contacted: 0, interested: 0, meeting: 1, converted: 1, not_interested: 0, unreachable: 0 });
    assert.deepEqual(Object.keys(r.data), [...LEAD_STATUSES]);
  });
  test("an empty database is a real zero, not a failure", async () => {
    const r = await statusCounts(fakeDb([]).db, filters);
    assert.ok(r.ok);
    assert.ok(Object.values(r.data).every((n) => n === 0));
  });
  test("more rows than our limit: the exact per-status counts are used", async () => {
    const many = Array.from({ length: COUNT_SCAN_LIMIT + 500 }, (_, i) => ({ status: i % 3 ? "new" : "contacted" }));
    const { db, calls } = fakeDb(many);
    const r = await statusCounts(db, filters);
    assert.equal(calls.length, 1 + LEAD_STATUSES.length);
    assert.ok(r.ok);
    assert.deepEqual(r.data, exact(many));
  });
  test("REGRESSION: the project's Max Rows setting is lower than our limit (response silently cut short): still exact", async () => {
    const many = Array.from({ length: 700 }, (_, i) => ({ status: i % 7 ? "contacted" : "new" }));
    const { db, calls } = fakeDb(many, { cap: 500 });
    const r = await statusCounts(db, filters);
    assert.ok(calls.length > 1, "an incomplete response must not be tallied");
    assert.ok(r.ok);
    assert.deepEqual(r.data, exact(many), "was 72/428 instead of 100/600 before the fix");
  });
  test("no total in the response: never trust the rows alone", async () => {
    const { db, calls } = fakeDb(rows, { noCount: true });
    const r = await statusCounts(db, filters);
    assert.equal(calls.length, 1 + LEAD_STATUSES.length);
    assert.ok(r.ok);
    assert.deepEqual(r.data, exact(rows));
  });
  test("an unexpected status value is ignored safely (including names that exist on every object)", async () => {
    const odd = [{ status: "new" }, { status: "archived" }, { status: "constructor" }, { status: "__proto__" }, { status: "toString" }];
    const r = await statusCounts(fakeDb(odd).db, filters);
    assert.ok(r.ok);
    assert.equal(r.data.new, 1);
    assert.deepEqual(Object.keys(r.data), [...LEAD_STATUSES]);
    assert.ok(Object.values(r.data).every((n) => typeof n === "number" && Number.isInteger(n)));
  });
  test("a failed read is a failure, never zero counts", async () => {
    const { db } = fakeDb([], { fail: true });
    assert.equal((await statusCounts(db, filters)).ok, false);
  });
});

describe("navigation does not reload the page (structural)", () => {
  const list = read("src/features/crm/components/LeadsView.tsx");
  test("the filter form is a next/form (client-side navigation), not a plain GET form", () => {
    assert.match(list, /import Form from "next\/form"/);
    assert.match(list, /<Form action="\/admin\/leads"/);
    assert.ok(!/<form[^>]*method="get"/.test(list), "a plain GET form reloads the whole document");
  });
  test("tabs and rows are <Link>s that show a pending dot while the next page loads", () => {
    assert.match(read("src/features/crm/components/CrmNav.tsx"), /useLinkStatus/);
    assert.ok((list.match(/<LinkPending \/>/g) ?? []).length >= 5);
  });
  test("slow server actions cannot be sent twice: the sign-in and sign-out forms use SubmitButton, and forms disable while pending", () => {
    const sb = read("src/components/SubmitButton.tsx");
    assert.match(sb, /useFormStatus/);
    assert.match(sb, /disabled=\{pending\}/);
    assert.match(read("src/app/admin/login/page.tsx"), /<SubmitButton pendingLabel=\{t\("login\.submitting"\)\}>/);
    assert.match(read("src/app/admin/(app)/layout.tsx"), /<SubmitButton/);
    const forms = read("src/features/crm/components/forms.tsx");
    const buttons = forms.match(/<button className="btn[^>]*>/g) ?? [];
    for (const b of buttons) assert.match(b, /disabled=\{pending\}/, `${b} must be disabled while pending`);
  });
});

describe("fewer round trips per page (structural)", () => {
  test("the proxy validates the token locally (getClaims); the Auth-server check stays in requireStaff", () => {
    const proxy = read("src/proxy.ts");
    assert.match(proxy, /auth\.getClaims\(\)/);
    assert.ok(!/auth\.getUser\(\)/.test(proxy), "getUser() in the proxy cost one Auth round trip per page, prefetch and action");
    assert.match(read("src/features/crm/auth.ts"), /auth\.getUser\(\)/, "the authoritative check must stay");
  });
  test("the list page reads everything in one parallel batch (the owner's unassigned count is not a second step)", () => {
    const page = read("src/app/admin/(app)/leads/page.tsx");
    const batch = page.slice(page.indexOf("Promise.all(["), page.indexOf("]);", page.indexOf("Promise.all([")));
    for (const q of ["listLeads(", "statusCounts(", "listStaff(", "listProjects(", "unassignedQuery"]) assert.ok(batch.includes(q), `${q} must be in the parallel batch`);
  });
});

describe("the proxy is a convenience, not the gate (structural)", () => {
  function* pages(dir: string): Generator<string> {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) yield* pages(p);
      else if (n === "page.tsx" || n === "route.ts") yield p.replaceAll("\\", "/");
    }
  }
  test("requireStaff keeps every authoritative check: Auth-server user, MFA decision, active staff profile", () => {
    const auth = read("src/features/crm/auth.ts");
    for (const needle of ["auth.getUser()", "loadMfaState(", "decideMfaAccess(", "!profile.is_active", 'redirect("/admin/login")']) assert.ok(auth.includes(needle), `requireStaff must still contain ${needle}`);
    assert.match(read("src/features/crm/auth.ts"), /requireOwner[\s\S]*role !== "owner"/);
  });
  test("every admin page outside the (app) group validates the session with the Auth server itself (getUser), none trusts the proxy", () => {
    const outside = [...pages("src/app/admin")].filter((p) => !p.includes("(app)") && !p.endsWith("auth/confirm/route.ts") && !p.endsWith("admin/login/page.tsx") && !p.endsWith("admin/page.tsx"));
    assert.ok(outside.length >= 3, outside.join(","));
    for (const p of outside) {
      const src = read(p);
      assert.ok(/requireMfaSession\(\)|auth\.getUser\(\)/.test(src), `${p} must check the session itself`);
    }
    assert.match(read("src/features/mfa/session.ts"), /loadMfaState\(/);
    assert.match(read("src/features/mfa/state.ts"), /auth\.getUser\(\)/);
  });
  test("the language action is the only server action without a session check, and it can only choose between two whitelisted values", () => {
    const withoutGate = ["src/features/admin-prefs/actions.ts"];
    for (const f of withoutGate) {
      const src = read(f);
      assert.ok(!/supabase|\.from\(|cookies\(\)\.get|headers\(\)/.test(src.replace(/\/\/.*$/gm, "")), `${f} must touch no data`);
      assert.match(src, /parseLang\(value\)/);
    }
  });
  test("the one-time-token route is the only unauthenticated admin handler besides the login page", () => {
    const proxy = read("src/proxy.ts");
    assert.match(proxy, /pathname !== "\/admin\/login" && !pathname\.startsWith\("\/admin\/auth\/"\)/);
    assert.match(read("src/app/admin/auth/confirm/route.ts"), /type !== "invite" && type !== "recovery"/);
  });
});

describe("error screen (structural)", () => {
  test("Try again fetches the page from the server again; reset() alone would only replay the cached server error", () => {
    const src = read("src/app/admin/(app)/error.tsx");
    assert.match(src, /router\.refresh\(\)/);
    assert.match(src, /reset\(\)/);
    assert.match(src, /startTransition/);
  });
  test("the onboarding hint treats a failed count as unknown, never as zero", () => {
    const page = read("src/app/admin/(app)/leads/page.tsx");
    assert.match(page, /unassigned && !unassigned\.error && typeof unassigned\.count === "number" \? unassigned\.count : null/);
    const view = read("src/features/crm/components/LeadsView.tsx");
    assert.match(view, /unassignedTotal !== null &&/);
    assert.match(view, /isOwner && staffKnown/);
  });
});

describe("error screen (structural)", () => {
  test("Try again fetches the page from the server again; reset() alone would only replay the cached server error", () => {
    const src = read("src/app/admin/(app)/error.tsx");
    assert.match(src, /router\.refresh\(\)/);
    assert.match(src, /reset\(\)/);
    assert.match(src, /startTransition/);
  });
  test("the onboarding hint treats a failed count as unknown, never as zero", () => {
    const page = read("src/app/admin/(app)/leads/page.tsx");
    assert.match(page, /unassigned && !unassigned\.error && typeof unassigned\.count === "number" \? unassigned\.count : null/);
    const view = read("src/features/crm/components/LeadsView.tsx");
    assert.match(view, /unassignedTotal !== null &&/);
    assert.match(view, /isOwner && staffKnown/);
  });
});
