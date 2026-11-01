import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { normalizeClientIp, trustedClientKey } from "./client-ip.ts";

const h = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null });

describe("trustedClientKey: nothing is trusted unless the deployment says so", () => {
  test("no TRUSTED_PROXY_HEADER: every client-supplied header is ignored", () => {
    const headers = h({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "6.6.6.6", "cf-connecting-ip": "6.6.6.6" });
    assert.equal(trustedClientKey(headers, {}), undefined);
    assert.equal(trustedClientKey(headers, { TRUSTED_PROXY_HEADER: "" }), undefined);
  });

  test("only the declared header is read, and only a valid IP is accepted", () => {
    const env = { TRUSTED_PROXY_HEADER: "x-real-ip" };
    assert.equal(trustedClientKey(h({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "6.6.6.6" }), env), "ip4:203.0.113.7");
    assert.equal(trustedClientKey(h({ "x-forwarded-for": "6.6.6.6" }), env), undefined, "a different header is not trusted");
    assert.equal(trustedClientKey(h({ "x-real-ip": "not-an-ip" }), env), undefined);
    assert.equal(trustedClientKey(h({ "x-real-ip": "999.1.1.1" }), env), undefined);
    assert.equal(trustedClientKey(h({}), env), undefined);
  });

  test("header name is case-insensitive and validated (no odd names accepted)", () => {
    assert.equal(trustedClientKey(h({ "cf-connecting-ip": "198.51.100.4" }), { TRUSTED_PROXY_HEADER: "CF-Connecting-IP" }), "ip4:198.51.100.4");
    assert.equal(trustedClientKey(h({}), { TRUSTED_PROXY_HEADER: "bad name!" }), undefined);
  });

  test("a forged leading entry in an x-forwarded-for list is ignored: the proxy's (last) entry wins", () => {
    const env = { TRUSTED_PROXY_HEADER: "x-forwarded-for" };
    assert.equal(trustedClientKey(h({ "x-forwarded-for": "6.6.6.6, 7.7.7.7, 203.0.113.50" }), env), "ip4:203.0.113.50");
    assert.equal(trustedClientKey(h({ "x-forwarded-for": "6.6.6.6" }), env), "ip4:6.6.6.6", "a single entry is the proxy's own");
  });
});

describe("normalizeClientIp", () => {
  test("IPv4 is kept as is", () => assert.equal(normalizeClientIp("192.0.2.1"), "ip4:192.0.2.1"));

  test("IPv6 is keyed by its /64 so one customer cannot rotate through their whole prefix", () => {
    const a = normalizeClientIp("2001:db8:abcd:12::1");
    const b = normalizeClientIp("2001:0db8:abcd:0012:ffff:ffff:ffff:ffff");
    assert.equal(a, "ip6:2001:0db8:abcd:0012/64");
    assert.equal(a, b);
    assert.notEqual(a, normalizeClientIp("2001:db8:abcd:13::1"), "a different /64 is a different client");
  });

  test("compressed forms, brackets and zone ids are handled; IPv4-mapped IPv6 maps to IPv4", () => {
    assert.equal(normalizeClientIp("::1"), "ip6:0000:0000:0000:0000/64");
    assert.equal(normalizeClientIp("[2001:db8::5]"), "ip6:2001:0db8:0000:0000/64");
    assert.equal(normalizeClientIp("fe80::1%eth0"), "ip6:fe80:0000:0000:0000/64");
    assert.equal(normalizeClientIp("::ffff:192.0.2.9"), "ip4:192.0.2.9");
  });

  test("garbage and oversized values are rejected", () => {
    for (const bad of ["", " ", "1.2.3", "1.2.3.4.5", "2001:::1", "2001:db8::g", "a".repeat(100), "1.2.3.4, 5.6.7.8"]) {
      assert.equal(normalizeClientIp(bad), undefined, JSON.stringify(bad));
    }
  });
});
