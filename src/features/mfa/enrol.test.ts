import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { factorName, formatSecret, otpLink, qrImageSrc } from "./enrol.ts";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100"/></svg>';

describe("qrImageSrc", () => {
  test("wraps raw SVG markup in a data URI (never returns markup for DOM injection)", () => {
    const src = qrImageSrc(SVG);
    assert.ok(src?.startsWith("data:image/svg+xml;utf-8,"));
    assert.ok(!src!.includes("<svg"), "the markup itself must be percent-encoded");
  });
  test("accepts an SVG data URI as is", () => {
    const uri = "data:image/svg+xml;utf-8," + encodeURIComponent(SVG);
    assert.equal(qrImageSrc(uri), uri);
  });
  test("rejects non-SVG, scriptable and oversized content", () => {
    for (const bad of [null, undefined, 5, "", "hello", "data:text/html,<script>alert(1)</script>", "javascript:alert(1)", "https://evil.test/qr.svg", "data:image/png;base64,AAAA",
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', '<svg onload="alert(1)"></svg>', "<svg><foreignObject><div/></foreignObject></svg>",
      "data:image/svg+xml;utf-8," + encodeURIComponent('<svg><script>x</script></svg>'), "<svg>" + "a".repeat(40_000) + "</svg>"]) {
      assert.equal(qrImageSrc(bad), null, String(bad).slice(0, 40));
    }
  });
});

describe("otpLink", () => {
  test("only a totp otpauth link is accepted", () => {
    assert.equal(otpLink("otpauth://totp/Panel%20CRM:owner@example.test?secret=ABCDEFGHIJKLMNOP&issuer=Panel%20CRM"), "otpauth://totp/Panel%20CRM:owner@example.test?secret=ABCDEFGHIJKLMNOP&issuer=Panel%20CRM");
    for (const bad of [null, "", "https://evil.test", "javascript:alert(1)", "otpauth://hotp/x?secret=A", "otpauth://totp/", "otpauth://totp/a b", "otpauth://totp/" + "a".repeat(700)]) assert.equal(otpLink(bad), null, String(bad).slice(0, 30));
  });
});

describe("formatSecret", () => {
  test("groups a base32 key in fours", () => assert.equal(formatSecret("abcdefghijklmnop"), "ABCD EFGH IJKL MNOP"));
  test("rejects anything that is not a plausible base32 key", () => {
    for (const bad of [null, 5, "", "short", "0189".repeat(5), "<script>".repeat(4), "ABCD-EFGH-IJKL-MNOP"]) assert.equal(formatSecret(bad), null, String(bad));
  });
});

describe("factorName", () => {
  const at = new Date(Date.UTC(2026, 9, 30, 14, 5));
  test("default is unique per minute and carries the date", () => assert.equal(factorName("", at), "Aplikacja 2026-10-30 14:05"));
  test("user input is trimmed, collapsed, stripped of control characters and capped at 40", () => {
    assert.equal(factorName("  Telefon   służbowy \n", at), "Telefon służbowy");
    assert.equal(factorName("a\u0007b", at), "a b");
    assert.equal(factorName("x".repeat(100), at).length, 40);
    assert.equal(factorName(undefined, at), "Aplikacja 2026-10-30 14:05");
    assert.equal(factorName("\n\t ", at), "Aplikacja 2026-10-30 14:05");
  });
});
