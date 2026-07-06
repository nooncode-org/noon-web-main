/**
 * tests/upgrade/safe-fetch.test.ts
 * Coverage for the SSRF-guarded fetch (SEC-H1, auditoría 2026-07): per-hop
 * public-address validation via DNS resolution + manual redirects. All DNS
 * and network access is stubbed through the injectable seams — no real I/O.
 */

import { describe, expect, it } from "vitest";
import {
  assertPublicHttpUrl,
  safeFetchPublicUrl,
  UnsafeUrlError,
} from "@/lib/upgrade/safe-fetch";

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];
const privateLookup = async () => [{ address: "10.0.0.5", family: 4 }];

describe("assertPublicHttpUrl — URL shape", () => {
  it("rejects non-http(s) schemes, credentials, explicit ports, malformed URLs", async () => {
    await expect(assertPublicHttpUrl("ftp://example.com", publicLookup)).rejects.toThrow(
      UnsafeUrlError
    );
    await expect(
      assertPublicHttpUrl("http://user:pass@example.com", publicLookup)
    ).rejects.toThrow(UnsafeUrlError);
    await expect(
      assertPublicHttpUrl("http://example.com:6379/", publicLookup)
    ).rejects.toThrow(UnsafeUrlError);
    await expect(assertPublicHttpUrl("not a url", publicLookup)).rejects.toThrow(
      UnsafeUrlError
    );
  });

  it("allows default ports (none, 80, 443)", async () => {
    await expect(assertPublicHttpUrl("https://example.com/x", publicLookup)).resolves.toBeTruthy();
    await expect(assertPublicHttpUrl("http://example.com:80/", publicLookup)).resolves.toBeTruthy();
    await expect(
      assertPublicHttpUrl("https://example.com:443/", publicLookup)
    ).resolves.toBeTruthy();
  });
});

describe("assertPublicHttpUrl — address validation", () => {
  it("rejects private IP literals without consulting DNS", async () => {
    const explodingLookup = async () => {
      throw new Error("lookup must not be called for IP literals");
    };
    await expect(assertPublicHttpUrl("http://127.0.0.1/", explodingLookup)).rejects.toThrow(
      UnsafeUrlError
    );
    await expect(
      assertPublicHttpUrl("http://169.254.169.254/latest/meta-data/", explodingLookup)
    ).rejects.toThrow(UnsafeUrlError);
    await expect(assertPublicHttpUrl("http://[::1]/", explodingLookup)).rejects.toThrow(
      UnsafeUrlError
    );
    // public literal passes with no lookup
    await expect(
      assertPublicHttpUrl("http://93.184.216.34/", explodingLookup)
    ).resolves.toBeTruthy();
  });

  it("rejects hostnames that RESOLVE to private space — the SEC-H1 gap", async () => {
    await expect(
      assertPublicHttpUrl("https://looks-public.example", privateLookup)
    ).rejects.toThrow(/non-public address/);
  });

  it("rejects mixed public+private DNS answers (rebinding-style split)", async () => {
    await expect(
      assertPublicHttpUrl("https://mixed.example", async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "169.254.169.254", family: 4 },
      ])
    ).rejects.toThrow(UnsafeUrlError);
  });

  it("rejects unresolvable and empty-answer hostnames", async () => {
    await expect(
      assertPublicHttpUrl("https://nope.example", async () => {
        throw new Error("ENOTFOUND");
      })
    ).rejects.toThrow(UnsafeUrlError);
    await expect(assertPublicHttpUrl("https://empty.example", async () => [])).rejects.toThrow(
      UnsafeUrlError
    );
  });

  it("still applies the literal-hostname denylist (localhost, metadata names)", async () => {
    await expect(assertPublicHttpUrl("http://localhost/", publicLookup)).rejects.toThrow(
      UnsafeUrlError
    );
    await expect(
      assertPublicHttpUrl("http://metadata.google.internal/", publicLookup)
    ).rejects.toThrow(UnsafeUrlError);
  });
});

describe("safeFetchPublicUrl — manual redirects with per-hop re-validation", () => {
  const redirectTo = (location: string, status = 302) =>
    new Response(null, { status, headers: { location } });

  it("rejects a redirect hop into private space without fetching it", async () => {
    const fetched: string[] = [];
    const fetchFn = (async (input: URL | RequestInfo) => {
      fetched.push(String(input));
      return redirectTo("http://169.254.169.254/latest/meta-data/");
    }) as typeof fetch;

    await expect(
      safeFetchPublicUrl("https://example.com/", { fetchFn, lookupFn: publicLookup })
    ).rejects.toThrow(UnsafeUrlError);
    expect(fetched).toHaveLength(1);
  });

  it("follows safe redirects (relative included) and returns the final response", async () => {
    const fetched: string[] = [];
    const fetchFn = (async (input: URL | RequestInfo) => {
      const url = String(input);
      fetched.push(url);
      if (url === "https://example.com/") return redirectTo("/moved", 301);
      return new Response("<html>final</html>", { status: 200 });
    }) as typeof fetch;

    const res = await safeFetchPublicUrl("https://example.com/", {
      fetchFn,
      lookupFn: publicLookup,
    });
    expect(res.status).toBe(200);
    expect(fetched).toEqual(["https://example.com/", "https://example.com/moved"]);
  });

  it("enforces the redirect ceiling and always fetches in manual mode", async () => {
    let redirectMode: string | undefined;
    const fetchFn = (async (_input: URL | RequestInfo, init?: RequestInit) => {
      redirectMode = init?.redirect;
      return redirectTo("https://example.com/loop");
    }) as typeof fetch;

    await expect(
      safeFetchPublicUrl("https://example.com/", { fetchFn, lookupFn: publicLookup })
    ).rejects.toThrow(/Too many redirects/);
    expect(redirectMode).toBe("manual");
  });
});
