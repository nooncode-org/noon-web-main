import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildPublicProposalUrl,
  buildWorkspaceUrl,
  resolvePublicBaseUrl,
} from "@/lib/maxwell/public-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolvePublicBaseUrl", () => {
  it("prefers MAXWELL_PUBLIC_BASE_URL when configured", () => {
    vi.stubEnv("MAXWELL_PUBLIC_BASE_URL", "https://noon.com/");
    expect(resolvePublicBaseUrl()).toBe("https://noon.com");
  });

  it("falls back to request origin", () => {
    const request = new Request("https://preview.noon.com/api/maxwell/review-sla");
    expect(resolvePublicBaseUrl(request)).toBe("https://preview.noon.com");
  });
});

describe("buildPublicProposalUrl", () => {
  it("builds a full proposal URL from configured env", () => {
    vi.stubEnv("MAXWELL_PUBLIC_BASE_URL", "https://noon.com");
    expect(buildPublicProposalUrl("token-123")).toBe("https://noon.com/maxwell/proposal/token-123");
  });

  it("builds from request origin when no env is configured", () => {
    const request = new Request("https://preview.noon.com/api/maxwell/review");
    expect(buildPublicProposalUrl("token-123", request)).toBe(
      "https://preview.noon.com/maxwell/proposal/token-123"
    );
  });
});

describe("buildWorkspaceUrl (B8 #3 emails)", () => {
  it("defaults to /en/maxwell/workspace/<sessionId>", () => {
    vi.stubEnv("MAXWELL_PUBLIC_BASE_URL", "https://noon.com");
    expect(buildWorkspaceUrl("sess-abc")).toBe(
      "https://noon.com/en/maxwell/workspace/sess-abc"
    );
  });

  it("honours an explicit locale option", () => {
    vi.stubEnv("MAXWELL_PUBLIC_BASE_URL", "https://noon.com");
    expect(buildWorkspaceUrl("sess-abc", { locale: "es" })).toBe(
      "https://noon.com/es/maxwell/workspace/sess-abc"
    );
  });

  it("falls back to request origin when no env is configured", () => {
    const request = new Request("https://preview.noon.com/api/maxwell/payment");
    expect(buildWorkspaceUrl("sess-1", { request })).toBe(
      "https://preview.noon.com/en/maxwell/workspace/sess-1"
    );
  });

  it("throws when no base URL can be resolved", () => {
    vi.stubEnv("MAXWELL_PUBLIC_BASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    expect(() => buildWorkspaceUrl("sess-1")).toThrow(/public base URL is required/);
  });
});
