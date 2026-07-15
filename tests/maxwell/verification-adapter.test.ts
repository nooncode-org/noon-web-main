/**
 * verification-adapter — the minimal Auth.js adapter for email magic-link.
 * Asserts: verification tokens are stored/consumed verbatim (core pre-hashes),
 * useVerificationToken is delete-returning and does NOT filter by expires,
 * users are virtual (id === email), the null-user lookups that keep Google
 * safe, and the loud session-method stubs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock("@/lib/server/db", () => ({ getDb: () => mocks.sql }));

import {
  createVerificationTokenAdapter,
  sweepExpiredVerificationTokens,
} from "@/lib/auth/verification-adapter";

const adapter = createVerificationTokenAdapter();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sql.mockResolvedValue([]);
});

describe("verification-adapter", () => {
  it("createVerificationToken inserts the (already-hashed) token verbatim and echoes it", async () => {
    const token = {
      identifier: "user@work.com",
      token: "sha256hexhash",
      expires: new Date("2030-01-01T00:00:00.000Z"),
    };
    const result = await adapter.createVerificationToken!(token);
    expect(result).toEqual(token);
    const args = mocks.sql.mock.calls[0];
    expect(args).toContain("user@work.com");
    expect(args).toContain("sha256hexhash");
    expect(args).toContain("2030-01-01T00:00:00.000Z");
  });

  it("useVerificationToken returns the deleted row and never filters by expires", async () => {
    mocks.sql.mockResolvedValueOnce([
      { identifier: "user@work.com", token: "h", expires: new Date("2030-01-01") },
    ]);
    const found = await adapter.useVerificationToken!({ identifier: "user@work.com", token: "h" });
    expect(found).toMatchObject({ identifier: "user@work.com", token: "h" });
    // No `expires <`/`>` comparison in the SQL — core checks expiry itself.
    const query = (mocks.sql.mock.calls[0][0] as string[]).join(" ? ");
    expect(query).not.toMatch(/expires\s*[<>]/i);
    expect(query).toMatch(/delete/i);
    expect(query).toMatch(/returning/i);
  });

  it("useVerificationToken returns null on a miss", async () => {
    mocks.sql.mockResolvedValueOnce([]);
    expect(await adapter.useVerificationToken!({ identifier: "x", token: "y" })).toBeNull();
  });

  it("createUser keys the user by email (discards core's random id)", async () => {
    const u = await adapter.createUser!({
      id: "random-uuid",
      email: "user@work.com",
      emailVerified: null,
    });
    expect(u.id).toBe("user@work.com");
    expect(u.email).toBe("user@work.com");
  });

  it("getUser / getUserByEmail / getUserByAccount always return null (keeps Google safe)", async () => {
    expect(await adapter.getUser!("anything")).toBeNull();
    expect(await adapter.getUserByEmail!("user@work.com")).toBeNull();
    expect(
      await adapter.getUserByAccount!({ provider: "google", providerAccountId: "1" }),
    ).toBeNull();
  });

  it("database session methods throw (unsupported under jwt strategy)", async () => {
    await expect(adapter.createSession!({} as never)).rejects.toThrow(/database sessions/i);
    await expect(adapter.deleteSession!("s")).rejects.toThrow(/database sessions/i);
  });

  it("sweepExpiredVerificationTokens returns the deleted count", async () => {
    mocks.sql.mockResolvedValueOnce([{ count: "7" }]);
    expect(await sweepExpiredVerificationTokens()).toBe(7);
  });
});
