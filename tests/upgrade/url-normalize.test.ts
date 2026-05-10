import { describe, expect, it } from "vitest";
import { isPrivateIp, normalizeUrl } from "@/lib/upgrade/url-normalize";

describe("normalizeUrl — happy path", () => {
  it("adds https when no protocol is given", () => {
    const r = normalizeUrl("noon.com");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.full).toBe("https://noon.com/");
  });

  it("lowercases host and strips www.", () => {
    const r = normalizeUrl("https://WWW.Example.COM");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.canonical).toBe("example.com/");
  });

  it("strips trailing slash from non-root pathname (keeps root)", () => {
    const a = normalizeUrl("https://noon.com/about/");
    const b = normalizeUrl("https://noon.com/");
    expect(a.ok && a.canonical).toBe("noon.com/about");
    expect(b.ok && b.canonical).toBe("noon.com/");
  });

  it("removes tracking params and lowercases keys", () => {
    const r = normalizeUrl("https://noon.com/page?UTM_source=x&product=42&fbclid=abc");
    expect(r.ok && r.canonical).toBe("noon.com/page?product=42");
  });

  it("strips the fragment", () => {
    const r = normalizeUrl("https://noon.com/page#section");
    expect(r.ok && r.canonical).toBe("noon.com/page");
  });

  it("rejects empty input", () => {
    const r = normalizeUrl("   ");
    expect(r.ok).toBe(false);
  });

  it("rejects malformed URL", () => {
    const r = normalizeUrl("http://");
    expect(r.ok).toBe(false);
  });
});

describe("isPrivateIp — IPv4 reserved ranges (SSRF defense)", () => {
  it.each([
    ["127.0.0.1", "loopback"],
    ["127.255.255.254", "loopback edge"],
    ["10.0.0.1", "private 10/8"],
    ["10.255.255.255", "private 10/8 edge"],
    ["172.16.0.1", "private 172.16/12 low"],
    ["172.31.255.254", "private 172.16/12 high"],
    ["192.168.1.1", "private 192.168/16"],
    ["169.254.169.254", "AWS metadata"],
    ["169.254.0.1", "link-local low"],
    ["0.0.0.0", "this-network 0/8"],
    ["100.64.0.1", "CGNAT 100.64/10 low"],
    ["100.127.255.254", "CGNAT 100.64/10 high"],
  ])("blocks %s (%s)", (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });
});

describe("isPrivateIp — IPv4 public ranges (must NOT block)", () => {
  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "172.15.0.1", // outside 172.16/12
    "172.32.0.1", // outside 172.16/12
    "169.253.0.1", // outside 169.254/16
    "100.63.255.254", // outside CGNAT
    "100.128.0.1", // outside CGNAT
    "192.167.1.1", // outside 192.168/16
  ])("allows %s", (ip) => {
    expect(isPrivateIp(ip)).toBe(false);
  });
});

describe("isPrivateIp — internal hostnames", () => {
  it.each([
    "localhost",
    "LOCALHOST",
    "ip6-localhost",
    "metadata.google.internal",
    "host.local",
    "server.internal",
    "host.lan",
    "host.intranet",
  ])("blocks %s", (host) => {
    expect(isPrivateIp(host)).toBe(true);
  });

  it("does NOT block a normal hostname", () => {
    expect(isPrivateIp("noon.com")).toBe(false);
    expect(isPrivateIp("api.example.org")).toBe(false);
  });
});

describe("isPrivateIp — IPv6 reserved ranges", () => {
  it.each([
    ["::1", "loopback"],
    ["::", "unspecified"],
    ["fc00:1::1", "ULA fc00::/7"],
    ["fd00:abcd::1", "ULA fd00"],
    ["fe80::1", "link-local fe80::/10"],
    ["::ffff:127.0.0.1", "v4-mapped loopback"],
    ["::ffff:10.0.0.1", "v4-mapped private"],
  ])("blocks %s (%s)", (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it.each([["2001:db8::1"], ["::ffff:8.8.8.8"]])("allows public IPv6 %s", (ip) => {
    expect(isPrivateIp(ip)).toBe(false);
  });
});

describe("normalizeUrl — SSRF integration", () => {
  it.each([
    "http://localhost/admin",
    "http://127.0.0.1:5432/",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.5/",
    "http://192.168.1.1/router",
    "http://metadata.google.internal/computeMetadata/",
    "http://internal.local/",
  ])("rejects %s", (url) => {
    const r = normalizeUrl(url);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/private network/i);
  });

  it("accepts a regular public URL", () => {
    const r = normalizeUrl("https://noon.com/");
    expect(r.ok).toBe(true);
  });
});
