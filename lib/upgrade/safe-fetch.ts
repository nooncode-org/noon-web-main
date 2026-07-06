/**
 * lib/upgrade/safe-fetch.ts
 * SSRF-guarded fetch for the /upgrade crawler (SEC-H1, auditoría 2026-07).
 *
 * The pre-existing gate (`isPrivateIp` on the URL's literal hostname at
 * normalize time) misses two attack paths:
 *   1. A public hostname that RESOLVES to private space (DNS-based SSRF) —
 *      the hostname string looks fine, the connection lands on 10.x/127.x.
 *   2. `redirect: "follow"` — a public site 302ing to
 *      http://169.254.169.254/... was followed silently.
 *
 * This module closes both: every hop (initial URL + each redirect) must be
 * http(s) on a default port, carry no credentials, and EVERY address its
 * hostname resolves to must be public unicast. Redirects are followed
 * manually (max 3) so each hop is re-validated before it is fetched.
 *
 * Accepted residual: the actual fetch re-resolves DNS, so a rebinding
 * attacker flipping sub-second TTLs has a race window. Closing it requires
 * pinning the connection to the validated IP (undici Agent with a custom
 * lookup) — add that if/when undici becomes a direct dependency.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isPrivateIp } from "./url-normalize";

const MAX_REDIRECTS = 3;

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

type LookupFn = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

const defaultLookup: LookupFn = (hostname) => lookup(hostname, { all: true, verbatim: true });

/**
 * Validates that a URL is a public http(s) endpoint. Throws UnsafeUrlError.
 * `isPrivateIp` covers both IP literals and the internal-hostname denylist
 * (localhost, *.local, metadata.google.internal, …); non-literal hostnames
 * are additionally resolved and every returned address must be public.
 */
export async function assertPublicHttpUrl(
  rawUrl: string | URL,
  lookupFn: LookupFn = defaultLookup
): Promise<URL> {
  let url: URL;
  try {
    url = typeof rawUrl === "string" ? new URL(rawUrl) : rawUrl;
  } catch {
    throw new UnsafeUrlError("Invalid URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsafeUrlError("Only http(s) URLs can be fetched.");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs with embedded credentials are not allowed.");
  }
  // Default ports only — an explicit port is internal-service probing
  // (redis :6379, postgres :5432, …), not a website.
  if (url.port !== "" && url.port !== "80" && url.port !== "443") {
    throw new UnsafeUrlError("Non-default ports are not allowed.");
  }

  const bareHost = url.hostname.replace(/^\[|\]$/g, "");
  if (isPrivateIp(bareHost)) {
    throw new UnsafeUrlError("The URL points to a non-public address.");
  }
  if (isIP(bareHost)) {
    return url; // public IP literal — nothing to resolve
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookupFn(bareHost);
  } catch {
    throw new UnsafeUrlError("The URL hostname could not be resolved.");
  }
  if (addresses.length === 0) {
    throw new UnsafeUrlError("The URL hostname could not be resolved.");
  }
  if (addresses.some(({ address }) => isPrivateIp(address))) {
    throw new UnsafeUrlError("The URL resolves to a non-public address.");
  }

  return url;
}

export type SafeFetchOptions = {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Test seams. */
  fetchFn?: typeof fetch;
  lookupFn?: LookupFn;
};

/**
 * Fetch a user-controlled URL with SSRF protection: redirects are followed
 * manually (up to 3) and EVERY hop is re-validated — a public site 302ing to
 * metadata/localhost is rejected, never fetched.
 */
export async function safeFetchPublicUrl(
  rawUrl: string,
  options: SafeFetchOptions = {}
): Promise<Response> {
  const { fetchFn = fetch, lookupFn, signal, headers } = options;

  let current = await assertPublicHttpUrl(rawUrl, lookupFn);

  for (let hop = 0; ; hop++) {
    const res = await fetchFn(current, { signal, headers, redirect: "manual" });

    const location = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !location) {
      return res;
    }

    res.body?.cancel().catch(() => {});
    if (hop >= MAX_REDIRECTS) {
      throw new UnsafeUrlError("Too many redirects.");
    }

    let next: URL;
    try {
      next = new URL(location, current);
    } catch {
      throw new UnsafeUrlError("The URL redirects to an invalid location.");
    }
    current = await assertPublicHttpUrl(next, lookupFn);
  }
}
