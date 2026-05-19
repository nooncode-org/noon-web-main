import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { maxwellSessionCookieName, maxwellSessionSchema } from "@/lib/maxwell";
import { log } from "@/lib/server/logger";
import {
  enforceRateLimit,
  rateLimitResponseInit,
  RateLimitExceededError,
  resolveClientIdentity,
} from "@/lib/server/rate-limit";
import { getMaxwellSession, upsertMaxwellSession } from "@/lib/server/noon-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sessionId = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${maxwellSessionCookieName}=`))
    ?.split("=")[1];

  const session = await getMaxwellSession(sessionId ?? null);

  return NextResponse.json(
    {
      session,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    // B21: rate-limit per client IP. 10 POSTs / 60s — session capture is bursty during
    // a single Maxwell flow but should never sustain above ~one every 6s legitimately.
    try {
      enforceRateLimit({
        namespace: "maxwell.session",
        capacity: 10,
        refillPerSec: 10 / 60,
        identityKey: resolveClientIdentity(request),
      });
    } catch (rateError) {
      if (rateError instanceof RateLimitExceededError) {
        const init = rateLimitResponseInit(rateError);
        return NextResponse.json(init.body, { status: init.status, headers: init.headers });
      }
      throw rateError;
    }

    const cookieSessionId = request.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${maxwellSessionCookieName}=`))
      ?.split("=")[1];
    const body = await request.json();
    const payload = maxwellSessionSchema.parse(body);
    const session = await upsertMaxwellSession({
      ...payload,
      sessionId: cookieSessionId ?? null,
    });

    const response = NextResponse.json(
      {
        session,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

    response.cookies.set({
      name: maxwellSessionCookieName,
      value: session.id,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "Describe the build in a bit more detail before continuing.",
          fieldErrors: error.flatten().fieldErrors,
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    log.error("maxwell.session", error);

    return NextResponse.json(
      {
        message: "Maxwell could not save your prompt right now. Please try again.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
