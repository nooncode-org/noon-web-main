"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, MapPin, X } from "lucide-react";
import { countries, taxIdLabel } from "@/lib/countries";

/**
 * Billing address form with real type-ahead autocomplete.
 *
 * Flow: type into "Address" → suggestions (from our `/api/geocode` proxy →
 * Photon/OpenStreetMap) appear → picking one auto-fills line 1 / city / state /
 * postal / country below (all still editable), or "Enter address manually"
 * dismisses the dropdown. Requests are debounced and stale responses discarded.
 */

type Suggestion = {
  id: string;
  primary: string;
  secondary: string;
  line1: string;
  city: string;
  state: string;
  postal: string;
  country: string;
};

const FIELD =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-[#0056fd]/70";
const LABEL = "text-[13px] font-medium text-foreground";

export function AddressAutocomplete() {
  const [country, setCountry] = useState("United States");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [postal, setPostal] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [taxId, setTaxId] = useState("");
  const [useDifferentInvoiceName, setUseDifferentInvoiceName] = useState(false);
  const [invoiceName, setInvoiceName] = useState("");

  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqRef = useRef(0);

  useEffect(() => {
    function onDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Pre-select the caller's country by real location (IP), via /api/geo:
  // Vercel edge geo in prod, public-IP lookup locally. No browser-language guess.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/geo");
        const data = (await res.json()) as { country?: string | null };
        if (!data.country) return;
        const match = countries.find((c) => c.toLowerCase() === data.country!.toLowerCase());
        if (match) setCountry(match);
      } catch {
        /* keep the default */
      }
    })();
  }, []);

  function onAddressChange(value: string) {
    setLine1(value);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const query = value.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const reqId = ++reqRef.current;
    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/geocode?q=${encodeURIComponent(query)}&country=${encodeURIComponent(country)}`,
          );
          const data = (await res.json()) as { results?: Suggestion[] };
          if (reqRef.current === reqId) setSuggestions(data.results ?? []);
        } catch {
          if (reqRef.current === reqId) setSuggestions([]);
        } finally {
          if (reqRef.current === reqId) setLoading(false);
        }
      })();
    }, 350);
  }

  function choose(suggestion: Suggestion) {
    setLine1(suggestion.line1 || suggestion.primary);
    setCity(suggestion.city);
    setStateRegion(suggestion.state);
    setPostal(suggestion.postal);
    const match = countries.find((c) => c.toLowerCase() === suggestion.country.toLowerCase());
    if (match) setCountry(match);
    setSuggestions([]);
    setOpen(false);
  }

  const showDropdown = open && line1.trim().length >= 3;

  return (
    <div className="space-y-3">
      <div>
        <label className={LABEL}>Full name</label>
        <input className={`mt-1.5 ${FIELD}`} placeholder="Name on card" autoComplete="name" />
      </div>

      <div>
        <label className={LABEL}>Country or region</label>
        <div className="relative mt-1.5">
          <select
            className={`${FIELD} appearance-none pr-10`}
            value={country}
            onChange={(event) => setCountry(event.target.value)}
          >
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      <div ref={wrapRef}>
        <label className={LABEL}>Address</label>
        <div className="relative mt-1.5">
          <input
            className={FIELD}
            placeholder="Start typing your address"
            value={line1}
            autoComplete="off"
            onChange={(event) => onAddressChange(event.target.value)}
            onFocus={() => setOpen(true)}
          />
          {showDropdown && (
            <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
              <div className="flex items-center justify-between px-3.5 py-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  {loading && <Loader2 className="h-3 w-3 animate-spin" />}
                  Suggestions
                </span>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close suggestions">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => choose(suggestion)}
                  className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-foreground/[0.05]"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm leading-snug">
                    <span className="font-medium text-foreground">{suggestion.primary}</span>{" "}
                    <span className="text-muted-foreground">{suggestion.secondary}</span>
                  </span>
                </button>
              ))}

              {!loading && suggestions.length === 0 && (
                <p className="px-3.5 py-2.5 text-[13px] text-muted-foreground">No matches — enter it manually below.</p>
              )}

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full border-t border-border px-3.5 py-2.5 text-left text-[13px] text-muted-foreground transition-colors hover:bg-foreground/[0.05]"
              >
                Enter address manually
              </button>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className={LABEL}>Apartment, suite, etc. (optional)</label>
        <input
          className={`mt-1.5 ${FIELD}`}
          placeholder="Apt, suite, unit, etc."
          value={line2}
          onChange={(event) => setLine2(event.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Postal code</label>
          <input
            className={`mt-1.5 ${FIELD}`}
            value={postal}
            onChange={(event) => setPostal(event.target.value)}
          />
        </div>
        <div>
          <label className={LABEL}>City</label>
          <input
            className={`mt-1.5 ${FIELD}`}
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={LABEL}>State / province</label>
        <input
          className={`mt-1.5 ${FIELD}`}
          value={stateRegion}
          onChange={(event) => setStateRegion(event.target.value)}
        />
      </div>

      <div>
        <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-muted-foreground">
          <input
            type="checkbox"
            checked={useDifferentInvoiceName}
            onChange={(event) => setUseDifferentInvoiceName(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#0056fd]"
          />
          <span>Use a different name on invoices</span>
        </label>
        {useDifferentInvoiceName && (
          <input
            className={`mt-2.5 ${FIELD}`}
            placeholder="Business or invoice name"
            value={invoiceName}
            onChange={(event) => setInvoiceName(event.target.value)}
          />
        )}
      </div>

      <div>
        <label className={LABEL}>
          {taxIdLabel(country)}{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input
          className={`mt-1.5 ${FIELD}`}
          placeholder={`Business ${taxIdLabel(country)}`}
          value={taxId}
          onChange={(event) => setTaxId(event.target.value)}
        />
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground/70">
          For business invoicing. If you enter one, the name above should be your registered business
          name.
        </p>
      </div>
    </div>
  );
}
