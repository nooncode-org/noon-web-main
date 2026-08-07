/**
 * lib/maxwell/client-reference-guard.ts
 *
 * Fase A · E2.4 — the SSRF guard for CLIENT-SUPPLIED reference URLs
 * (docs/maxwell/fase-a-spec.md §2: "solo http/https, bloqueo de IPs
 * internas, navegador aislado, timeout duro — una URL ajena no puede
 * tocar nuestra infraestructura").
 *
 * Our own pool URLs skip this: they are a curated allowlist. Anything a
 * client types goes through here BEFORE a browser ever opens it.
 *
 * What it enforces:
 *   - scheme http/https only (no file:, data:, gopher:, javascript:)
 *   - no embedded credentials (user:pass@host)
 *   - default ports only (80/443) — no port scanning through us
 *   - every resolved address must be public: loopback, private, CGNAT,
 *     link-local, multicast, reserved and IPv6 ULA/link-local are refused
 *
 * Honest limitation: this validates at request time. A hostile DNS could
 * answer differently when the browser resolves again (DNS rebinding).
 * The remaining exposure is bounded — the capture browser is a fresh,
 * isolated context with a hard timeout, carries no cookies or creds, and
 * its output is a JPEG we never execute. Pinning the resolved IP at the
 * fetch layer is Entrega 3 hardening (tarea #42).
 */

import { lookup } from "node:dns/promises";

export type GuardResult =
  | { ok: true; url: string }
  | { ok: false; reason: "scheme" | "credentials" | "port" | "host" | "private" | "unresolvable" };

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** Parse a dotted-quad into its 4 octets, or null when it isn't one. */
function parseIPv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((p) => Number(p));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return octets;
}

function isPrivateIPv4(address: string): boolean {
  const octets = parseIPv4(address);
  if (!octets) return true; // unparseable → treat as unsafe
  const [a, b] = octets;
  if (a === 0) return true; // "this network"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

function isPrivateIPv6(address: string): boolean {
  const lower = address.toLowerCase().split("%")[0]; // drop zone id
  if (lower === "::" || lower === "::1") return true; // unspecified / loopback

  // IPv4-mapped / -compatible addresses judge their embedded v4. BOTH
  // spellings must be handled: URL parsing normalizes "::ffff:127.0.0.1"
  // into the hex form "::ffff:7f00:1", and reading only the dotted one
  // let loopback through (caught by this module's own test).
  const mapped = lower.match(/^::(?:ffff:)?(.+)$/);
  if (mapped) {
    const tail = mapped[1];
    if (/^\d+\.\d+\.\d+\.\d+$/.test(tail)) return isPrivateIPv4(tail);
    const hex = tail.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const high = parseInt(hex[1], 16);
      const low = parseInt(hex[2], 16);
      return isPrivateIPv4(
        `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`,
      );
    }
    // Anything else inside ::/8 is special-purpose space — refuse rather
    // than guess at a form we did not decode.
    return true;
  }

  if (/^f[cd]/.test(lower)) return true; // fc00::/7 unique-local
  if (/^fe[89ab]/.test(lower)) return true; // fe80::/10 link-local
  if (lower.startsWith("ff")) return true; // multicast
  return false;
}

export function isPrivateAddress(address: string, family: number): boolean {
  return family === 6 ? isPrivateIPv6(address) : isPrivateIPv4(address);
}

/**
 * Validate a client-supplied reference URL. Never throws — callers turn a
 * refusal into a calm message ("No pude acceder a tu referencia…"), never
 * into an error the client sees as a failure of theirs.
 */
export async function guardClientReferenceUrl(raw: string): Promise<GuardResult> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "host" };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return { ok: false, reason: "scheme" };
  if (url.username || url.password) return { ok: false, reason: "credentials" };
  if (url.port && url.port !== "80" && url.port !== "443") return { ok: false, reason: "port" };

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (!hostname) return { ok: false, reason: "host" };

  // A literal IP never needs DNS — judge it directly.
  const literalV4 = parseIPv4(hostname);
  if (literalV4) {
    return isPrivateIPv4(hostname) ? { ok: false, reason: "private" } : { ok: true, url: url.toString() };
  }
  if (hostname.includes(":")) {
    return isPrivateIPv6(hostname) ? { ok: false, reason: "private" } : { ok: true, url: url.toString() };
  }

  // Reject the whole host if ANY resolved address is internal — a
  // multi-A-record host must not smuggle one private answer past us.
  try {
    const addresses = await lookup(hostname, { all: true });
    if (addresses.length === 0) return { ok: false, reason: "unresolvable" };
    for (const entry of addresses) {
      if (isPrivateAddress(entry.address, entry.family)) {
        return { ok: false, reason: "private" };
      }
    }
  } catch {
    return { ok: false, reason: "unresolvable" };
  }

  return { ok: true, url: url.toString() };
}
