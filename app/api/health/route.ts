/**
 * app/api/health/route.ts
 *
 * Public minimal health endpoint. Returns HTTP 200 with `{ healthy: true }` when the
 * database round-trip succeeds, otherwise HTTP 503 with `{ healthy: false }`. No
 * service-level detail is exposed here — uptime monitors only need a pass/fail signal.
 *
 * For full per-dependency diagnostics (database, OpenAI, V0 env status), use the
 * gated endpoint at `/api/health/detail` which requires `Authorization: Bearer <secret>`.
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isDatabaseHealthy(): Promise<boolean> {
  try {
    const sql = getDb();
    await sql`SELECT 1 AS ok`;
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const healthy = await isDatabaseHealthy();

  return NextResponse.json(
    {
      service: "api",
      healthy,
      checked_at: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
