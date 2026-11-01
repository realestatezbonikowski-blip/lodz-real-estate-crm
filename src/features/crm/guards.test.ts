// Structural security guards for the CRM and the proxy (static checks; no database needed).
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const actions = readFileSync("src/features/crm/actions.ts", "utf8");

describe("server actions", () => {
  // Split the module into its exported async functions (name = text up to "(", body = rest of that chunk).
  const fns = actions
    .split("export async function ")
    .slice(1)
    .map((chunk) => ({ name: chunk.slice(0, chunk.indexOf("(")), body: chunk.slice(chunk.indexOf("{") + 1) }));

  test("every exported action was found", () => {
    assert.deepEqual(fns.map((f) => f.name).sort(), ["addActivity", "assignLead", "createManualLead", "deleteLead", "setArchived", "setFollowUp", "signIn", "signOut", "updateContact", "updateLeadStatus"]);
  });

  test("every action except sign-in/out authorises the caller first", () => {
    for (const f of fns.filter((x) => !["signIn", "signOut"].includes(x.name))) {
      const firstStatement = f.body.trim().split("\n")[0]!;
      assert.match(firstStatement, /await require(Staff|Owner)\(\)/, `${f.name} must call requireStaff()/requireOwner() first`);
    }
  });

  test("deleting a lead requires the owner role", () => {
    assert.match(fns.find((f) => f.name === "deleteLead")!.body, /requireOwner\(\)/);
  });

  test("no action trusts a client-supplied actor, role or status_change", () => {
    assert.ok(!/actor_id:\s*(text|formData)/.test(actions));
    assert.ok(!/from_status|to_status/.test(actions));
    assert.ok(!/service_role|SUPABASE_SECRET_KEY|LEAD_INTAKE/.test(actions));
  });

  test("a filtered-out write is reported as a failure, not success", () => {
    for (const name of ["updateLeadStatus", "assignLead", "updateContact", "setArchived", "deleteLead"]) {
      assert.match(fns.find((f) => f.name === name)!.body, /!data\?\.length\) return NO_RIGHTS/, `${name} must treat zero affected rows as no permission`);
    }
  });
});

describe("client addresses and login limiting", () => {
  const route = readFileSync("src/app/api/leads/route.ts", "utf8");

  test("no code reads a client-supplied address header directly; only trustedClientKey does", () => {
    for (const [name, src] of [["actions.ts", actions], ["route.ts", route]] as const) {
      assert.ok(!/x-forwarded-for|x-real-ip|cf-connecting-ip/i.test(src), `${name} must not read forwarding headers itself`);
      assert.match(src, /trustedClientKey\(/, `${name} must derive the client key through trustedClientKey`);
    }
  });

  test("there is no shared fallback bucket", () => {
    for (const src of [actions, route]) assert.ok(!/["']unknown["']/.test(src), 'a literal "unknown" bucket would let anyone lock out everyone');
  });

  test("signIn goes through attemptLogin, and answers every non-success with the outcome only", () => {
    const body = actions.slice(actions.indexOf("export async function signIn"), actions.indexOf("export async function signOut"));
    assert.match(body, /attemptLogin\(/);
    assert.match(body, /redirect\(`\/admin\/login\?error=\$\{outcome\}`\)/);
    assert.ok(!/signInWithPassword/.test(body.replace(/authenticate:[\s\S]*?classifyAuthError\(error\);\n {6}\},/, "")), "signInWithPassword may only be called inside the authenticate callback");
  });

  test("the login page shows only fixed messages for the error codes", () => {
    const page = readFileSync("src/app/admin/login/page.tsx", "utf8");
    for (const code of ["invalid", "rate", "unavailable", "no-access"]) assert.match(page, new RegExp(`"?${code}"?:`), `${code} message missing`);
    assert.match(page, /error && ERRORS\[error\]/, "an unknown ?error= value must not be rendered");
  });
});

describe("admin pages", () => {
  function* pages(dir: string): Generator<string> {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) yield* pages(p);
      else if (n === "page.tsx") yield p;
    }
  }
  test("every page under the authenticated group calls requireStaff (the shell layout does too)", () => {
    const layout = readFileSync("src/app/admin/(app)/layout.tsx", "utf8");
    assert.match(layout, /requireStaff\(\)/);
    for (const p of pages("src/app/admin/(app)")) assert.match(readFileSync(p, "utf8"), /require(Staff|Owner)\(\)/, `${p} must authorise the caller itself`);
  });
  test("only the login page, the index, the two MFA screens and the invitation password page sit outside the authenticated group", () => {
    const outside = [...pages("src/app/admin")].filter((p) => !p.includes("(app)")).map((p) => p.replaceAll("\\", "/")).sort();
    assert.deepEqual(outside, ["src/app/admin/login/page.tsx", "src/app/admin/mfa/page.tsx", "src/app/admin/page.tsx", "src/app/admin/security/page.tsx", "src/app/admin/set-password/page.tsx"]);
  });
});

describe("proxy matcher", () => {
  const src = readFileSync("src/proxy.ts", "utf8");
  const start = src.indexOf("matcher: [") + "matcher: [".length;
  const literal = src.slice(start, src.indexOf("]", start)).trim(); // a quoted JS string literal
  test("is a real regex with its escaped dot intact", () => {
    assert.ok(literal);
    const pattern = JSON.parse(literal!) as string;
    assert.ok(pattern.includes("\."), "the backslash before the dot must survive string parsing");
    const re = new RegExp(`^${pattern}$`);
    for (const yes of ["/", "/projects", "/pl", "/pl/projects/radomska", "/admin", "/admin/leads"]) assert.ok(re.test(yes), `${yes} must be handled`);
    for (const no of ["/api/leads", "/_next/static/a.js", "/favicon.ico", "/icon.svg"]) assert.ok(!re.test(no), `${no} must be skipped`);
  });
});
