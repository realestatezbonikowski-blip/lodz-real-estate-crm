// SCRAM-SHA-256 password verifier, the same thing psql's \password computes on the client so the
// plaintext password never appears in a SQL statement (and so never in query logs or history).
//
//   verifier = SCRAM-SHA-256$<iterations>:<salt>$<StoredKey>:<ServerKey>
//
// Postgres stores a string in this exact form as-is. A malformed one would be treated as a PLAINTEXT
// password, so the format is covered by a test against the RFC 7677 vector (scram.test.mjs).
import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";

const hmac = (key, data) => createHmac("sha256", key).update(data).digest();

export function scramVerifier(password, salt = randomBytes(16), iterations = 4096) {
  const salted = pbkdf2Sync(Buffer.from(password, "utf8"), salt, iterations, 32, "sha256");
  const clientKey = hmac(salted, "Client Key");
  const storedKey = createHash("sha256").update(clientKey).digest();
  const serverKey = hmac(salted, "Server Key");
  return `SCRAM-SHA-256$${iterations}:${salt.toString("base64")}$${storedKey.toString("base64")}:${serverKey.toString("base64")}`;
}

/** URL-safe random password (no characters that need percent-encoding in a connection string). */
export function generatePassword(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}
