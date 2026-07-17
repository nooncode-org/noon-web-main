import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Best-effort country detection for the billing form's default — by real
 * LOCATION (IP), not browser language.
 *
 * - Prod (Vercel): the edge injects `x-vercel-ip-country` = the visitor's
 *   country. Authoritative, zero extra latency.
 * - Local / no edge header: look up the caller's public-IP country server-side
 *   (ipwho.is). In `next dev` the caller IS the developer's machine, so this
 *   returns their real country. Only runs when the edge header is absent, so it
 *   never adds latency in prod.
 *
 * No IP is stored or returned — only the coarse country. Country code → English
 * name via `Intl.DisplayNames`, so names line up with `lib/countries`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nameFromCode(code: string | null | undefined): string | null {
  const c = (code ?? "").toUpperCase().trim();
  if (!/^[A-Z]{2}$/.test(c)) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(c) ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const h = await headers();

  // Prod: authoritative edge geo.
  const edgeCode = (h.get("x-vercel-ip-country") ?? "").toUpperCase().trim();
  const edgeCountry = nameFromCode(edgeCode);
  if (edgeCountry) {
    return NextResponse.json({ countryCode: edgeCode, country: edgeCountry, source: "edge" });
  }

  // Local / fallback: public-IP lookup of the caller.
  try {
    const res = await fetch("https://ipwho.is/", { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = (await res.json()) as {
        success?: boolean;
        country?: string;
        country_code?: string;
      };
      if (data.success !== false) {
        const country = nameFromCode(data.country_code) ?? data.country ?? null;
        if (country) {
          return NextResponse.json({
            countryCode: data.country_code ?? null,
            country,
            source: "ip",
          });
        }
      }
    }
  } catch {
    /* fall through */
  }

  return NextResponse.json({ countryCode: null, country: null, source: "none" });
}
