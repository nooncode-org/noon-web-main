import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { contactInbox, contactSubmissionRequestSchema } from "@/lib/contact";
import { log } from "@/lib/server/logger";
import { assessContactSubmission } from "@/lib/server/contact-abuse";
import { saveContactLead } from "@/lib/server/noon-storage";

export const runtime = "nodejs";

function buildSuccessResponse(lead?: { id: string; inquiry: string; createdAt: string }, status = 201) {
  return NextResponse.json(
    {
      success: true,
      lead: lead
        ? {
            id: lead.id,
            inquiry: lead.inquiry,
            createdAt: lead.createdAt,
          }
        : null,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const payload = contactSubmissionRequestSchema.parse(await request.json());
    const submissionAssessment = await assessContactSubmission({
      email: payload.email,
      brief: payload.brief,
      startedAt: payload.startedAt ?? null,
      honeypotValue: payload.companyWebsite,
      headers: request.headers,
    });

    if (submissionAssessment.outcome === "accept_ignored") {
      return buildSuccessResponse(undefined, 202);
    }

    if (submissionAssessment.outcome === "block") {
      return NextResponse.json(
        {
          success: false,
          message: submissionAssessment.message,
        },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(submissionAssessment.retryAfterSeconds),
          },
        }
      );
    }

    const lead = await saveContactLead(payload, submissionAssessment.metadata);

    return buildSuccessResponse(lead);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Please review the form fields and try again.",
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

    log.error("contact.submit", error);

    return NextResponse.json(
      {
        success: false,
        message:
          `Your inquiry could not be sent right now. Please try again in a moment or contact us directly at ${contactInbox}.`,
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
