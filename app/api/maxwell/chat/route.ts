import { NextResponse } from "next/server";
import { z } from "zod";
import { chatWithOpenAI, type ChatMessage } from "@/lib/api-ia";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import {
  createStudioSession,
  getStudioSession,
  updateStudioSessionStatus,
  appendStudioMessage,
  getStudioMessagesForOpenAI,
  getStudioMessage,
  getStudioMessages,
  appendStudioEvent,
  type StudioMessage,
  type MessageType,
} from "@/lib/maxwell/repositories";
import { canReceiveMessage } from "@/lib/maxwell/state-machine";
import {
  MAXWELL_CHAT_POST_PROPOSAL_APPENDIX,
  MAXWELL_CHAT_SYSTEM_PROMPT,
} from "@/lib/maxwell/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const READY_TOKEN = "[READY_FOR_PROTOTYPE]";
const PROJECT_NAME_REGEX = /\[PROJECT_NAME:\s*([^\]]+)\]/;
const PROJECT_TYPE_REGEX =
  /\[PROJECT_TYPE:\s*(web_landing|ecommerce|webapp_system|mobile|saas_ai_automation)\s*\]/i;
const COMPLEXITY_REGEX = /\[COMPLEXITY:\s*(bajo|medio|alto)\s*\]/i;

type ValidProjectType =
  | "web_landing"
  | "ecommerce"
  | "webapp_system"
  | "mobile"
  | "saas_ai_automation";
type ValidComplexity = "bajo" | "medio" | "alto";

function extractSignals(raw: string): {
  clean: string;
  readyForPrototype: boolean;
  projectName: string | null;
  projectType: ValidProjectType | null;
  complexityHint: ValidComplexity | null;
  thinkingHint: string | null;
} {
  const readyForPrototype = raw.includes(READY_TOKEN);
  const projectNameMatch = PROJECT_NAME_REGEX.exec(raw);
  const projectTypeMatch = PROJECT_TYPE_REGEX.exec(raw);
  const complexityMatch = COMPLEXITY_REGEX.exec(raw);

  let thinkingHint: string | null = null;
  let clean = raw;

  const thinkMatch = /<think>([\s\S]*?)<\/think>/i.exec(raw);
  if (thinkMatch) {
    thinkingHint = thinkMatch[1].trim();
    clean = clean.replace(thinkMatch[0], "");
  }

  clean = clean
    .replace(READY_TOKEN, "")
    .replace(PROJECT_NAME_REGEX, "")
    .replace(PROJECT_TYPE_REGEX, "")
    .replace(COMPLEXITY_REGEX, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return {
    clean,
    readyForPrototype,
    projectName: projectNameMatch ? projectNameMatch[1].trim() : null,
    projectType: projectTypeMatch
      ? (projectTypeMatch[1].toLowerCase() as ValidProjectType)
      : null,
    complexityHint: complexityMatch
      ? (complexityMatch[1].toLowerCase() as ValidComplexity)
      : null,
    thinkingHint,
  };
}

const chatRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(4000).optional(),
    session_id: z.string().optional(),
    prompt: z.string().trim().min(1).max(4000).optional(),
    image_url: z.string().url().optional(),
    reply_to_message_id: z.string().min(1).optional(),
    regenerate_assistant_message_id: z.string().min(1).optional(),
  })
  .refine((data) => data.message || data.prompt, {
    message: "Either 'message' or 'prompt' is required.",
  })
  .refine((data) => !(data.reply_to_message_id && data.regenerate_assistant_message_id), {
    message: "Reply and regenerate cannot be used together.",
  });

function toUiType(messageType: MessageType): "thinking" | "system_event" | undefined {
  if (messageType === "thinking") return "thinking";
  if (
    messageType === "system_event" ||
    messageType === "prototype_announcement"
  ) {
    return "system_event";
  }
  return undefined;
}

function toUiMessage(message: StudioMessage) {
  const type = toUiType(message.messageType);
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    ...(type ? { type } : {}),
    ...(message.feedback ? { feedback: message.feedback } : {}),
  };
}

function isAbortLikeError(error: unknown) {
  return (
    error instanceof DOMException && error.name === "AbortError"
  ) || (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

function isDatabaseConnectivityError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const maybeCode = "code" in error ? (error as { code?: unknown }).code : undefined;
  if (typeof maybeCode === "string") {
    return [
      "CONNECT_TIMEOUT",
      "ECONNREFUSED",
      "ECONNRESET",
      "ENOTFOUND",
      "ETIMEDOUT",
      "57P01",
    ].includes(maybeCode);
  }

  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return /connect_timeout|econnrefused|econnreset|enotfound|etimedout/i.test(message);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = chatRequestSchema.parse(body);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { message: "OpenAI API key is not configured." },
        { status: 503 },
      );
    }

    const viewer = await getAuthenticatedViewer();
    if (!viewer) {
      return NextResponse.json(
        { message: "Authentication required." },
        { status: 401 },
      );
    }

    const userText = (parsed.message ?? parsed.prompt)!;

    let session = null;
    if (parsed.session_id) {
      session = await getStudioSession(parsed.session_id);
      if (!session) {
        return NextResponse.json({ message: "Session not found." }, { status: 404 });
      }
      if (!viewerOwnsStudioSession(viewer, session)) {
        return NextResponse.json({ message: "Forbidden." }, { status: 403 });
      }
    } else {
      session = await createStudioSession({
        initialPrompt: userText,
        ownerEmail: viewer.email,
        ownerName: viewer.name,
        ownerImage: viewer.image,
      });
    }

    if (session.status === "generating_prototype") {
      session = await updateStudioSessionStatus(session.id, "clarifying");
    } else if (session.status === "revision_requested") {
      session = await updateStudioSessionStatus(session.id, "prototype_ready");
    }

    if (!canReceiveMessage(session.status)) {
      return NextResponse.json(
        {
          message: `Session is in state "${session.status}" and cannot receive messages.`,
        },
        { status: 409 },
      );
    }

    if (session.status === "intake") {
      session = await updateStudioSessionStatus(session.id, "clarifying");
    }

    let replyContextMessage: StudioMessage | null = null;
    if (parsed.reply_to_message_id) {
      replyContextMessage = await getStudioMessage(parsed.reply_to_message_id);
      if (!replyContextMessage || replyContextMessage.studioSessionId !== session.id) {
        return NextResponse.json({ message: "Reply target not found." }, { status: 404 });
      }
      if (replyContextMessage.role !== "assistant" || replyContextMessage.messageType !== "chat") {
        return NextResponse.json({ message: "Reply target must be a Maxwell response." }, { status: 400 });
      }
    }

    let regenerateSourceMessage: StudioMessage | null = null;
    if (parsed.regenerate_assistant_message_id) {
      regenerateSourceMessage = await getStudioMessage(parsed.regenerate_assistant_message_id);
      if (!regenerateSourceMessage || regenerateSourceMessage.studioSessionId !== session.id) {
        return NextResponse.json({ message: "Regenerate target not found." }, { status: 404 });
      }
      if (regenerateSourceMessage.role !== "assistant" || regenerateSourceMessage.messageType !== "chat") {
        return NextResponse.json({ message: "Regenerate target must be a Maxwell response." }, { status: 400 });
      }
    }

    let userMessage: StudioMessage | undefined;
    if (!regenerateSourceMessage) {
      userMessage = await appendStudioMessage({
        studioSessionId: session.id,
        role: "user",
        content: userText,
        messageType: "chat",
      });
    }

    let historyForOpenAI: ChatMessage[];
    if (regenerateSourceMessage) {
      const dbMessages = await getStudioMessages(session.id);
      const targetIndex = dbMessages.findIndex((message) => message.id === regenerateSourceMessage?.id);
      const latestAssistantMessage = dbMessages
        .filter((message) => message.role === "assistant" && message.messageType === "chat")
        .at(-1);

      if (latestAssistantMessage?.id !== regenerateSourceMessage.id) {
        return NextResponse.json(
          { message: "Only the latest Maxwell response can be regenerated." },
          { status: 409 },
        );
      }

      historyForOpenAI = dbMessages
        .slice(0, Math.max(0, targetIndex))
        .filter((message) => message.role !== "system" && message.messageType === "chat")
        .map((message) => ({
          role: message.role as "user" | "assistant",
          content: message.content,
        }));
    } else {
      const dbHistory = await getStudioMessagesForOpenAI(session.id);
      historyForOpenAI = dbHistory.slice(0, -1) as ChatMessage[];
    }

    const promptForOpenAI = replyContextMessage
      ? `The user is replying to this previous Maxwell response:\n"${replyContextMessage.content}"\n\nUser reply:\n${userText}`
      : regenerateSourceMessage
        ? `Regenerate your previous response to the user's last request. Keep the same project context, improve clarity, and avoid repeating the exact same wording.\n\nPrevious response:\n"${regenerateSourceMessage.content}"\n\nUser request:\n${userText}`
        : userText;

    const postProposalChat =
      session.status === "proposal_pending_review" || session.status === "proposal_sent";
    const systemPrompt = postProposalChat
      ? MAXWELL_CHAT_SYSTEM_PROMPT + MAXWELL_CHAT_POST_PROPOSAL_APPENDIX
      : MAXWELL_CHAT_SYSTEM_PROMPT;

    const { reply: rawReply } = await chatWithOpenAI({
      prompt: promptForOpenAI,
      history: historyForOpenAI,
      systemPrompt,
      ...(parsed.image_url ? { imageUrl: parsed.image_url } : {}),
      signal: request.signal,
    });

    const {
      clean,
      readyForPrototype,
      projectName,
      projectType,
      complexityHint,
      thinkingHint,
    } = extractSignals(rawReply);

    const assistantMessages: StudioMessage[] = [];

    if (thinkingHint) {
      const thinkingMessage = await appendStudioMessage({
        studioSessionId: session.id,
        role: "assistant",
        content: thinkingHint,
        messageType: "thinking",
      });
      assistantMessages.push(thinkingMessage);
    }

    const assistantMessage = await appendStudioMessage({
      studioSessionId: session.id,
      role: "assistant",
      content: clean,
      messageType: "chat",
    });
    assistantMessages.push(assistantMessage);

    if (regenerateSourceMessage) {
      await appendStudioEvent({
        studioSessionId: session.id,
        eventType: "message_regenerated",
        actor: viewer.email,
        payloadJson: {
          sourceMessageId: regenerateSourceMessage.id,
          regeneratedMessageId: assistantMessage.id,
        },
      });
    }

    const sessionUpdate: Record<string, string> = {};
    if (projectName) sessionUpdate.goalSummary = projectName;
    if (projectType) sessionUpdate.projectType = projectType;
    if (complexityHint) sessionUpdate.complexityHint = complexityHint;

    if (Object.keys(sessionUpdate).length > 0) {
      session = await updateStudioSessionStatus(
        session.id,
        session.status,
        sessionUpdate,
      );
    }

    const shouldStartPrototypeBuild = Boolean(readyForPrototype && session.status === "clarifying");
    if (shouldStartPrototypeBuild) {
      session = await updateStudioSessionStatus(session.id, "generating_prototype");
    }

    return NextResponse.json({
      reply: clean,
      thinking: thinkingHint,
      user_message: userMessage ? toUiMessage(userMessage) : undefined,
      assistant_messages: assistantMessages.map(toUiMessage),
      readyForPrototype: shouldStartPrototypeBuild,
      session_id: session.id,
      session_status: session.status,
      project_name: session.goalSummary,
      corrections_used: session.correctionsUsed,
      max_corrections: session.maxCorrections,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid request.", fieldErrors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    if (request.signal.aborted || isAbortLikeError(error)) {
      return NextResponse.json({ message: "Request aborted." }, { status: 499 });
    }
    if (isDatabaseConnectivityError(error)) {
      return NextResponse.json(
        {
          message:
            "Maxwell is temporarily unavailable because the database connection timed out. Please retry in a moment.",
          code: "DB_CONNECTIVITY_ERROR",
        },
        { status: 503 },
      );
    }

    console.error("Maxwell chat error:", error);
    return NextResponse.json(
      { message: "Maxwell could not respond right now. Please try again." },
      { status: 500 },
    );
  }
}
