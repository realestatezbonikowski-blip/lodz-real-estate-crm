// ONE-TIME, run by the project owner in their own terminal:   npm run setup:intake
//
// Gives the `lead_intake` role a login and a strong random password, and writes the connection
// string to .env.local, WITHOUT ever printing the password or the URL.
//
//   * The password is generated here (32 random bytes) and never leaves this process except as a
//     SCRAM-SHA-256 verifier in `alter role` (exactly what psql's \password sends), so the plaintext
//     is not in any SQL statement, query history or log.
//   * The SQL goes through `supabase db query --linked` (your existing CLI login), via a temp file
//     that holds only the verifier and is deleted afterwards.
//   * Refuses to run if .env.local already has LEAD_INTAKE_DATABASE_URL (rotation is a separate,
//     deliberate step) or if it is not interactive.
//
// Use --check to validate the preconditions only; nothing is changed.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { generatePassword, scramVerifier } from "./scram.mjs";

const checkOnly = process.argv.includes("--check");
const fail = (msg) => { console.log(`✖ ${msg}`); process.exit(1); };

if (!existsSync(".env.local")) fail(".env.local not found. Create it from .env.example first.");
if (/^\s*LEAD_INTAKE_DATABASE_URL\s*=/m.test(readFileSync(".env.local", "utf8")))
  fail("LEAD_INTAKE_DATABASE_URL is already set in .env.local. This script never overwrites or rotates it.");

const ref = existsSync("supabase/.temp/project-ref") ? readFileSync("supabase/.temp/project-ref", "utf8").trim() : "";
if (!/^[a-z0-9]{20}$/.test(ref)) fail("No linked Supabase project. Run `npx supabase link` first.");
let host = "";
try { host = new URL(readFileSync("supabase/.temp/pooler-url", "utf8").trim()).hostname; } catch { /* handled below */ }
if (!host.endsWith(".pooler.supabase.com")) fail("Could not read the shared pooler host from supabase/.temp/pooler-url.");

const sh = (cmd, args) => spawnSync(cmd, args, { shell: true, encoding: "utf8" });
const q = sh("npx", ["supabase", "db", "query", "--linked", JSON.stringify("select rolcanlogin from pg_roles where rolname = 'lead_intake'"), "-o", "json"]);
const state = (q.stdout || "").match(/"rolcanlogin":\s*(true|false)/)?.[1];
if (state === undefined) fail("The lead_intake role was not found on the linked project (is the migration applied?).");
if (state === "true") fail("lead_intake can already log in. Nothing to do; this script does not rotate passwords.");

console.log(`✔ Linked project ${ref.slice(0, 4)}…${ref.slice(-4)}; role lead_intake exists and cannot log in yet.`);
console.log(`✔ Pooler host found; the URL will use port 6543 (transaction mode) and user lead_intake.<ref>.`);
if (checkOnly) { console.log("Check only: nothing was changed."); process.exit(0); }

if (!process.stdin.isTTY) fail("Run this in an interactive terminal.");
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question("Type YES to enable login for role lead_intake on this project and write the URL to .env.local: ");
rl.close();
if (answer.trim() !== "YES") fail("Cancelled. Nothing was changed.");

const password = generatePassword();
const tmp = join(tmpdir(), `intake-${Date.now()}.sql`);
writeFileSync(tmp, `alter role lead_intake with login password '${scramVerifier(password)}';\n`, { mode: 0o600 });
const run = sh("npx", ["supabase", "db", "query", "--linked", "-f", JSON.stringify(tmp)]);
rmSync(tmp, { force: true });
if (run.status !== 0) fail("Enabling login failed. No credential was written. The role is unchanged or still non-login.");

try {
  appendFileSync(".env.local", `\n# Written by scripts/setup-intake-credential.mjs. Server-only. Never commit or share.\nLEAD_INTAKE_DATABASE_URL=postgresql://lead_intake.${ref}:${password}@${host}:6543/postgres\n`);
} catch {
  // Do not leave a role with a login whose password nobody knows.
  writeFileSync(tmp, "alter role lead_intake with nologin password null;\n");
  sh("npx", ["supabase", "db", "query", "--linked", "-f", JSON.stringify(tmp)]);
  rmSync(tmp, { force: true });
  fail("Could not write .env.local; login was switched off again.");
}
console.log("✔ Login enabled for lead_intake and LEAD_INTAKE_DATABASE_URL written to .env.local (not displayed).");
console.log("Next: npm run check:env, then npm run verify:intake.");
