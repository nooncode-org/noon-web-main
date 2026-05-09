import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedViewer: vi.fn(async () => null),
}));

let isReviewAuthorizationConfigured: typeof import("@/lib/auth/review").isReviewAuthorizationConfigured;
let isReviewTeamMember: typeof import("@/lib/auth/review").isReviewTeamMember;

const ORIGINAL_ENV = { ...process.env };

beforeAll(async () => {
  const mod = await import("@/lib/auth/review");
  isReviewAuthorizationConfigured = mod.isReviewAuthorizationConfigured;
  isReviewTeamMember = mod.isReviewTeamMember;
});

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...ORIGINAL_ENV };
});

describe("review auth allowlist", () => {
  it("parses comma-separated emails", () => {
    vi.stubEnv("REVIEW_ALLOWED_EMAILS", "pm@noon.dev,ops@noon.dev");

    expect(isReviewAuthorizationConfigured()).toBe(true);
    expect(isReviewTeamMember("pm@noon.dev")).toBe(true);
    expect(isReviewTeamMember("ops@noon.dev")).toBe(true);
    expect(isReviewTeamMember("other@noon.dev")).toBe(false);
  });

  it("normalizes case and whitespace", () => {
    vi.stubEnv("REVIEW_ALLOWED_EMAILS", "  PM@noon.dev ; qa@noon.dev  ");

    expect(isReviewTeamMember("pm@noon.dev")).toBe(true);
    expect(isReviewTeamMember("QA@noon.dev")).toBe(true);
  });
});
