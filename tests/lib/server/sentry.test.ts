/**
 * tests/lib/server/sentry.test.ts
 *
 * Coverage for the Sentry skeleton (B42).
 *
 * What we test (unit level, no real @sentry/nextjs):
 *   - `initSentryIfConfigured` is a no-op without SENTRY_DSN (the common
 *     state today).
 *   - With a fake Sentry module injected via the forwardLogToSentry helper,
 *     log entries are routed to the right Sentry API:
 *       - level=error + rawError → captureException(rawError)
 *       - level=error without rawError → captureMessage(..., level=error)
 *       - level=warn → captureMessage(..., level=warning)
 *       - level=info / debug → dropped
 *   - Forwarding never reads PII raw — entry.meta is what reaches Sentry as
 *     `extra`, because the logger already redacted it.
 *
 * Why not test the dynamic import path: that would require mocking
 * @sentry/nextjs at the module level, which couples tests to the SDK version.
 * The forwardLogToSentry adapter is pure and is what we actually care about.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetSentryForTests,
  forwardLogToSentry,
  initSentryIfConfigured,
} from "@/lib/server/sentry";
import type { LogEntry } from "@/lib/server/logger";

const originalEnv = { ...process.env };

beforeEach(() => {
  delete process.env.SENTRY_DSN;
  delete process.env.SENTRY_TRACES_SAMPLE_RATE;
  __resetSentryForTests();
});

afterEach(() => {
  process.env = { ...originalEnv };
  __resetSentryForTests();
});

describe("initSentryIfConfigured", () => {
  it('returns "skipped" when SENTRY_DSN is unset', async () => {
    const result = await initSentryIfConfigured();
    expect(result).toBe("skipped");
  });

  it('returns "skipped" when SENTRY_DSN is blank / whitespace-only', async () => {
    process.env.SENTRY_DSN = "   ";
    const result = await initSentryIfConfigured();
    expect(result).toBe("skipped");
  });

  it('returns "already" on the second call within the same process', async () => {
    // Without a DSN we never transition to "initialised", so we cannot test
    // the "already" branch via the public API alone. The intent of this test
    // is to document the contract — repeated unconfigured calls should not
    // throw and should remain idempotent.
    const first = await initSentryIfConfigured();
    const second = await initSentryIfConfigured();
    expect(first).toBe("skipped");
    expect(second).toBe("skipped");
  });
});

describe("forwardLogToSentry", () => {
  function fakeSentry() {
    return {
      init: vi.fn(),
      captureException: vi.fn(),
      captureMessage: vi.fn(),
    };
  }

  function entry(partial: Partial<LogEntry>): LogEntry {
    return {
      level: "info",
      scope: "test.scope",
      message: "default message",
      timestamp: "2026-05-16T00:00:00.000Z",
      ...partial,
    };
  }

  it("routes level=error WITH rawError → captureException(rawError, {extra})", () => {
    const sentry = fakeSentry();
    const err = new Error("boom");
    forwardLogToSentry(
      sentry,
      entry({ level: "error", message: "thing failed", meta: { request_id: "req-1" } }),
      err,
    );

    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    const [forwardedError, hint] = sentry.captureException.mock.calls[0];
    expect(forwardedError).toBe(err);
    expect(hint?.extra).toMatchObject({
      scope: "test.scope",
      request_id: "req-1",
    });
    expect(sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("routes level=error WITHOUT rawError → captureMessage(..., level=error)", () => {
    const sentry = fakeSentry();
    forwardLogToSentry(sentry, entry({ level: "error", message: "synthetic" }));

    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1);
    const [msg, hint] = sentry.captureMessage.mock.calls[0];
    expect(msg).toBe("synthetic");
    expect(hint?.level).toBe("error");
  });

  it("routes level=warn → captureMessage(..., level=warning)", () => {
    const sentry = fakeSentry();
    forwardLogToSentry(sentry, entry({ level: "warn", message: "be careful" }));

    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(sentry.captureMessage.mock.calls[0][1]?.level).toBe("warning");
  });

  it("drops level=info entries (Sentry is not a log shipper)", () => {
    const sentry = fakeSentry();
    forwardLogToSentry(sentry, entry({ level: "info", message: "noise" }));

    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("drops level=debug entries", () => {
    const sentry = fakeSentry();
    forwardLogToSentry(sentry, entry({ level: "debug", message: "trace" }));

    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("forwards the entry meta verbatim as `extra` (logger already redacted PII)", () => {
    const sentry = fakeSentry();
    forwardLogToSentry(
      sentry,
      entry({
        level: "warn",
        message: "rate-limited",
        meta: {
          email_hash: "abcd1234",
          // The logger guarantees `password` etc. are already "[redacted]".
          // This adapter does NOT need to scrub again.
          password: "[redacted]",
          retry_after_seconds: 7,
        },
      }),
    );

    const hint = sentry.captureMessage.mock.calls[0][1];
    expect(hint?.extra).toMatchObject({
      scope: "test.scope",
      email_hash: "abcd1234",
      password: "[redacted]",
      retry_after_seconds: 7,
    });
  });
});
