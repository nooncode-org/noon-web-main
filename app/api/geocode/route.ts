import { NextResponse } from "next/server";

/**
 * Address autocomplete proxy for the billing form. The browser calls this
 * same-origin endpoint (CSP is `connect-src 'self'`), and we call the geocoder
 * server-side — so no CSP widening, and any future paid key (Google Places) stays
 * on the server, never shipped to the client.
 *
 * Source: Photon (OpenStreetMap) — free, no key, built for autocomplete. Photon
 * biases by proximity but (unlike Google Places `components=country:`) can't hard-
 * restrict to a country, so we do it ourselves: resolve the selected country's
 * coordinates, bias the search toward them, then FILTER results down to that
 * country. To swap for Google Places later, change only the two fetches + mapping
 * below; the response shape and the client stay identical.
 *
 * TODO(hardening): add per-IP rate limiting (consumeDistributedToken) before prod
 * so the open proxy can't be used to hammer the upstream geocoder.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PHOTON = "https://photon.komoot.io/api/";
const UA = "noon-website/1.0 (billing address autocomplete)";

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    town?: string;
    village?: string;
    district?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
};

export type GeocodeSuggestion = {
  id: string;
  primary: string;
  secondary: string;
  line1: string;
  city: string;
  state: string;
  postal: string;
  country: string;
};

/** Best-effort country → centre coords, cached per warm instance. */
const countryCoords = new Map<string, { lat: string; lon: string } | null>();

async function resolveCountryCoords(country: string) {
  const key = country.toLowerCase();
  const cached = countryCoords.get(key);
  if (cached !== undefined) return cached;
  try {
    const res = await fetch(
      `${PHOTON}?q=${encodeURIComponent(country)}&limit=1&lang=en&osm_tag=place:country`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(3500) },
    );
    if (res.ok) {
      const data = (await res.json()) as { features?: PhotonFeature[] };
      const coords = data.features?.[0]?.geometry?.coordinates;
      if (Array.isArray(coords) && coords.length === 2) {
        const value = { lat: String(coords[1]), lon: String(coords[0]) };
        countryCoords.set(key, value);
        return value;
      }
    }
  } catch {
    /* fall through */
  }
  countryCoords.set(key, null);
  return null;
}

function countryMatches(resultCountry: string, wanted: string) {
  const a = resultCountry.trim().toLowerCase();
  const b = wanted.trim().toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim().slice(0, 120);
  const country = (searchParams.get("country") ?? "").trim().slice(0, 60);
  if (query.length < 3) {
    return NextResponse.json({ results: [] as GeocodeSuggestion[] });
  }

  // Bias location: the user's selected country wins (respects their choice);
  // otherwise Vercel's edge-injected caller lat/lon; otherwise unbiased.
  let lat: string | null = null;
  let lon: string | null = null;
  if (country) {
    const cc = await resolveCountryCoords(country);
    if (cc) {
      lat = cc.lat;
      lon = cc.lon;
    }
  }
  if (!lat || !lon) {
    lat = request.headers.get("x-vercel-ip-latitude");
    lon = request.headers.get("x-vercel-ip-longitude");
  }
  const bias =
    lat && lon && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))
      ? `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
      : "";

  try {
    const upstream = await fetch(
      `${PHOTON}?q=${encodeURIComponent(query)}&limit=15&lang=en${bias}`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(4500) },
    );
    if (!upstream.ok) {
      return NextResponse.json({ results: [] as GeocodeSuggestion[] });
    }

    const data = (await upstream.json()) as { features?: PhotonFeature[] };
    const all: GeocodeSuggestion[] = (data.features ?? [])
      .map((feature, index) => {
        const p = feature.properties ?? {};
        const line1 = [p.housenumber, p.street].filter(Boolean).join(" ") || p.name || "";
        const city = p.city || p.town || p.village || p.district || p.county || "";
        const secondary = [city, p.state, p.postcode, p.country].filter(Boolean).join(", ");
        return {
          id: String(index),
          primary: p.name || line1 || query,
          secondary,
          line1: line1 || p.name || "",
          city,
          state: p.state ?? "",
          postal: p.postcode ?? "",
          country: p.country ?? "",
        };
      })
      .filter((r) => r.secondary.length > 0 && r.primary.length > 0);

    // Dedupe — Photon can return the same place more than once.
    const seen = new Set<string>();
    const deduped = all.filter((r) => {
      const key = `${r.line1}|${r.city}|${r.state}|${r.postal}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Restrict to the selected country when we have one; if that leaves nothing
    // (thin OSM coverage), fall back to the unrestricted list so it's never empty.
    const restricted = country
      ? deduped.filter((r) => countryMatches(r.country, country))
      : deduped;
    const results = (restricted.length > 0 ? restricted : deduped).slice(0, 6);

    return NextResponse.json({ results });
  } catch {
    // Upstream down / timeout / bad JSON → empty (the form still allows manual entry).
    return NextResponse.json({ results: [] as GeocodeSuggestion[] });
  }
}
