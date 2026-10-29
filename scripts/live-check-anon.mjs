// ANONYMOUS-ONLY live checks against the Supabase Data API. NOT run yet; run it only after the
// dev migration has been applied and you have decided to test:   npm run live:anon
//
// It uses ONLY the publishable key from .env.local, the same key every visitor's browser would
// have. It prints status codes and PASS/FAIL, never the key or response bodies. It writes
// nothing: the one POST is to a function that must be refused, with obviously empty input.
//
// What it cannot check: anything that needs a logged-in staff member (RLS for assistant/owner).
// Those are checked with test accounts in a later, separate step.

import { existsSync, readFileSync } from "node:fs";

if (!existsSync(".env.local")) {
  console.log("✖ .env.local not found. Nothing was sent.");
  process.exit(1);
}
const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !line.trimStart().startsWith("#")) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
}
const base = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!base || !key || key.startsWith("sb_secret_")) {
  console.log("✖ Need NEXT_PUBLIC_SUPABASE_URL and a publishable key (never a secret key). Nothing was sent.");
  process.exit(1);
}
console.log(`Target: ${new URL(base).host.replace(/^[^.]+/, "<project-ref>")}  (anonymous requests only)\n`);

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
let failed = false;

async function check(name, method, path, body, acceptable) {
  let status = "network-error";
  try {
    const res = await fetch(base + path, { method, headers, body: body && JSON.stringify(body) });
    status = res.status;
  } catch { /* leave as network-error */ }
  const ok = acceptable.includes(status);
  if (!ok) failed = true;
  console.log(`${ok ? "✔ PASS" : "✖ FAIL"}  ${name}  -> HTTP ${status}  (expected one of ${acceptable.join("/")})`);
}

// Tables: anonymous must be refused. 401/403 = permission denied. A 200 would mean the table is
// readable (even an empty array reveals grants exist), so it fails.
for (const t of ["leads", "profiles", "projects", "lead_activities", "audit_log"]) {
  await check(`read ${t}`, "GET", `/rest/v1/${t}?select=id&limit=1`, undefined, [401, 403]);
}
await check("insert a lead directly", "POST", "/rest/v1/leads", {}, [401, 403]);
// Functions: refused for anon. 404 is also acceptable (not visible at all).
await check("call submit_lead", "POST", "/rest/v1/rpc/submit_lead", {}, [401, 403, 404]);
await check("call record_lead_export", "POST", "/rest/v1/rpc/record_lead_export", {}, [401, 403, 404]);
// Private schema functions must not exist as endpoints at all.
await check("call private helper is_owner", "POST", "/rest/v1/rpc/is_owner", {}, [404]);

console.log(failed ? "\n✖ At least one check failed. Do not proceed; investigate." : "\n✔ All anonymous checks passed. Record this in docs/security-review-phase-1b.md.");
process.exit(failed ? 1 : 0);
