/**
 * tests/lib/server/logger.test.ts
 *
 * Coverage for the PII-safe structured logger.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetLogHookForTests, hashEmail, log, setLogHook, type LogEntry } from "@/lib/server/logger";

// process.env.NODE_ENV is typed as readonly in @types/node. Tests need to flip it.
function setNodeEnv(value: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

describe("hashEmail", () => {
  it("returns 8-char lowercase hex for a given email", () => {
    const result = hashEmail("foo@bar.com");
    expect(result).toMatch(/^[0-9a-f]{8}$/);
  });

  it("is deterministic for the same email (case + whitespace insensitive)", () => {
    expect(hashEmail("foo@bar.com")).toBe(hashEmail("FOO@BAR.COM"));
    expect(hashEmail("foo@bar.com")).toBe(hashEmail("  foo@bar.com  "));
  });

  it("produces different hashes for different emails", () => {
    expect(hashEmail("foo@bar.com")).not.toBe(hashEmail("baz@bar.com"));
  });
});

describe("log emission shape", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    __resetLogHookForTests();
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    logSpy.mockRestore();
    setNodeEnv(originalNodeEnv ?? "test");
    delete process.env.NOON_LOG_DEBUG;
  });

  function parsedLine(spy: ReturnType<typeof vi.spyOn>): LogEntry {
    const calls = spy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    return JSON.parse(calls[0]![0] as string) as LogEntry;
  }

  it("emits JSON with level/scope/message/timestamp on log.info", () => {
    log.info("maxwell.chat", "Session started", { sessionId: "abc" });

    const entry = parsedLine(logSpy);
    expect(entry.level).toBe("info");
    expect(entry.scope).toBe("maxwell.chat");
    expect(entry.message).toBe("Session started");
    expect(typeof entry.timestamp).toBe("string");
    expect(entry.meta).toEqual({ sessionId: "abc" });
  });

  it("routes log.warn to console.warn", () => {
    log.warn("scope", "warning message");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("routes log.error to console.error", () => {
    log.error("scope", new Error("boom"));
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("includes the error name and message under meta.error", () => {
    log.error("scope", new TypeError("invalid"));
    const entry = parsedLine(errorSpy);
    expect(entry.meta?.error).toMatchObject({ name: "TypeError", message: "invalid" });
  });

  it("includes stack in non-production", () => {
    setNodeEnv("development");
    log.error("scope", new Error("boom"));
    const entry = parsedLine(errorSpy);
    const errMeta = entry.meta?.error as { stack?: string };
    expect(typeof errMeta.stack).toBe("string");
  });

  it("omits stack in production", () => {
    setNodeEnv("production");
    log.error("scope", new Error("boom"));
    const entry = parsedLine(errorSpy);
    const errMeta = entry.meta?.error as { stack?: string };
    expect(errMeta.stack).toBeUndefined();
  });

  it("handles non-Error error inputs (string)", () => {
    log.error("scope", "plain string failure");
    const entry = parsedLine(errorSpy);
    expect((entry.meta?.error as { message?: string }).message).toBe("plain string failure");
  });

  it("handles non-Error error inputs (unknown object)", () => {
    log.error("scope", { foo: 1 });
    const entry = parsedLine(errorSpy);
    expect((entry.meta?.error as { message?: string }).message).toBe("Unknown error.");
  });
});

describe("redaction", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    __resetLogHookForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts emails in message strings to [email:<hash>]", () => {
    log.error("scope", new Error("Failed for foo@bar.com"));
    const entry = JSON.parse(errorSpy.mock.calls[0]![0] as string) as LogEntry;
    expect(entry.message).toMatch(/\[email:[0-9a-f]{8}\]/);
    expect(entry.message).not.toContain("foo@bar.com");
  });

  it("redacts emails inside meta string values", () => {
    log.info("scope", "ok", { recipient: "alice@example.com" });
    const entry = JSON.parse(
      (vi.mocked(console.log).mock.calls[0]![0] as string) ?? "{}",
    ) as LogEntry;
    expect(JSON.stringify(entry.meta)).toMatch(/\[email:[0-9a-f]{8}\]/);
    expect(JSON.stringify(entry.meta)).not.toContain("alice@example.com");
  });

  it("redacts keys whose name suggests a secret", () => {
    log.info("scope", "ok", {
      password: "p@ssw0rd",
      api_key: "sk_test_xyz",
      noon_app_webhook_secret: "abc123",
      ok_field: "visible",
    });
    const entry = JSON.parse(
      (vi.mocked(console.log).mock.calls[0]![0] as string) ?? "{}",
    ) as LogEntry;
    expect((entry.meta as Record<string, unknown>).password).toBe("[redacted]");
    expect((entry.meta as Record<string, unknown>).api_key).toBe("[redacted]");
    expect((entry.meta as Record<string, unknown>).noon_app_webhook_secret).toBe("[redacted]");
    expect((entry.meta as Record<string, unknown>).ok_field).toBe("visible");
  });

  it("redacts Bearer tokens in strings", () => {
    log.error("scope", new Error("Got Bearer abcdef1234567890XYZ from header"));
    const entry = JSON.parse(errorSpy.mock.calls[0]![0] as string) as LogEntry;
    expect(entry.message).toContain("Bearer [redacted]");
    expect(entry.message).not.toContain("abcdef1234567890");
  });

  it("redacts JWTs in strings", () => {
    const fakeJwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abc123signature";
    log.info("scope", `token=${fakeJwt}`);
    const entry = JSON.parse(
      (vi.mocked(console.log).mock.calls[0]![0] as string) ?? "{}",
    ) as LogEntry;
    expect(entry.message).toContain("[jwt:redacted]");
    expect(entry.message).not.toContain(fakeJwt);
  });

  it("recursively redacts nested meta", () => {
    log.info("scope", "ok", {
      request: {
        headers: {
          authorization: "Bearer xyz789secret",
        },
        body: {
          email: "deep@example.com",
        },
      },
    });
    const entry = JSON.parse(
      (vi.mocked(console.log).mock.calls[0]![0] as string) ?? "{}",
    ) as LogEntry;
    const reqHeaders = (entry.meta as { request: { headers: Record<string, unknown> } }).request.headers;
    expect(reqHeaders.authorization).toBe("[redacted]");
    const reqBody = (entry.meta as { request: { body: Record<string, unknown> } }).request.body;
    // The "email" key is not in the sensitive-key list, but its value matches EMAIL_PATTERN.
    expect(reqBody.email).toMatch(/\[email:[0-9a-f]{8}\]/);
  });
});

describe("debug suppression in production", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setNodeEnv(originalNodeEnv ?? "test");
    delete process.env.NOON_LOG_DEBUG;
  });

  it("emits debug logs in non-production", () => {
    setNodeEnv("development");
    log.debug("scope", "debug msg");
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("silences debug logs in production by default", () => {
    setNodeEnv("production");
    log.debug("scope", "debug msg");
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("emits debug logs in production when NOON_LOG_DEBUG=1", () => {
    setNodeEnv("production");
    process.env.NOON_LOG_DEBUG = "1";
    log.debug("scope", "debug msg");
    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});

describe("log hook", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    __resetLogHookForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    __resetLogHookForTests();
  });

  it("calls the registered hook with the log entry on every emission", () => {
    const hook = vi.fn();
    setLogHook(hook);

    log.error("scope", new Error("boom"));

    expect(hook).toHaveBeenCalledTimes(1);
    const entry = hook.mock.calls[0]![0] as LogEntry;
    expect(entry.level).toBe("error");
    expect(entry.scope).toBe("scope");
  });

  it("passes the raw error as second argument so the hook can ship the original", () => {
    const hook = vi.fn();
    setLogHook(hook);
    const original = new Error("boom");

    log.error("scope", original);

    expect(hook.mock.calls[0]![1]).toBe(original);
  });

  it("swallows hook errors so log emission never crashes the caller", () => {
    const hook = vi.fn(() => {
      throw new Error("hook exploded");
    });
    setLogHook(hook);

    expect(() => log.error("scope", new Error("boom"))).not.toThrow();
  });

  it("setLogHook(null) clears the hook", () => {
    const hook = vi.fn();
    setLogHook(hook);
    setLogHook(null);

    log.info("scope", "msg");
    expect(hook).not.toHaveBeenCalled();
  });
});
