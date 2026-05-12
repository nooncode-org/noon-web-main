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

const PRIVATE_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "0.0.0.0",
  "127.0.0.1",
  "::1",
]);

export type NormalizeResult =
  | { ok: true; canonical: string; full: string }
  | { ok: false; error: string };

function isPrivateIPv4(host: string) {
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

function isBlockedHost(host: string) {
  const normalized = host.toLowerCase().replace(/^\[(.*)\]$/, "$1");
  return (
    PRIVATE_HOSTNAMES.has(normalized) ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    normalized.endsWith(".lan") ||
    isPrivateIPv4(normalized)
  );
}

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

  // Lowercase host, strip www.
  let host = parsed.hostname.toLowerCase();
  if (host.startsWith("www.")) host = host.slice(4);

  if (isBlockedHost(host)) {
    return { ok: false, error: "Private, local, and internal URLs are not supported." };
  }

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
