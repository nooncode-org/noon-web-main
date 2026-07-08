/**
 * GET|POST /api/maxwell/reaper — F5-05 (auditoría 2026-07).
 *
 * Cron horario (vercel.json) que destranca pipelines fire-and-forget: studio
 * sessions colgadas, upgrade sessions colgadas, dead-letters del outbox
 * Web→App, y housekeeping (archive 30d + ventanas viejas del rate-limit).
 * Mismo patrón de auth que review-sla: Bearer CRON_SECRET (o REVIEW_API_SECRET).
 */

import { NextResponse } from "next/server";
import { runReaper } from "@/lib/maxwell/reaper";
import { log } from "@/lib/server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secrets = [process.env.REVIEW_API_SECRET, process.env.CRON_SECRET].filter(Boolean);
  if (secrets.length === 0) return process.env.NODE_ENV !== "production";

  const authHeader = request.headers.get("authorization");
  return secrets.some((secret) => authHeader === `Bearer ${secret}`);
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const report = await runReaper();
    return NextResponse.json({ message: "Reaper run complete.", report });
  } catch (error) {
    log.error("maxwell.reaper", error);
    return NextResponse.json({ message: "Reaper run failed." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
