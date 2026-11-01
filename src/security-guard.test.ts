// Guards that server-only credentials are not referenced from browser code.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const FORBIDDEN = /SUPABASE_SECRET_KEY|SUPABASE_TEAM_ADMIN_KEY|SERVICE_ROLE|LEAD_INTAKE_DATABASE_URL|TURNSTILE_SECRET_KEY|sb_secret_/i;
const SERVER_ONLY_MODULES = /lib\/security\/turnstile|features\/leads\/handler|features\/leads\/config/;

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(ts|tsx)$/.test(name)) yield p;
  }
}

test('no "use client" file references a server credential or imports a server-only module', () => {
  let checked = 0;
  for (const f of files("src")) {
    const text = readFileSync(f, "utf8");
    if (!/^\s*["']use client["']/.test(text)) continue;
    checked++;
    assert.ok(!FORBIDDEN.test(text), `${f} references a server-only credential name`);
    assert.ok(!SERVER_ONLY_MODULES.test(text), `${f} imports a server-only module`);
  }
  assert.ok(checked >= 2, "expected to find the client components");
});
