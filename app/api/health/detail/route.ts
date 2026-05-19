/**
 * app/api/health/detail/route.ts
 *
 * Gated health endpoint with per-dependency diagnostics (database, OpenAI, V0).
 * Requires `Authorization: Bearer <REVIEW_API_SECRET or CRON_SECRET>` in production.
 * In non-production, when no secrets are configured, the gate is open so local dev
 * + CI can still introspect without setting env vars.
 *
 * The unauthenticated public health signal lives at `/api/health`.
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ServiceHealth = {
  healthy: boolean;
  latency_ms?: number;
  error_code?: string | null;
  message?: string;
};

function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const maybeCode = "code" in error ? (error as { code?: unknown }).code : null;
  return typeof maybeCode === "string" ? maybeCode : null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Unknown error.";
}

/**
 * Gate policy:
 * - When at least one of REVIEW_API_SECRET / CRON_SECRET is configured, require a
 *   matching `Authorization: Bearer <secret>` header.
 * - When neither is configured AND NODE_ENV is not "production", allow access (dev / CI
 *   convenience).
 * - When neither is configured AND NODE_ENV is "production", deny (closed by default in prod).
 */
function isAuthorized(request: Request): boolean {
  const secrets = [process.env.REVIEW_API_SECRET, process.env.CRON_SECRET]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));

  if (secrets.length === 0) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;
  return secrets.some((secret) => authHeader === `Bearer ${secret}`);
}

async function checkDatabase(): Promise<ServiceHealth> {
  const startedAt = Date.now();
  try {
    const sql = getDb();
    await sql`SELECT 1 AS ok`;
    return { healthy: true, latency_ms: Date.now() - startedAt };
  } catch (error) {
    return {
      healthy: false,
      latency_ms: Date.now() - startedAt,
      error_code: getErrorCode(error),
      message: getErrorMessage(error),
    };
  }
}

function checkRequiredEnv(name: string): ServiceHealth {
  if (process.env[name]?.trim()) {
    return { healthy: true };
  }
  return {
    healthy: false,
    error_code: "MISSING_ENV",
    message: `${name} is not configured.`,
  };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { message: "Unauthorized.", code: "AUTH_REQUIRED" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const checkedAt = new Date().toISOString();
  const database = await checkDatabase();
  const openai = checkRequiredEnv("OPENAI_API_KEY");
  const v0 = checkRequiredEnv("V0_API_KEY");

  const healthy = database.healthy && openai.healthy && v0.healthy;

  return NextResponse.json(
    {
      service: "api",
      healthy,
      checked_at: checkedAt,
      dependencies: {
        database,
        openai,
        v0,
      },
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
