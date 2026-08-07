/**
 * tests/maxwell/client-reference.test.ts
 *
 * Fase A · E2.4 — the client's own reference:
 *
 *   1. The SSRF guard, the security-critical half. A URL a stranger types
 *      must never reach our infrastructure: schemes, credentials, ports,
 *      literal private IPs (including the cloud-metadata address and
 *      IPv4-mapped IPv6), and hostnames that resolve to anything internal
 *      — with a multi-record host refused if ANY answer is private.
 *   2. The reading parser, which is deliberately GENEROUS: only an
 *      explicit `usable: false` means "unreadable" (owner: si más o menos
 *      se entiende, se trabaja con ella).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
import { lookup } from "node:dns/promises";

import {
  guardClientReferenceUrl,
  isPrivateAddress,
} from "@/lib/maxwell/client-reference-guard";
import { parseClientReferenceReply } from "@/lib/maxwell/client-reference";

function resolvesTo(...addresses: { address: string; family: number }[]) {
  vi.mocked(lookup).mockResolvedValue(addresses as never);
}

describe("SSRF guard — schemes, credentials, ports", () => {
  afterEach(() => vi.clearAllMocks());

  it("refuses non-http(s) schemes", async () => {
    for (const url of [
      "file:///etc/passwd",
      "data:text/html,<script>1</script>",
      "ftp://example.com/x",
    ]) {
      expect((await guardClientReferenceUrl(url)).ok, url).toBe(false);
    }
  });

  it("refuses embedded credentials", async () => {
    resolvesTo({ address: "93.184.216.34", family: 4 });
    const res = await guardClientReferenceUrl("https://admin:secret@example.com");
    expect(res).toEqual({ ok: false, reason: "credentials" });
  });

  it("refuses non-default ports (no port scanning through us)", async () => {
    resolvesTo({ address: "93.184.216.34", family: 4 });
    const res = await guardClientReferenceUrl("http://example.com:8080/x");
    expect(res).toEqual({ ok: false, reason: "port" });
  });

  it("refuses garbage that isn't a URL", async () => {
    expect((await guardClientReferenceUrl("not a url")).ok).toBe(false);
  });
});

describe("SSRF guard — literal addresses", () => {
  afterEach(() => vi.clearAllMocks());

  it("refuses every private/reserved IPv4 literal", async () => {
    for (const host of [
      "127.0.0.1",
      "10.0.0.5",
      "172.16.3.4",
      "192.168.1.1",
      "169.254.169.254", // cloud metadata — the classic SSRF target
      "100.64.0.1", // CGNAT
      "0.0.0.0",
      "255.255.255.255",
    ]) {
      const res = await guardClientReferenceUrl(`http://${host}/`);
      expect(res, host).toEqual({ ok: false, reason: "private" });
    }
    // No DNS was needed for any of them.
    expect(lookup).not.toHaveBeenCalled();
  });

  it("refuses private IPv6 literals, including IPv4-mapped ones", async () => {
    for (const host of [
      "[::1]",
      "[fc00::1]",
      "[fe80::1]",
      // Both spellings of mapped loopback: URL parsing normalizes the
      // dotted form into hex, and reading only one let loopback through.
      "[::ffff:127.0.0.1]",
      "[::ffff:7f00:1]",
      "[::ffff:a9fe:a9fe]", // 169.254.169.254 — cloud metadata, mapped
    ]) {
      const res = await guardClientReferenceUrl(`http://${host}/`);
      expect(res, host).toEqual({ ok: false, reason: "private" });
    }
  });

  it("still accepts a genuinely public IPv4-mapped address", async () => {
    const res = await guardClientReferenceUrl("http://[::ffff:93.184.216.34]/");
    expect(res.ok).toBe(true);
  });

  it("accepts a public literal address", async () => {
    const res = await guardClientReferenceUrl("https://93.184.216.34/");
    expect(res.ok).toBe(true);
  });

  it("classifies addresses by family", () => {
    expect(isPrivateAddress("10.1.2.3", 4)).toBe(true);
    expect(isPrivateAddress("93.184.216.34", 4)).toBe(false);
    expect(isPrivateAddress("::1", 6)).toBe(true);
    expect(isPrivateAddress("2606:2800:220:1:248:1893:25c8:1946", 6)).toBe(false);
  });
});

describe("SSRF guard — hostnames", () => {
  afterEach(() => vi.clearAllMocks());

  it("accepts a hostname that resolves publicly", async () => {
    resolvesTo({ address: "93.184.216.34", family: 4 });
    const res = await guardClientReferenceUrl("https://example.com/menu");
    expect(res).toEqual({ ok: true, url: "https://example.com/menu" });
  });

  it("refuses a hostname that resolves to a private address", async () => {
    resolvesTo({ address: "127.0.0.1", family: 4 });
    const res = await guardClientReferenceUrl("https://localtest.me/");
    expect(res).toEqual({ ok: false, reason: "private" });
  });

  it("refuses when ANY of several answers is private (no smuggling)", async () => {
    resolvesTo(
      { address: "93.184.216.34", family: 4 },
      { address: "169.254.169.254", family: 4 },
    );
    const res = await guardClientReferenceUrl("https://mixed.example/");
    expect(res).toEqual({ ok: false, reason: "private" });
  });

  it("refuses what it cannot resolve", async () => {
    vi.mocked(lookup).mockRejectedValue(new Error("ENOTFOUND"));
    const res = await guardClientReferenceUrl("https://nope.invalid/");
    expect(res).toEqual({ ok: false, reason: "unresolvable" });
  });
});

describe("client reference reading", () => {
  const valid = JSON.stringify({
    understood: "Veo que buscas tonos cálidos y un aire artesanal.",
    palette: ["#8a6f4d", "#f3ece2", "not-a-hex"],
    styleNotes: ["madera clara", "luz de ventana lateral"],
    notCovered: ["estructura de secciones"],
    usable: true,
  });

  it("parses a reading and drops malformed hexes", () => {
    const reading = parseClientReferenceReply(valid);
    expect(reading!.understood).toContain("artesanal");
    expect(reading!.palette).toEqual(["#8a6f4d", "#f3ece2"]);
    expect(reading!.notCovered).toEqual(["estructura de secciones"]);
    expect(reading!.usable).toBe(true);
  });

  it("tolerates markdown fences", () => {
    expect(parseClientReferenceReply("```json\n" + valid + "\n```")).not.toBeNull();
  });

  it("is generous: only an explicit false marks it unreadable", () => {
    const noFlag = JSON.stringify({ understood: "Algo cálido." });
    expect(parseClientReferenceReply(noFlag)!.usable).toBe(true);

    const explicit = JSON.stringify({ understood: "No se distingue.", usable: false });
    expect(parseClientReferenceReply(explicit)!.usable).toBe(false);
  });

  it("rejects a reply with nothing understood", () => {
    expect(parseClientReferenceReply(JSON.stringify({ understood: "" }))).toBeNull();
    expect(parseClientReferenceReply("I can't help with that.")).toBeNull();
  });
});
