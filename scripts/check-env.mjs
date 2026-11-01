// Checks .env.local WITHOUT printing any value. Reports only variable names and pass/fail.
//   npm run check:env
import { existsSync, readFileSync } from "node:fs";

const FILE = ".env.local";
if (!existsSync(FILE)) {
  console.log(`✖ ${FILE} not found. Copy .env.example to ${FILE} and fill it in yourself (do not paste keys into chat).`);
  process.exit(1);
}

const env = {};
for (const line of readFileSync(FILE, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !line.trimStart().startsWith("#")) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
}

let failed = false;
const ok = (msg) => console.log(`✔ ${msg}`);
const bad = (msg) => { failed = true; console.log(`✖ ${msg}`); };

const REQUIRED = ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
for (const name of REQUIRED) {
  if (env[name]) ok(`${name} is set`);
  else bad(`${name} is missing or empty`);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
if (url) {
  if (/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(url)) ok("NEXT_PUBLIC_SUPABASE_URL has the expected https://<project-ref>.supabase.co shape");
  else bad("NEXT_PUBLIC_SUPABASE_URL does not look like https://<20-char-ref>.supabase.co");
}

const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (key) {
  if (key.startsWith("sb_publishable_")) ok("public key is a publishable key");
  else if (key.startsWith("sb_secret_")) bad("public key is a SECRET key. Remove it from the browser-exposed variable immediately");
  else if (key.split(".").length === 3) {
    // Legacy JWT key: read only the `role` claim to tell anon from service_role.
    let role = "unreadable";
    try { role = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role ?? "none"; } catch {}
    if (role === "anon") ok("public key is a legacy anon key (acceptable; the publishable key is preferred)");
    else bad(`public key is a JWT with role "${role}". Only the anon/publishable key may be public`);
  } else bad("public key has an unrecognised format");
}

// No browser-exposed variable may hold a secret.
for (const [name, value] of Object.entries(env)) {
  if (!name.startsWith("NEXT_PUBLIC_")) continue;
  if (/service_role|secret|database_url|password/i.test(name) || value.startsWith("sb_secret_") || /^postgres(ql)?:\/\//.test(value))
    bad(`${name} is exposed to the browser but looks like a secret`);
}

// Server-only secrets are optional now; just note whether they exist and that they are not public.
console.log(env.SUPABASE_SECRET_KEY ? "• SUPABASE_SECRET_KEY is set (server-only; not needed until lead intake)" : "• SUPABASE_SECRET_KEY not set (fine until lead intake)");

// Lead intake: exactly one server credential, never both (docs/lead-intake-credential.md).
console.log(env.SUPABASE_TEAM_ADMIN_KEY ? "• SUPABASE_TEAM_ADMIN_KEY is set (server-only; enables team invitations)" : "• SUPABASE_TEAM_ADMIN_KEY not set (team invitations stay disabled; everything else works)");
if (env.SUPABASE_SECRET_KEY && env.LEAD_INTAKE_DATABASE_URL) bad("Both SUPABASE_SECRET_KEY and LEAD_INTAKE_DATABASE_URL are set. Configure exactly one; there is no fallback");
else if (!env.LEAD_INTAKE_DATABASE_URL) console.log("• LEAD_INTAKE_DATABASE_URL not set (Option B not configured; enquiries are refused with 503)");
else {
  // Shape checks only. Nothing from the URL is printed.
  let u = null;
  try { u = new URL(env.LEAD_INTAKE_DATABASE_URL); } catch {}
  if (!u || !/^postgres(ql)?:$/.test(u.protocol)) bad("LEAD_INTAKE_DATABASE_URL is not a postgres:// URL");
  else {
    const user = decodeURIComponent(u.username);
    if (/^lead_intake\.[a-z0-9]{20}$/.test(user)) ok("LEAD_INTAKE_DATABASE_URL user is lead_intake.<project-ref>");
    else bad("LEAD_INTAKE_DATABASE_URL user must be lead_intake.<20-char project ref> (never postgres or another role)");
    if (u.password) ok("LEAD_INTAKE_DATABASE_URL has a password"); else bad("LEAD_INTAKE_DATABASE_URL has no password");
    if (u.hostname.endsWith(".pooler.supabase.com")) ok("LEAD_INTAKE_DATABASE_URL host is the shared pooler");
    else bad("LEAD_INTAKE_DATABASE_URL host is not a *.pooler.supabase.com host (the direct host is IPv6-only)");
    if (u.port === "6543" || u.port === "5432") ok(`LEAD_INTAKE_DATABASE_URL port is ${u.port}`); else bad("LEAD_INTAKE_DATABASE_URL port should be 6543 (transaction mode) or 5432");
  }
}

// Rate limiting: which header (if any) carries the real client address from the host's trusted proxy.
if (!env.TRUSTED_PROXY_HEADER) console.log("• TRUSTED_PROXY_HEADER not set (no per-client rate limit; the per-account login limit still applies)");
else if (/^[a-z0-9-]{1,64}$/i.test(env.TRUSTED_PROXY_HEADER)) ok("TRUSTED_PROXY_HEADER is set (make sure your host overwrites this header; a client-controlled header defeats rate limiting)");
else bad("TRUSTED_PROXY_HEADER is not a valid header name");

// Turnstile: the site key is public, the secret must not be.
console.log(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? "• NEXT_PUBLIC_TURNSTILE_SITE_KEY is set" : "• NEXT_PUBLIC_TURNSTILE_SITE_KEY not set (the enquiry form stays disabled)");
console.log(env.TURNSTILE_SECRET_KEY ? "• TURNSTILE_SECRET_KEY is set (server-only)" : "• TURNSTILE_SECRET_KEY not set (enquiries are refused with 503)");

console.log("Region cannot be read from these values. Check it in the Supabase dashboard (see docs/supabase-setup.md).");
process.exit(failed ? 1 : 0);
