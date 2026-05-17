import { NextResponse } from "next/server";
import { processProposalReviewSla } from "@/lib/maxwell/proposal-review-sla";
import { resolvePublicBaseUrl } from "@/lib/maxwell/public-url";
import { log } from "@/lib/server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const result = await processProposalReviewSla({
      publicBaseUrl: resolvePublicBaseUrl(request),
    });

    return NextResponse.json({
      message: "Proposal review SLA processed.",
      result,
    });
  } catch (error) {
    log.error("maxwell.review-sla", error);
    return NextResponse.json(
      { message: "Could not process proposal review SLA right now." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
