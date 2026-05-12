/**
 * lib/upgrade/url-normalize.ts
 * Canonical URL normalization for the /upgrade module.
 *
 * Decision: normalize to detect the same session without spending a new slot.
 * Rules applied (in order):
 *   1. Trim whitespace
 *   2. Add https:// if no protocol given
 *   3. Parse with URL API (validates structure)
 *   4. Lowercase host
 *   5. Strip "www." prefix
 *   6. Strip trailing slash from pathname
 *   7. Remove tracking/irrelevant query params (utm_*, fbclid, gclid, ref, etc.)
 *   8. Strip fragment (#...)
 *   9. Return "host + pathname + remaining_params" without protocol
 *      → used as the dedup key stored in website_upgrade_session.website_url
 */

const IGNORED_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "msclkid",
  "ref",
  "referrer",
  "source",
  "_ga",
  "_gl",
  "mc_cid",
  "mc_eid",
]);

// SSRF defense — block hosts that resolve to private / loopback / link-local
// space before the crawler issues a request. The upgrade crawler runs on
// behalf of authenticated users; without this gate, an attacker could supply
// `http://169.254.169.254/...` (AWS metadata) or `http://127.0.0.1:5432/...`
// (local Postgres) and have the server fetch it on their behalf.
export function isPrivateIp(host: string): boolean {
  const lower = host.toLowerCase();

  // Internal hostnames
  if (lower === "localhost" || lower === "ip6-localhost" || lower === "ip6-loopback") {
    return true;
  }
  if (lower === "metadata.google.internal" || lower === "metadata") {
    return true;
  }
  if (
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".lan") ||
    lower.endsWith(".intranet")
  ) {
    return true;
  }

  // IPv4 literal
  const ipv4 = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a > 255 || b > 255 || Number(ipv4[3]) > 255 || Number(ipv4[4]) > 255) {
      // Invalid IPv4 — treat as suspicious
      return true;
    }
    if (a === 0) return true; // 0.0.0.0/8 "this network"
    if (a === 10) return true; // 10.0.0.0/8 private
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (AWS/GCP/Azure metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    return false;
  }

  // IPv6 literal — URL parser strips the surrounding brackets
  if (lower === "::" || lower === "::1") return true;
  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  const v4Mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4Mapped) return isPrivateIp(v4Mapped[1]);
  // Unique-local fc00::/7 (fc00 - fdff)
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;
  // Link-local fe80::/10 (fe80 - febf)
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;

  return false;
}

export type NormalizeResult =
  | { ok: true; canonical: string; full: string }
  | { ok: false; error: string };

/**
 * Normalize a user-supplied URL.
 *
 * @returns `{ ok: true, canonical, full }` on success
 *   - `canonical` — the dedup key (no protocol, cleaned)
 *   - `full`      — the full URL with https:// (use for crawling)
 * @returns `{ ok: false, error }` when the URL cannot be parsed or is invalid
 */
export function normalizeUrl(raw: string): NormalizeResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "URL cannot be empty." };

  // Add protocol if missing
  const withProtocol =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }

  // Only allow http(s)
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "Only http and https URLs are supported." };
  }

  // SSRF defense — reject private / loopback / link-local addresses
  if (isPrivateIp(parsed.hostname)) {
    return { ok: false, error: "That URL points to a private network and can't be analyzed." };
  }

  // Lowercase host, strip www.
  let host = parsed.hostname.toLowerCase();
  if (host.startsWith("www.")) host = host.slice(4);

  // Normalise pathname — strip trailing slash (keep root as "/")
  let pathname = parsed.pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  // Filter query params
  const cleanParams = new URLSearchParams();
  for (const [key, value] of parsed.searchParams.entries()) {
    if (!IGNORED_PARAMS.has(key.toLowerCase())) {
      cleanParams.set(key.toLowerCase(), value);
    }
  }

  const queryString = cleanParams.toString();
  const canonical = queryString
    ? `${host}${pathname}?${queryString}`
    : `${host}${pathname}`;

  const full = `https://${canonical}`;

  return { ok: true, canonical, full };
}
