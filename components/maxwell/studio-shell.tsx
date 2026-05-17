"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { StudioHeader } from "./studio-header";
import { StudioChatPane } from "./studio-chat-pane";
import { StudioPreviewPane } from "./studio-preview-pane";
import { PrototypeQuotaStrip } from "./prototype-quota-strip";
import { getContactHref } from "@/lib/site-config";
import type { PrototypeQuotaSnapshot } from "@/lib/maxwell/prototype-quota";

// ============================================================================
// Types
// ============================================================================

export type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  type?: "chat" | "thinking" | "system_event" | "error";
  createdAt?: string;
  durationMs?: number;
  feedback?: MessageFeedback | null;
};

export type MessageFeedback = "up" | "down";

export type ReplyTarget = {
  messageId: string;
  excerpt: string;
};

export type StudioPhase =
  | "intake"
  | "clarifying"
  | "generating_prototype"
  | "prototype_ready"
  | "revision_requested"
  | "revision_applied"
  | "approved_for_proposal"
  | "proposal_pending_review"
  | "proposal_sent"
  | "converted";

export type PrototypeVersion = {
  chatId: string;
  demoUrl: string;
  versionNumber: number;
  versionId?: string | null;
};

type PrototypePollResult = {
  chatId: string;
  demoUrl: string;
  version_id?: string | null;
  version_number?: number;
  corrections_used?: number;
  max_corrections?: number;
};

export type ActiveView = "chat" | "preview";

const DEFAULT_MAX_CORRECTIONS = 2;

function createMessageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createMessage(
  message: Omit<ChatMessage, "id" | "createdAt"> &
    Partial<Pick<ChatMessage, "id" | "createdAt">>,
): ChatMessage {
  return {
    id: message.id ?? createMessageId(),
    createdAt: message.createdAt ?? new Date().toISOString(),
    ...message,
  };
}

function normalizeMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    id: message.id ?? createMessageId(),
    createdAt: message.createdAt ?? new Date().toISOString(),
  };
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function elapsedMs(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function maxwellErrorMessage(code?: string, fallback?: string) {
  switch (code) {
    case "AUTH_REQUIRED":
      return "Please sign in to continue with Maxwell.";
    case "SESSION_NOT_FOUND":
      return "This Maxwell session could not be found. Start a new conversation to continue.";
    case "FORBIDDEN":
      return "You do not have access to this Maxwell session.";
    case "SESSION_NOT_ACCEPTING_MESSAGES":
      return "This session is not accepting new messages right now.";
    case "DB_CONNECTIVITY_ERROR":
      return "Maxwell is temporarily unavailable because the database connection timed out. Please retry in a moment.";
    case "OPENAI_NOT_CONFIGURED":
      return "Maxwell is temporarily unavailable because AI generation is not configured.";
    case "INVALID_REQUEST":
      return "That request could not be processed. Check the message and try again.";
    case "MAXWELL_CHAT_FAILED":
      return "Maxwell could not respond right now. Please try again.";
    default:
      return fallback ?? "Connection interrupted. Try sending the message again.";
  }
}

// Bloque 11 — `buildPrototypeBrief()` used to live here as a client-side
// helper that flattened the conversation into a single string before POSTing
// to /api/maxwell/prototype. It moved to `lib/maxwell/prototype-brief.ts`
// (server-side) so it can blend in the StudioBrief + StylePack, which the
// client doesn't see. The client now posts the raw conversation snapshot
// and the server assembles the multi-section v0 prompt.

// ============================================================================
// StudioShell
// ============================================================================

type SessionSummary = {
  id: string;
  initial_prompt: string;
  status: StudioPhase;
  goal_summary: string | null;
  updated_at: string;
};

type StudioShellProps = {
  initialPrompt: string;
  initialSessionId?: string;
  viewerEmail: string;
};

export function StudioShell({
  initialPrompt,
  initialSessionId,
  viewerEmail,
}: StudioShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [phase, setPhase] = useState<StudioPhase>("intake");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isRehydrating, setIsRehydrating] = useState(!!initialSessionId);
  const [input, setInput] = useState("");
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [stopNotice, setStopNotice] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null);
  const [prototypeVersions, setPrototypeVersions] = useState<PrototypeVersion[]>([]);
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(0);
  const [correctionsUsed, setCorrectionsUsed] = useState(0);
  const [maxCorrections, setMaxCorrections] = useState(DEFAULT_MAX_CORRECTIONS);
  const [activeView, setActiveView] = useState<ActiveView>("chat");
  const [prototypeFailed, setPrototypeFailed] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [sessionSummaries, setSessionSummaries] = useState<SessionSummary[]>([]);
  const [quotaSnapshot, setQuotaSnapshot] = useState<PrototypeQuotaSnapshot | null>(null);

  const currentVersion = prototypeVersions[prototypeVersions.length - 1] ?? null;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasStartedRef = useRef(false);
  const chatAbortRef = useRef<AbortController | null>(null);
  const rehydrateAbortRef = useRef<AbortController | null>(null);

  const agentHref = getContactHref({
    inquiry: "new-project",
    draft: initialPrompt || projectName,
    source: "maxwell-studio-agent",
  });

  const quotaAgentHref = getContactHref({
    inquiry: "new-project",
    draft: projectName || initialPrompt,
    source: "maxwell-studio-prototype-quota",
  });

  async function refreshSessionSummaries() {
    try {
      const res = await fetch("/api/maxwell/studio/sessions", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { sessions: SessionSummary[] };
      setSessionSummaries(data.sessions);
    } catch {
      // ignore
    }
  }

  const refreshPrototypeQuota = useCallback(
    async (sessionIdOverride?: string | null) => {
      try {
        const sid = sessionIdOverride !== undefined ? sessionIdOverride : sessionId;
        const qs = sid ? `?session_id=${encodeURIComponent(sid)}` : "";
        const res = await fetch(`/api/maxwell/studio/prototype-quota${qs}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok) {
          setQuotaSnapshot(null);
          return;
        }
        const data = (await res.json()) as PrototypeQuotaSnapshot;
        setQuotaSnapshot(data);
      } catch {
        setQuotaSnapshot(null);
      }
    },
    [sessionId],
  );

  useEffect(() => {
    void refreshPrototypeQuota();
  }, [refreshPrototypeQuota]);

  useEffect(() => {
    if (sessionId && !initialSessionId) {
      const qs = new URLSearchParams({ session_id: sessionId });
      router.replace(`${pathname}?${qs.toString()}`);
    }
  }, [sessionId, initialSessionId, pathname, router]);

  useEffect(() => {
    if (initialSessionId) {
      void rehydrateSession(initialSessionId);
      void refreshSessionSummaries();
      return;
    }

    if (initialPrompt.trim()) {
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;
      const trimmedPrompt = initialPrompt.trim();
      const initialUserMessage = createMessage({ role: "user", content: trimmedPrompt });
      setMessages([initialUserMessage]);
      setPhase("clarifying");
      void refreshSessionSummaries();
      void sendToMaxwell(trimmedPrompt, true, {
        localUserMessageId: initialUserMessage.id,
      });
      return;
    }

    rehydrateAbortRef.current?.abort();
    hasStartedRef.current = false;
    setSessionId(null);
    setMessages([]);
    setPhase("intake");
    setPrototypeVersions([]);
    setSelectedVersionIndex(0);
    setCorrectionsUsed(0);
    setMaxCorrections(DEFAULT_MAX_CORRECTIONS);
    setActiveView("chat");
    setPrototypeFailed(false);
    setProjectName("");
    setInput("");
    setReplyTarget(null);
    setStopNotice(null);
    setIsRehydrating(false);
    void refreshSessionSummaries();
  }, [initialPrompt, initialSessionId]);

  useEffect(() => {
    if (prototypeVersions.length > 0) {
      setActiveView("preview");
      setSelectedVersionIndex(prototypeVersions.length - 1);
    }
  }, [prototypeVersions.length]);

  async function rehydrateSession(id: string) {
    rehydrateAbortRef.current?.abort();
    const controller = new AbortController();
    rehydrateAbortRef.current = controller;

    setIsRehydrating(true);
    try {
      const res = await fetch(`/api/maxwell/studio/session?session_id=${id}`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        router.replace(pathname);
        return;
      }

      const data = (await res.json()) as {
        session: {
          id: string;
          status: StudioPhase;
          goalSummary: string | null;
          correctionsUsed: number;
          maxCorrections: number;
        };
        messages: ChatMessage[];
        versions: PrototypeVersion[];
        workspace?: unknown | null;
        workspace_pending?: boolean;
        proposal_status?: string | null;
      };

      setSessionId(data.session.id);
      setPhase(data.session.status);
      setProjectName(data.session.goalSummary ?? "");
      setCorrectionsUsed(data.session.correctionsUsed);
      setMaxCorrections(data.session.maxCorrections);
      const restoredMessages = data.messages.map(normalizeMessage);
      setMessages(
        data.workspace_pending
          ? [
              ...restoredMessages,
              createMessage({
                role: "assistant",
                type: "system_event",
                content:
                  "Your project is being prepared by Noon. The workspace will appear once activation finishes.",
              }),
            ]
          : restoredMessages,
      );
      setPrototypeVersions(data.versions);
      if (data.workspace_pending) {
        setStopNotice("Your workspace is being prepared by Noon.");
      }

      if (data.versions.length > 0) {
        setSelectedVersionIndex(data.versions.length - 1);
        setActiveView("preview");
      }
      void refreshPrototypeQuota(data.session.id);
    } catch (error) {
      if (isAbortError(error)) return;
      router.replace(pathname);
    } finally {
      if (rehydrateAbortRef.current === controller) {
        setIsRehydrating(false);
      }
    }
  }

  async function sendToMaxwell(
    userMessage: string,
    isFirstMessage = false,
    options?: {
      replyTarget?: ReplyTarget | null;
      regenerateAssistantMessageId?: string;
      localUserMessageId?: string;
    },
  ) {
    const requestStartedAt = performance.now();
    setIsThinking(true);

    const controller = new AbortController();
    chatAbortRef.current = controller;

    let imageUrl: string | undefined;
    let effectiveMessage = userMessage;

    if (isFirstMessage && !sessionId) {
      try {
        const stored = sessionStorage.getItem("maxwell_attached_file");
        if (stored) {
          sessionStorage.removeItem("maxwell_attached_file");
          const file = JSON.parse(stored) as {
            name: string;
            mimeType: string;
            dataUrl: string;
            textContent?: string;
          };

          if ((file.mimeType.startsWith("image/") || file.mimeType === "image/url") && file.dataUrl) {
            imageUrl = file.dataUrl;
          } else if (file.textContent) {
            effectiveMessage = `[Attached file: ${file.name}]\n${file.textContent}\n\n${effectiveMessage}`;
          } else {
            effectiveMessage = `[Attached file: ${file.name}]\n\n${effectiveMessage}`;
          }
        }
      } catch {
        // sessionStorage unavailable; continue without attachment context.
      }
    }

    try {
      const res = await fetch("/api/maxwell/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: effectiveMessage,
          ...(sessionId ? { session_id: sessionId } : {}),
          ...(imageUrl ? { image_url: imageUrl } : {}),
          ...(options?.replyTarget
            ? { reply_to_message_id: options.replyTarget.messageId }
            : {}),
          ...(options?.regenerateAssistantMessageId
            ? { regenerate_assistant_message_id: options.regenerateAssistantMessageId }
            : {}),
        }),
      });

      if (res.status === 499) return;

      const data = (await res.json()) as {
        reply?: string;
        thinking?: string | null;
        message?: string;
        code?: string;
        user_message?: ChatMessage;
        assistant_messages?: ChatMessage[];
        readyForPrototype?: boolean;
        session_id?: string;
        session_status?: StudioPhase;
        project_name?: string | null;
        corrections_used?: number;
        max_corrections?: number;
      };

      if (!res.ok) {
        const message = maxwellErrorMessage(data.code, data.message);
        if (res.status === 401) {
          const callbackUrl = `${pathname}${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ""}`;
          router.push(`/en/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
          setMessages((prev) => [
            ...prev,
            createMessage({
              role: "assistant",
              content: message,
              type: "error",
              durationMs: elapsedMs(requestStartedAt),
            }),
          ]);
          return;
        }
        throw new Error(message);
      }

      const effectiveSessionId = data.session_id ?? sessionId;
      if (data.session_id && !sessionId) setSessionId(data.session_id);
      if (data.session_status) setPhase(data.session_status);
      if (data.project_name && !projectName) setProjectName(data.project_name);
      if (data.corrections_used !== undefined) setCorrectionsUsed(data.corrections_used);
      if (data.max_corrections !== undefined) setMaxCorrections(data.max_corrections);
      if (data.session_id) void refreshSessionSummaries();

      const reply =
        data.reply ?? data.message ?? "Maxwell couldn't respond right now. Please try again.";
      const durationMs = elapsedMs(requestStartedAt);
      const assistantMessages = data.assistant_messages?.length
        ? data.assistant_messages.map((message) => ({
            ...normalizeMessage(message),
            durationMs: message.durationMs ?? durationMs,
          }))
        : [
            ...(data.thinking
              ? [
                  createMessage({
                    role: "assistant" as const,
                    content: data.thinking,
                    type: "thinking" as const,
                    durationMs,
                  }),
                ]
              : []),
            createMessage({
              role: "assistant",
              content: reply,
              durationMs,
            }),
          ];

      setMessages((prev) => {
        let next = prev;
        if (data.user_message) {
          const serverUserMessage = normalizeMessage(data.user_message);
          const localUserMessageId = options?.localUserMessageId;

          if (localUserMessageId) {
            next = next.map((message) =>
              message.id === localUserMessageId ? serverUserMessage : message,
            );
          } else if (!next.some((message) => message.id === serverUserMessage.id)) {
            next = [...next, serverUserMessage];
          }
        }

        const newAssistantMessages = assistantMessages.filter(
          (message) => !message.id || !next.some((existing) => existing.id === message.id),
        );
        return [...next, ...newAssistantMessages];
      });

      if (
        data.readyForPrototype &&
        data.session_status !== "proposal_pending_review" &&
        data.session_status !== "proposal_sent"
      ) {
        void buildPrototype(userMessage, reply, effectiveSessionId ?? null);
      }
    } catch (error) {
      if (isAbortError(error)) return;

      setMessages((prev) => [
        ...prev,
        createMessage({
          role: "assistant",
          content: error instanceof Error
            ? error.message
            : "Connection interrupted. Try sending the message again.",
          type: "error",
          durationMs: elapsedMs(requestStartedAt),
        }),
      ]);
    } finally {
      if (chatAbortRef.current === controller) {
        chatAbortRef.current = null;
      }
      setIsThinking(false);
    }
  }

  function handleStopThinking() {
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    setIsThinking(false);
    setStopNotice("Stopped");
    window.setTimeout(() => {
      setStopNotice((current) => (current === "Stopped" ? null : current));
    }, 1800);
  }

  function handleSend() {
    const msg = input.trim();
    if (!msg || isThinking) return;

    const currentReplyTarget = replyTarget;
    const localUserMessage = createMessage({ role: "user", content: msg });
    setInput("");
    setReplyTarget(null);
    setStopNotice(null);
    setMessages((prev) => [...prev, localUserMessage]);
    void sendToMaxwell(msg, !sessionId && messages.length === 0, {
      replyTarget: currentReplyTarget,
      localUserMessageId: localUserMessage.id,
    });
  }

  function handleReplyToMessage(target: ReplyTarget) {
    setReplyTarget(target);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleRegenerateLatest() {
    if (isThinking) return;

    const latestAssistantIndex = messages.findLastIndex(
      (message) => message.role === "assistant" && (!message.type || message.type === "chat"),
    );
    if (latestAssistantIndex === -1) return;

    const previousUserMessage = messages
      .slice(0, latestAssistantIndex)
      .findLast((message) => message.role === "user");

    const assistantMessage = messages[latestAssistantIndex];
    if (!previousUserMessage || !assistantMessage.id) return;

    void sendToMaxwell(previousUserMessage.content, false, {
      regenerateAssistantMessageId: assistantMessage.id,
    });
  }

  async function buildPrototype(
    lastUserMsg: string,
    lastAssistantMsg: string,
    effectiveSessionId: string | null,
  ) {
    setPhase("generating_prototype");
    setPrototypeFailed(false);

    try {
      // Bloque 11 — Quality Layer: send raw conversation snapshot; the server
      // assembles the multi-section v0 prompt with brief + style pack.
      const conversationSnapshot = messages
        .filter(
          (m) =>
            m.type !== "thinking" &&
            m.type !== "system_event" &&
            m.type !== "error",
        )
        .slice(-50)
        .map((m) => ({ role: m.role, content: m.content, type: m.type }));

      const res = await fetch("/api/maxwell/prototype", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          messages: conversationSnapshot,
          last_user_msg: lastUserMsg,
          last_assistant_msg: lastAssistantMsg,
          ...(effectiveSessionId ? { session_id: effectiveSessionId } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        chatId?: string;
        demoUrl?: string;
        version_id?: string | null;
        version_number?: number;
        corrections_used?: number;
        max_corrections?: number;
        message?: string;
        pending?: boolean;
        session_id?: string;
        action?: string;
        contact_agent?: boolean;
        code?: string;
      };

      if (res.status === 403) {
        setPhase("clarifying");
        setPrototypeFailed(true);
        const msg =
          typeof data.message === "string"
            ? data.message
            : "Prototype generation is not available right now.";
        const showAgent = Boolean(data.contact_agent);
        setMessages((prev) => [
          ...prev,
          createMessage({
            role: "assistant",
            content: msg,
            type: showAgent ? "system_event" : "error",
          }),
          ...(showAgent
            ? [
                createMessage({
                  role: "assistant",
                  content: `Talk with a Noon agent: ${quotaAgentHref}`,
                  type: "system_event",
                }),
              ]
            : []),
        ]);
        return;
      }

      if (!res.ok) {
        setPhase("clarifying");
        setPrototypeFailed(true);
        setMessages((prev) => [
          ...prev,
          createMessage({
            role: "assistant",
            content:
              typeof data.message === "string"
                ? data.message
                : "I wasn't able to start the preview. You can try again or keep refining the idea.",
          }),
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        createMessage({
          role: "assistant",
          content: "Preparing the first interactive version from this conversation.",
          type: "system_event",
        }),
      ]);

      if (data.pending && data.chatId && data.session_id) {
        // Start polling
        pollV0Status(data.chatId, data.session_id, data.action ?? "create");
        return;
      }

      if (data.chatId && data.demoUrl) {
        const newVersion: PrototypeVersion = {
          chatId: data.chatId,
          demoUrl: data.demoUrl,
          versionId: data.version_id ?? null,
          versionNumber: data.version_number ?? 1,
        };
        setPrototypeVersions((prev) => [...prev, newVersion]);
        if (data.corrections_used !== undefined) setCorrectionsUsed(data.corrections_used);
        if (data.max_corrections !== undefined) setMaxCorrections(data.max_corrections);
        setPhase("prototype_ready");
        setMessages((prev) => [
          ...prev,
          createMessage({
            role: "assistant",
            content:
              "Version 1 is ready. Review it, request adjustments if needed, or approve it to move toward the formal proposal.",
          }),
        ]);
        void refreshPrototypeQuota(data.session_id ?? sessionId);
      } else {
        setPhase("clarifying");
        setPrototypeFailed(true);
        setMessages((prev) => [
          ...prev,
          createMessage({
            role: "assistant",
            content:
              data.message ??
              "I wasn't able to generate the preview right now. You can try again or keep refining the idea.",
          }),
        ]);
      }
    } catch {
      setPhase("clarifying");
      setPrototypeFailed(true);
      setMessages((prev) => [
        ...prev,
        createMessage({
          role: "assistant",
          content:
            "The preview couldn't be generated right now. Your session is intact. You can try again or continue chatting.",
        }),
      ]);
    }
  }

  function handlePollSuccess(data: PrototypePollResult, action: string) {
    if (action === "create") {
      const newVersion: PrototypeVersion = {
        chatId: data.chatId,
        demoUrl: data.demoUrl,
        versionId: data.version_id ?? null,
        versionNumber: data.version_number ?? 1,
      };
      setPrototypeVersions((prev) => [...prev, newVersion]);
      if (data.corrections_used !== undefined) setCorrectionsUsed(data.corrections_used);
      if (data.max_corrections !== undefined) setMaxCorrections(data.max_corrections);
      setPhase("prototype_ready");
      setMessages((prev) => [
        ...prev,
        createMessage({
          role: "assistant",
          content:
            "Version 1 is ready. Review it, request adjustments if needed, or approve it to move toward the formal proposal.",
        }),
      ]);
      void refreshPrototypeQuota();
    } else {
      // ACÁ LA CORRECCIÓN: Usamos prev para leer siempre la versión correcta
      setPrototypeVersions((prev) => {
        const lastVersion = prev[prev.length - 1];
        if (!lastVersion) return prev;

        const updatedVersion: PrototypeVersion = {
          chatId: data.chatId || lastVersion.chatId,
          demoUrl: data.demoUrl,
          versionId: data.version_id ?? null,
          versionNumber: data.version_number ?? lastVersion.versionNumber + 1,
        };
        return [...prev, updatedVersion];
      });

      if (data.corrections_used !== undefined) {
        setCorrectionsUsed(data.corrections_used);
      }
      if (data.max_corrections !== undefined) {
        setMaxCorrections(data.max_corrections);
      }
      setPhase("prototype_ready");

      setMessages((prev) => {
        const currentUsed = data.corrections_used ?? (correctionsUsed + 1);
        const currentMax = data.max_corrections ?? maxCorrections;
        const remaining = currentMax - currentUsed;

        return [
          ...prev,
          createMessage({
            role: "assistant",
            content:
              remaining > 0
                ? `The updated version is ready. You have ${remaining} adjustment${remaining === 1 ? "" : "s"} remaining.`
                : "The final adjusted version is ready. Adjustments are complete. Approve it to move forward or request the formal proposal.",
          }),
        ];
      });
    }
  }

  function handlePollError(action: string) {
    if (action === "create") {
      setPhase("clarifying");
      setPrototypeFailed(true);
      setMessages((prev) => [
        ...prev,
        createMessage({
          role: "assistant",
          content:
            "I wasn't able to generate the preview right now. It may be a temporary issue. You can try again or continue chatting to refine the idea.",
        }),
      ]);
    } else {
      setPhase("prototype_ready");
      setMessages((prev) => [
        ...prev,
        createMessage({
          role: "assistant",
          content:
            "The adjustment didn't go through due to a temporary error. Your session is intact. Please try again.",
        }),
      ]);
    }
  }

  async function pollV0Status(
    chatId: string,
    pollSessionId: string,
    action: string,
    prompt?: string,
    previousDemoUrl?: string,
    previousVersionId?: string | null,
    confirmationToken?: string,
  ) {
    try {
      const params = new URLSearchParams({
        chatId,
        session_id: pollSessionId,
        action,
      });
      if (prompt) {
        params.set("prompt", prompt.substring(0, 500));
      }
      if (previousDemoUrl) {
        params.set("previous_demo_url", previousDemoUrl);
      }
      if (previousVersionId) {
        params.set("previous_version_id", previousVersionId);
      }
      if (confirmationToken) {
        params.set("confirmation_token", confirmationToken);
      }
      const res = await fetch(`/api/maxwell/prototype/poll?${params.toString()}`);
      if (!res.ok) {
        return handlePollError(action);
      }
      const data = await res.json();

      if (data.status === "pending") {
        const nextConfirmationToken =
          typeof data.completion_token === "string" ? data.completion_token : confirmationToken;
        setTimeout(
          () => pollV0Status(
            chatId,
            pollSessionId,
            action,
            prompt,
            previousDemoUrl,
            previousVersionId,
            nextConfirmationToken,
          ),
          5000,
        );
      } else if (data.status === "completed" && data.chatId && data.demoUrl) {
        // Small client-side buffer to reduce blank iframe race conditions
        // right after the preview endpoint becomes available.
        setTimeout(
          () =>
            handlePollSuccess(
              {
                chatId: data.chatId,
                demoUrl: data.demoUrl,
                version_id: data.version_id,
                version_number: data.version_number,
                corrections_used: data.corrections_used,
                max_corrections: data.max_corrections,
              },
              action,
            ),
          1200,
        );
      } else {
        // failed or error
        handlePollError(action);
      }
    } catch {
      handlePollError(action);
    }
  }


  // ── Corrections ────────────────────────────────────────────────────────────

  async function handleRequestCorrection(correctionPrompt: string) {
    if (!currentVersion || correctionsUsed >= maxCorrections) return;

    setPhase("revision_requested");
    setMessages((prev) => [
      ...prev,
      createMessage({ role: "user", content: correctionPrompt }),
      createMessage({ role: "assistant", content: "Got it. Applying that adjustment now." }),
    ]);

    try {
      const res = await fetch("/api/maxwell/prototype", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          chatId: currentVersion.chatId,
          prompt: correctionPrompt,
          ...(sessionId ? { session_id: sessionId } : {}),
        }),
      });
      const data = (await res.json()) as {
        chatId?: string;
        demoUrl?: string;
        version_id?: string | null;
        version_number?: number;
        corrections_used?: number;
        max_corrections?: number;
        code?: string;
        message?: string;
        pending?: boolean;
        session_id?: string;
        action?: string;
        completion_token?: string;
      };

      if (data.code === "MAX_CORRECTIONS_REACHED") {
        setPhase("prototype_ready");
        setMessages((prev) => [
          ...prev,
          createMessage({
            role: "assistant",
            content: data.message ?? "No more adjustments are available.",
          }),
        ]);
        return;
      }

      if (data.pending && data.chatId && data.session_id) {
        pollV0Status(
          data.chatId,
          data.session_id,
          data.action ?? "update",
          correctionPrompt,
          currentVersion.demoUrl,
          currentVersion.versionId,
        );
        return;
      }

      if (data.demoUrl && currentVersion) {
        const updatedVersion: PrototypeVersion = {
          chatId: data.chatId ?? currentVersion.chatId,
          demoUrl: data.demoUrl,
          versionId: data.version_id ?? null,
          versionNumber: data.version_number ?? currentVersion.versionNumber + 1,
        };
        setPrototypeVersions((prev) => [...prev, updatedVersion]);
      }

      const newCount = data.corrections_used ?? correctionsUsed + 1;
      if (data.max_corrections !== undefined) setMaxCorrections(data.max_corrections);
      setCorrectionsUsed(newCount);
      setPhase("prototype_ready");

      const remaining = maxCorrections - newCount;
      setMessages((prev) => [
        ...prev,
        createMessage({
          role: "assistant",
          content:
            remaining > 0
              ? `The updated version is ready. You have ${remaining} adjustment${remaining === 1 ? "" : "s"} remaining.`
              : "The final adjusted version is ready. Adjustments are complete. Approve it to move forward or request the formal proposal.",
        }),
      ]);
    } catch {
      setPhase("prototype_ready");
      setMessages((prev) => [
        ...prev,
        createMessage({
          role: "assistant",
          content: "The adjustment didn't go through. Your session is intact. Please try again.",
        }),
      ]);
    }
  }

  function handleApprove() {
    setPhase("approved_for_proposal");
    setMessages((prev) => [
      ...prev,
      createMessage({
        role: "assistant",
        content:
          "Prototype approved. When you're ready, request the formal proposal with scope, deliverables, timeline, and investment. The Noon team reviews it before it reaches you.",
      }),
    ]);
  }

  async function handleRequestProposal() {
    if (!sessionId) return;

    const phaseBeforeRequest = phase;

    setPhase("proposal_pending_review");
    setMessages((prev) => [
      ...prev,
      createMessage({ role: "user", content: "I'd like the formal proposal." }),
      createMessage({
        role: "assistant",
        content: "Drafting the proposal based on everything we've covered.",
      }),
    ]);

    try {
      const res = await fetch("/api/maxwell/proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = (await res.json()) as {
        proposal_request_id?: string;
        status?: string;
        message?: string;
        code?: string;
        noon_app_handoff_skipped?: boolean;
      };

      const handoffFailedButDraftSaved =
        !res.ok && data.code === "NOON_APP_HANDOFF_FAILED" && Boolean(data.proposal_request_id);

      if (handoffFailedButDraftSaved) {
        setPhase("proposal_pending_review");
        setMessages((prev) => [
          ...prev,
          createMessage({
            role: "assistant",
            content:
              typeof data.message === "string"
                ? data.message
                : "Your proposal draft was saved but could not be delivered to the Noon PM app automatically.",
            type: "system_event",
          }),
          createMessage({
            role: "assistant",
            content:
              "The team can still pick it up from the internal proposal queue. If this keeps happening, use Talk to agent with your session link.",
            type: "system_event",
          }),
        ]);
        return;
      }

      if (!res.ok) {
        setPhase(phaseBeforeRequest);
        const msg =
          typeof data.message === "string"
            ? data.message
            : res.status === 503
              ? "The proposal service is temporarily unavailable (for example OpenAI or handoff not configured). Please try again shortly."
              : "Could not submit the proposal request. Please try again.";
        setMessages((prev) => [
          ...prev,
          createMessage({
            role: "assistant",
            content: msg,
            type: "error",
          }),
        ]);
        return;
      }

      if (data.proposal_request_id) {
        setMessages((prev) => [
          ...prev,
          createMessage({
            role: "assistant",
            content: data.noon_app_handoff_skipped
              ? "Your formal proposal draft is saved and marked for internal Noon review. Automatic delivery to the PM app is not configured on this server; the team can still open it from the proposal queue, or you can contact an agent."
              : "Your proposal has been drafted and is now in review with the Noon team. A Project Manager will verify it before the formal version is sent by email.",
          }),
        ]);
      }
    } catch {
      setPhase(phaseBeforeRequest);
      setMessages((prev) => [
        ...prev,
        createMessage({
          role: "assistant",
          content: "Couldn't generate the proposal right now. Please try again.",
          type: "error",
        }),
      ]);
    }
  }

  async function handleDeleteSessionList(id: string) {
    if (!window.confirm("Delete this conversation? You will not be able to open it again.")) return;
    try {
      const res = await fetch(
        `/api/maxwell/studio/sessions?session_id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) return;
      await refreshSessionSummaries();
      if (id === sessionId) {
        router.replace(pathname);
      }
    } catch {
      // ignore
    }
  }

  function handleSelectSessionFromList(id: string) {
    const qs = new URLSearchParams({ session_id: id });
    router.push(`${pathname}?${qs.toString()}`);
  }

  function handleNewChatFromList() {
    router.push(pathname);
  }

  const draftSessionsForHeader = sessionSummaries.map((s) => ({
    id: s.id,
    title:
      (s.goal_summary || s.initial_prompt).replace(/\s+/g, " ").trim().slice(0, 88) || "Conversation",
    updatedAt: s.updated_at,
  }));

  if (isRehydrating) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
          <p className="text-sm">Restoring your session...</p>
        </div>
      </div>
    );
  }

  const canSendMessage =
    phase === "intake" ||
    phase === "clarifying" ||
    phase === "generating_prototype" ||
    phase === "prototype_ready" ||
    phase === "approved_for_proposal" ||
    phase === "proposal_pending_review" ||
    phase === "proposal_sent";

  const shouldShowWorkspace =
    phase === "generating_prototype" ||
    phase === "revision_requested" ||
    prototypeFailed ||
    prototypeVersions.length > 0;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <StudioHeader
        projectName={projectName}
        phase={phase}
        correctionsUsed={correctionsUsed}
        maxCorrections={maxCorrections}
        agentHref={agentHref}
        viewerEmail={viewerEmail}
        activeView={activeView}
        onToggleView={setActiveView}
        hasPrototype={prototypeVersions.length > 0}
        hasWorkspace={shouldShowWorkspace}
        draftSessions={draftSessionsForHeader}
        currentSessionId={sessionId}
        onSelectDraftSession={handleSelectSessionFromList}
        onNewDraftChat={handleNewChatFromList}
        onDeleteDraftSession={handleDeleteSessionList}
      />

      {quotaSnapshot ? <PrototypeQuotaStrip snapshot={quotaSnapshot} /> : null}

      {/*
        B37 — Semantic landmarks. <main> wraps the two-pane workspace so screen
        readers and keyboard nav can jump straight to the working area, skipping
        the <header> above. The chat side becomes an <aside> (complementary to
        the prototype preview, which is the primary content); the preview side
        gets <section role="region"> with an aria-label so AT users hear what
        each pane represents.
      */}
      <main className="flex min-h-0 flex-1 overflow-hidden" aria-label="Studio workspace">
        <aside
          aria-label="Conversation with Maxwell"
          className={`
            flex min-h-0 flex-col
            ${shouldShowWorkspace ? "w-full shrink-0 border-r border-border/70 bg-background lg:w-[440px] xl:w-[500px]" : "w-full border-r-0"}
            ${shouldShowWorkspace ? (activeView === "chat" ? "flex" : "hidden lg:flex") : "flex"}
          `}
        >
          <StudioChatPane
            messages={messages}
            isThinking={isThinking}
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            onStop={handleStopThinking}
            inputRef={inputRef}
            canSend={canSendMessage}
            phase={phase}
            correctionsUsed={correctionsUsed}
            maxCorrections={maxCorrections}
            prototypeVersionNumber={currentVersion?.versionNumber ?? 0}
            onApprove={handleApprove}
            onRequestCorrection={handleRequestCorrection}
            onRequestProposal={handleRequestProposal}
            agentHref={agentHref}
            isWorkspaceVisible={shouldShowWorkspace}
            replyTarget={replyTarget}
            onReplyToMessage={handleReplyToMessage}
            onClearReply={() => setReplyTarget(null)}
            onRegenerateLatest={handleRegenerateLatest}
            stopNotice={stopNotice}
          />
        </aside>

        {shouldShowWorkspace && (
          <section
            aria-label="Prototype preview"
            className={`
              min-h-0 flex-1 flex-col
              ${activeView === "preview" ? "flex" : "hidden lg:flex"}
            `}
          >
            <StudioPreviewPane
              prototypeVersions={prototypeVersions}
              selectedVersionIndex={selectedVersionIndex}
              onSelectVersion={setSelectedVersionIndex}
              phase={phase}
              prototypeFailed={prototypeFailed}
              correctionsUsed={correctionsUsed}
              maxCorrections={maxCorrections}
              onApprove={handleApprove}
              onRequestCorrection={handleRequestCorrection}
              onRequestProposal={handleRequestProposal}
              onRetryPrototype={() => {
                const lastUserMsg =
                  messages.filter((message) => message.role === "user").at(-1)?.content ?? "";
                const lastAssistantMsg =
                  messages.filter((message) => message.role === "assistant").at(-1)?.content ?? "";
                void buildPrototype(lastUserMsg, lastAssistantMsg, sessionId);
              }}
              agentHref={agentHref}
            />
          </section>
        )}
      </main>
    </div>
  );
}
