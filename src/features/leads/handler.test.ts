// Unit tests for the enquiry pipeline, schema, rate limiter, Turnstile verifier and credential rule.
// Run: npm run test:unit   (Node's built-in type stripping; no network, no database)
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { resolveIntakeMode } from "./config.ts";
import { handleLeadSubmission, InvalidProjectError, type Deps, type SubmitLeadParams, type SubmitOutcome } from "./handler.ts";
import { leadSchema, sanitiseReferrer } from "./schema.ts";
import { createRateLimiter } from "../../lib/security/rate-limit.ts";
import { createTurnstileVerifier } from "../../lib/security/turnstile.ts";

const ORIGIN = "https://example.test";
const valid = {
  firstName: "Jan",
  lastName: "Kowalski",
  phone: "+48 570 123 456",
  email: "Jan@Example.com ",
  locale: "pl",
  turnstileToken: "token",
};

function setup(over: Partial<Deps> = {}, outcome: SubmitOutcome | Error = "created") {
  const calls: SubmitLeadParams[] = [];
  const events: string[] = [];
  const deps: Deps = {
    allowedOrigin: ORIGIN,
    privacyNoticeVersion: "placeholder-0",
    submitter: {
      async submit(p) {
        calls.push(p);
        if (outcome instanceof Error) throw outcome;
        return outcome;
      },
    },
    verifyTurnstile: async () => "ok",
    limiter: createRateLimiter({ windowMs: 60_000, max: 100, maxKeys: 10 }),
    onEvent: (e) => events.push(e),
    ...over,
  };
  const send = (body: unknown, origin: string | null = ORIGIN, key = "k") =>
    handleLeadSubmission(deps, { origin, clientKey: key, bodyText: typeof body === "string" ? body : JSON.stringify(body) });
  // No trusted client address known (TRUSTED_PROXY_HEADER unset): the request carries no clientKey.
  const sendWithoutClientKey = (body: unknown) =>
    handleLeadSubmission(deps, { origin: ORIGIN, bodyText: JSON.stringify(body) });
  return { calls, events, send, sendWithoutClientKey };
}

describe("lead pipeline", () => {
  test("valid enquiry is normalised and submitted with server-side notice version", async () => {
    const { calls, send } = setup();
    const r = await send({ ...valid, referrer: "https://a.example/page?token=secret#x" });
    assert.deepEqual(r, { status: 200, body: { status: "ok" }, retryAfterSec: undefined });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.email, "jan@example.com");
    assert.equal(calls[0]!.referrer, "https://a.example/page"); // query and fragment dropped
    assert.equal(calls[0]!.privacyNoticeVersion, "placeholder-0"); // never taken from the client
    assert.equal(calls[0]!.projectSlug, null);
  });

  test("duplicate looks identical to created", async () => {
    const a = await setup({}, "created").send(valid);
    const b = await setup({}, "duplicate").send(valid);
    assert.deepEqual(a, b);
  });

  test("database cap is NOT shown as success and raises an alert event", async () => {
    const { send, events } = setup({}, "rate_limited");
    const r = await send(valid);
    assert.equal(r.status, 503);
    assert.deepEqual(r.body, { status: "unavailable" });
    assert.deepEqual(events, ["rate_limited_by_database"]);
  });

  test("wrong or missing Origin is refused before anything else", async () => {
    const { send, calls } = setup();
    assert.equal((await send(valid, "https://evil.test")).status, 403);
    assert.equal((await send(valid, null)).status, 403);
    assert.equal(calls.length, 0);
  });

  test("no configured site origin fails closed", async () => {
    assert.equal((await setup({ allowedOrigin: null }).send(valid)).status, 503);
  });

  test("honeypot: fake success, nothing stored, Turnstile not called", async () => {
    let verified = 0;
    const { send, calls } = setup({ verifyTurnstile: async () => (verified++, "ok") });
    const r = await send({ ...valid, website: "http://spam.example" });
    assert.deepEqual(r.body, { status: "ok" });
    assert.equal(calls.length, 0);
    assert.equal(verified, 0);
  });

  test("invalid input returns field names only, never values", async () => {
    const { send, calls } = setup();
    const r = await send({ ...valid, email: "not-an-email", phone: "abc", firstName: "Jan\u0007" });
    assert.equal(r.status, 422);
    assert.deepEqual(r.body, { status: "invalid", fields: ["firstName", "phone", "email"] });
    assert.ok(!JSON.stringify(r.body).includes("not-an-email"));
    assert.equal(calls.length, 0);
  });

  test("unknown fields are rejected (strict schema)", async () => {
    assert.equal((await setup().send({ ...valid, status: "converted" })).status, 422);
  });

  test("malformed, non-object and oversized bodies", async () => {
    const { send } = setup();
    assert.equal((await send("{nope")).status, 400);
    assert.equal((await send("[]")).status, 400);
    assert.equal((await send("null")).status, 400);
    assert.equal((await send({ ...valid, message: "x".repeat(20_000) })).status, 413);
  });

  test("Turnstile failure and Turnstile outage both block; neither reaches the database", async () => {
    const failed = setup({ verifyTurnstile: async () => "failed" });
    assert.equal((await failed.send(valid)).status, 400);
    const down = setup({ verifyTurnstile: async () => "error" });
    assert.equal((await down.send(valid)).status, 503);
    assert.equal(failed.calls.length + down.calls.length, 0);
  });

  test("no submitter configured: 503 after validation, nothing stored, no fallback", async () => {
    const { send, events } = setup({ submitter: null });
    assert.equal((await send(valid)).status, 503);
    assert.deepEqual(events, ["intake_unavailable"]);
  });

  test("invalid project maps to 422; other errors to 503 without leaking details", async () => {
    assert.deepEqual((await setup({}, new InvalidProjectError()).send({ ...valid, projectSlug: "nope" })).body, { status: "invalid_project" });
    const boom = setup({}, new Error("password authentication failed for user lead_intake"));
    const r = await boom.send(valid);
    assert.equal(r.status, 503);
    assert.ok(!JSON.stringify(r).includes("password"));
    assert.deepEqual(boom.events, ["submit_error"]);
  });

  test("per-client rate limit answers 429 with Retry-After", async () => {
    const { send } = setup({ limiter: createRateLimiter({ windowMs: 60_000, max: 2, maxKeys: 10 }) });
    assert.equal((await send(valid)).status, 200);
    assert.equal((await send(valid)).status, 200);
    const third = await send(valid);
    assert.equal(third.status, 429);
    assert.ok((third.retryAfterSec ?? 0) >= 1);
    assert.equal((await send(valid, ORIGIN, "other")).status, 200); // other clients unaffected
  });

  test("with no trusted client address the per-client limit is skipped: there is no shared bucket anyone could exhaust", async () => {
    const { sendWithoutClientKey, calls } = setup({ limiter: createRateLimiter({ windowMs: 60_000, max: 1, maxKeys: 10 }) });
    for (let i = 0; i < 10; i++) assert.equal((await sendWithoutClientKey(valid)).status, 200);
    assert.equal(calls.length, 10);
  });
});

describe("schema", () => {
  test("mirrors table constraints at the edges", () => {
    assert.ok(leadSchema.safeParse(valid).success);
    assert.ok(!leadSchema.safeParse({ ...valid, message: "a\u0001b" }).success); // control char
    assert.ok(leadSchema.safeParse({ ...valid, message: "line1\nline2\ttab" }).success); // newline/tab allowed
    assert.ok(!leadSchema.safeParse({ ...valid, message: "x".repeat(2001) }).success);
    assert.ok(!leadSchema.safeParse({ ...valid, locale: "de" }).success);
    assert.ok(!leadSchema.safeParse({ ...valid, projectSlug: "Bad Slug" }).success);
    assert.ok(!leadSchema.safeParse({ ...valid, landingPath: "no-slash" }).success);
    assert.ok(!leadSchema.safeParse({ ...valid, firstName: "   " }).success);
    assert.equal(leadSchema.parse({ ...valid, message: "   " }).message, undefined);
  });

  test("referrer sanitising", () => {
    assert.equal(sanitiseReferrer("https://a.example/p?q=1#f"), "https://a.example/p");
    assert.equal(sanitiseReferrer("javascript:alert(1)"), undefined);
    assert.equal(sanitiseReferrer("garbage"), undefined);
  });
});

describe("rate limiter", () => {
  test("window resets and memory stays bounded", () => {
    const l = createRateLimiter({ windowMs: 1000, max: 1, maxKeys: 3 });
    assert.ok(l.check("a", 0).allowed);
    assert.ok(!l.check("a", 10).allowed);
    assert.ok(l.check("a", 1001).allowed); // new window
    for (let i = 0; i < 50; i++) l.check(`k${i}`, 2000);
    assert.ok(l.check("fresh", 2000).allowed);
  });
});

describe("turnstile verifier", () => {
  const verifier = (impl: typeof fetch, secret: string | undefined = "s") => createTurnstileVerifier(secret, impl);
  const json = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });

  test("only an explicit success passes", async () => {
    assert.equal(await verifier(json({ success: true }))("t"), "ok");
    assert.equal(await verifier(json({ success: false }))("t"), "failed");
    assert.equal(await verifier(json({ success: "true" }))("t"), "failed");
    assert.equal(await verifier(json({}))("t"), "failed");
  });

  test("errors, outages and missing secret never pass", async () => {
    assert.equal(await verifier(json({ success: true }, 500))("t"), "error");
    assert.equal(await verifier(async () => { throw new Error("network"); })("t"), "error");
    assert.equal(await createTurnstileVerifier(undefined, json({ success: true }))("t"), "error");
  });

  test("sends the secret and token, but no client address", async () => {
    let sent = "";
    await verifier(async (_url, init) => { sent = String(init?.body); return new Response("{}"); })("tok");
    const p = new URLSearchParams(sent);
    assert.equal(p.get("response"), "tok");
    assert.equal(p.get("secret"), "s");
    assert.equal(p.get("remoteip"), null);
  });
});

describe("intake credential rule", () => {
  test("exactly one credential; both or neither is unusable; no fallback", () => {
    assert.equal(resolveIntakeMode({}), "none");
    assert.equal(resolveIntakeMode({ LEAD_INTAKE_DATABASE_URL: "x" }), "option-b");
    assert.equal(resolveIntakeMode({ SUPABASE_SECRET_KEY: "x" }), "option-a");
    assert.equal(resolveIntakeMode({ LEAD_INTAKE_DATABASE_URL: "x", SUPABASE_SECRET_KEY: "y" }), "conflict");
  });
});
