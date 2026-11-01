// Derives a rate-limit key for the calling client, but ONLY from a header that the deployment
// explicitly declares as set by its own trusted proxy.
//
// Why: `X-Forwarded-For` and friends are plain request headers. If the app is reachable directly,
// or the proxy does not overwrite them, any client can send any value and either evade a per-client
// limit (by rotating it) or frame someone else. So nothing is trusted by default:
//
//   TRUSTED_PROXY_HEADER   unset  -> no client key at all (per-client limits are skipped; the
//                                    per-account login limit and the database limits still apply)
//   TRUSTED_PROXY_HEADER=x-real-ip | cf-connecting-ip | x-vercel-forwarded-for | x-forwarded-for ...
//                                  -> the value of that header is used, if it is a valid IP
//
// If the header holds a comma-separated list (x-forwarded-for style) the LAST entry is used: it is
// the one appended by the nearest proxy, which is the only entry a client cannot forge. This assumes
// exactly one trusted proxy in front of the app; set the header your host guarantees to overwrite.
//
// IPv6 clients are keyed by their /64, because a single customer normally controls a whole /64 and
// could otherwise rotate through billions of addresses. Pure module (node:net only), unit-tested.
import { isIP } from "node:net";

function expandIpv6(address: string): string[] | undefined {
  const [addr] = address.split("%"); // drop a zone id such as fe80::1%eth0
  if (!addr) return undefined;
  const parts = addr.split("::");
  if (parts.length > 2) return undefined;
  const head = parts[0] ? parts[0].split(":") : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (parts.length === 2 ? missing < 1 : missing !== 0) return undefined;
  const groups = [...head, ...Array<string>(parts.length === 2 ? missing : 0).fill("0"), ...tail];
  if (groups.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g))) return undefined;
  return groups.map((g) => g.toLowerCase().padStart(4, "0"));
}

/** A stable key for one client address, or undefined if the value is not a valid IP. */
export function normalizeClientIp(value: string): string | undefined {
  const v = value.trim().replace(/^\[|\]$/g, "");
  if (v.length === 0 || v.length > 64) return undefined;

  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(v); // IPv4-mapped IPv6
  const candidate = mapped?.[1] ?? v;

  const family = isIP(candidate.split("%")[0] ?? "");
  if (family === 4) return `ip4:${candidate}`;
  if (family === 6) {
    const groups = expandIpv6(candidate);
    return groups ? `ip6:${groups.slice(0, 4).join(":")}/64` : undefined;
  }
  return undefined;
}

export function trustedClientKey(
  headers: { get(name: string): string | null },
  env: Record<string, string | undefined>,
): string | undefined {
  const name = env.TRUSTED_PROXY_HEADER?.trim().toLowerCase();
  if (!name || !/^[a-z0-9-]{1,64}$/.test(name)) return undefined;
  const raw = headers.get(name);
  if (!raw) return undefined;
  return normalizeClientIp(raw.split(",").pop() ?? "");
}
