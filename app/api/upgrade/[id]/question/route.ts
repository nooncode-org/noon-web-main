/**
 * POST /api/upgrade/[id]/question
 * Answer a clarifying question (mode = answer_questions).
 * Also handles generating the initial questions list via GET.
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { log } from "@/lib/server/logger";
import {
  getUpgradeSessionById,
  getPagesBySessionId,
  appendQuestionAnswer,
  insertUpgradeEvent,
} from "@/lib/upgrade/repositories";
import { generateClarifyingQuestions } from "@/lib/upgrade/generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const answerSchema = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(1000),
});

// GET — return the list of generated questions for this session
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const viewer = await getAuthenticatedViewer();
    if (!viewer) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const session = await getUpgradeSessionById(id);
    if (!session || session.ownerEmail !== viewer.email) {
      return NextResponse.json({ message: "Session not found." }, { status: 404 });
    }

    const pages = await getPagesBySessionId(id);
    if (pages.length === 0) {
      return NextResponse.json(
        { message: "Website must be crawled before generating questions." },
        { status: 422 }
      );
    }

    const result = await generateClarifyingQuestions({ pages });
    if (!result.ok) {
      return NextResponse.json({ message: result.error }, { status: 500 });
    }

    return NextResponse.json({ questions: result.questions }, { status: 200 });
  } catch (error) {
    log.error("upgrade.question.get", error);
    return NextResponse.json({ message: "Failed to generate questions." }, { status: 500 });
  }
}

// POST — record a question answer
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const viewer = await getAuthenticatedViewer();
    if (!viewer) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const session = await getUpgradeSessionById(id);
    if (!session || session.ownerEmail !== viewer.email) {
      return NextResponse.json({ message: "Session not found." }, { status: 404 });
    }

    if (session.mode !== "answer_questions") {
      return NextResponse.json(
        { message: "This session is not in question-answering mode." },
        { status: 422 }
      );
    }

    // Max 5 questions
    if (session.questionsAnswers.length >= 5) {
      return NextResponse.json(
        { message: "Maximum of 5 questions reached." },
        { status: 422 }
      );
    }

    const body = await request.json();
    const { question, answer } = answerSchema.parse(body);

    await appendQuestionAnswer(id, { question, answer });

    await insertUpgradeEvent({
      sessionId: id,
      eventType: "question_answered",
      metadata: { questionIndex: session.questionsAnswers.length },
    });

    return NextResponse.json(
      { answered: session.questionsAnswers.length + 1, total: 5 },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { message: "Invalid request.", fieldErrors: error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    log.error("upgrade.question.post", error);
    return NextResponse.json({ message: "Failed to record answer." }, { status: 500 });
  }
}
