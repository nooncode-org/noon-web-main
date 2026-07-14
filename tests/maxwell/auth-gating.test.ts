import { describe, expect, it } from "vitest";
import { buildSignInHref, normalizeInternalRedirect } from "@/lib/auth/redirect";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";

describe("normalizeInternalRedirect", () => {
  it("keeps valid internal paths", () => {
    expect(normalizeInternalRedirect("/studio?prompt=test")).toBe(
      "/studio?prompt=test",
    );
  });

  it("rejects external urls", () => {
    expect(normalizeInternalRedirect("https://evil.example")).toBe("/studio");
    expect(normalizeInternalRedirect("//evil.example")).toBe("/studio");
  });

  it("falls back when missing", () => {
    expect(normalizeInternalRedirect(undefined, "/signin")).toBe("/signin");
  });
});

describe("buildSignInHref", () => {
  it("preserves redirect target in query string", () => {
    expect(buildSignInHref("/studio?prompt=test")).toBe(
      "/signin?redirectTo=%2Fstudio%3Fprompt%3Dtest",
    );
  });
});

describe("viewerOwnsStudioSession", () => {
  it("matches the owner email case-insensitively", () => {
    expect(
      viewerOwnsStudioSession(
        { email: "owner@noon.dev" },
        { ownerEmail: "Owner@Noon.dev" },
      ),
    ).toBe(true);
  });

  it("rejects sessions without an owner", () => {
    expect(
      viewerOwnsStudioSession(
        { email: "owner@noon.dev" },
        { ownerEmail: null },
      ),
    ).toBe(false);
  });
});
