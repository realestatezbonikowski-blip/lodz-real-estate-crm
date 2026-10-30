import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { test } from "node:test";
import { generatePassword, scramVerifier } from "./scram.mjs";

test("matches the RFC 7677 SCRAM-SHA-256 example", () => {
  // RFC 7677 section 3: user "user", password "pencil", salt W22ZaJ0SNY7soEsUEjb6gQ==, 4096 iterations.
  const v = scramVerifier("pencil", Buffer.from("W22ZaJ0SNY7soEsUEjb6gQ==", "base64"), 4096);
  const [, rest] = v.split("SCRAM-SHA-256$");
  const [params, keys] = rest.split("$");
  const [iterations, salt] = params.split(":");
  const [storedKey, serverKey] = keys.split(":");
  assert.equal(iterations, "4096");
  assert.equal(salt, "W22ZaJ0SNY7soEsUEjb6gQ==");

  const authMessage =
    "n=user,r=rOprNGfwEbeRWgbNEkqO," +
    "r=rOprNGfwEbeRWgbNEkqO%hvYDpWUa2RaTCAfuxFIlj)hNlF$k0,s=W22ZaJ0SNY7soEsUEjb6gQ==,i=4096," +
    "c=biws,r=rOprNGfwEbeRWgbNEkqO%hvYDpWUa2RaTCAfuxFIlj)hNlF$k0";

  // Server signature from the RFC.
  const serverSignature = createHmac("sha256", Buffer.from(serverKey, "base64")).update(authMessage).digest("base64");
  assert.equal(serverSignature, "6rriTRBi23WpRR/wtup+mMhUZUn/dB5nLTJRsjl95G4=");

  // Client proof from the RFC must verify against the stored key.
  const clientSignature = createHmac("sha256", Buffer.from(storedKey, "base64")).update(authMessage).digest();
  const proof = Buffer.from("dHzbZapWIk4jUhN+Ute9ytag9zjfMHgsqmmiz7AndVQ=", "base64");
  const clientKey = Buffer.from(proof.map((b, i) => b ^ clientSignature[i]));
  assert.equal(createHash("sha256").update(clientKey).digest("base64"), storedKey);
});

test("generated passwords are long, URL-safe and unique; verifiers never contain the password", () => {
  const a = generatePassword();
  const b = generatePassword();
  assert.notEqual(a, b);
  assert.ok(a.length >= 43);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  assert.ok(!scramVerifier(a).includes(a));
  assert.match(scramVerifier(a), /^SCRAM-SHA-256\$4096:[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
});
