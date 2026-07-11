"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
  Reply,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  User,
  X,
} from "lucide-react";
import { StudioThinkingBlock } from "./studio-thinking-block";
import { StudioCorrectionBar } from "./studio-correction-bar";
import { StudioProposalCta } from "./studio-proposal-cta";
import type { ChatMessage, MessageFeedback, ReplyTarget, StudioPhase } from "./studio-shell";
import type { PrototipoShareUxState } from "@/lib/maxwell/prototipo-share-types";
import { useHasMounted } from "@/hooks/use-has-mounted";

// ============================================================================
// Message sub-components
// ============================================================================

function ThinkingDots() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      <span>Thinking</span>
    </div>
  );
}

function formatDuration(durationMs?: number) {
  if (typeof durationMs !== "number" || Number.isNaN(durationMs)) return null;

  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function formatRelativeTime(createdAt: string | undefined, now: number | null) {
  // `now` is null until the component has hydrated, so SSR + first client paint
  // render no relative time (they'd otherwise disagree as wall-clock advances).
  if (!createdAt || now == null) return null;

  const timestamp = Date.parse(createdAt);
  if (Number.isNaN(timestamp)) return null;

  const totalSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (totalSeconds < 10) return "now";
  if (totalSeconds < 60) return `${totalSeconds}s ago`;

  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m ago`;

  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) return `${totalHours}h ago`;

  const totalDays = Math.floor(totalHours / 24);
  return `${totalDays}d ago`;
}

function getMessageId(message: ChatMessage, index: number) {
  return message.id ?? `${message.role}-${index}-${message.content.slice(0, 16)}`;
}

function getMessageExcerpt(content: string) {
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length > 160 ? `${compact.slice(0, 157)}...` : compact;
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function AssistantActions({
  copied,
  feedback,
  isLatest,
  isThinking,
  onCopy,
  onFeedback,
  onReply,
  onRegenerate,
}: {
  copied: boolean;
  feedback?: MessageFeedback;
  isLatest: boolean;
  isThinking: boolean;
  onCopy: () => void;
  onFeedback: (value: MessageFeedback) => void;
  onReply: () => void;
  onRegenerate: () => void;
}) {
  const iconButtonClass =
    "flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-secondary/70 hover:text-foreground disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-muted-foreground";

  return (
    <div className="flex items-center gap-0.5 opacity-80 transition-opacity hover:opacity-100">
      <button
        type="button"
        aria-label={copied ? "Copied" : "Copy response"}
        title={copied ? "Copied" : "Copy"}
        onClick={onCopy}
        className={iconButtonClass}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        aria-label="Good response"
        title="Good response"
        onClick={() => onFeedback("up")}
        className={`${iconButtonClass} ${feedback === "up" ? "bg-secondary/70 text-foreground" : ""}`}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Poor response"
        title="Poor response"
        onClick={() => onFeedback("down")}
        className={`${iconButtonClass} ${feedback === "down" ? "bg-secondary/70 text-foreground" : ""}`}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Reply to this response"
        title="Reply"
        onClick={onReply}
        className={iconButtonClass}
      >
        <Reply className="h-3.5 w-3.5" />
      </button>
      {isLatest && (
        <button
          type="button"
          aria-label="Regenerate response"
          title="Regenerate"
          disabled={isThinking}
          onClick={onRegenerate}
          className={iconButtonClass}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function AssistantMessage({
  content,
  durationMs,
  createdAt,
  now,
  isLatest,
  isThinking,
  copied,
  feedback,
  onCopy,
  onFeedback,
  onReply,
  onRegenerate,
}: {
  content: string;
  durationMs?: number;
  createdAt?: string;
  now: number | null;
  isLatest: boolean;
  isThinking: boolean;
  copied: boolean;
  feedback?: MessageFeedback;
  onCopy: () => void;
  onFeedback: (value: MessageFeedback) => void;
  onReply: () => void;
  onRegenerate: () => void;
}) {
  const durationLabel = formatDuration(durationMs);
  const relativeTime = formatRelativeTime(createdAt, now);

  return (
    <div className="group max-w-[70ch] space-y-2">
      {durationLabel && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Maxwell mapped this</span>
        </div>
      )}
      <div className="whitespace-pre-wrap text-[13.5px] leading-7 text-foreground/90">
        {content}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
        {(durationLabel || relativeTime) && (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>
              {durationLabel ? `Ready in ${durationLabel}` : "Ready"}
              {relativeTime ? ` - ${relativeTime}` : ""}
            </span>
          </div>
        )}
        <div>
          <AssistantActions
            copied={copied}
            feedback={feedback}
            isLatest={isLatest}
            isThinking={isThinking}
            onCopy={onCopy}
            onFeedback={onFeedback}
            onReply={onReply}
            onRegenerate={onRegenerate}
          />
        </div>
      </div>
    </div>
  );
}

function ErrorNotice({ content }: { content: string }) {
  return (
    <div className="flex max-w-[70ch] items-center gap-2 text-xs text-muted-foreground">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      <span>{content}</span>
    </div>
  );
}

/**
 * "Contact an agent" notice — used when the prototype quota is exhausted (403
 * with contact_agent). Renders the server copy plus a real link button instead
 * of dumping the contact URL as raw text, and without the build-steps checklist
 * that `StudioActivityBlock` would draw. Mirrors the "Talk to agent" button in
 * <StudioProposalCta>.
 */
function AgentCtaNotice({ content, href }: { content: string; href: string }) {
  return (
    <div className="max-w-[70ch] space-y-2.5">
      <p className="whitespace-pre-wrap text-[13px] leading-6 text-foreground/90">{content}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <User className="h-3.5 w-3.5" />
        Talk to agent
      </Link>
    </div>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[62%] rounded-[18px] rounded-tr-sm border border-border bg-secondary px-4 py-2 text-[13.5px] leading-relaxed text-foreground whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

// ============================================================================
// StudioChatPane
//
// B29 — The composer used to expose three buttons (Plus "Add context", Mic
// voice-input empty-state, and a Maxwell branding pill). FASE 1 is internal-
// only (ADR-008), and none of those had real behavior — they suggested
// features we have not built. Removed; ComposerIconButton helper went with
// them. If voice / context-attach lands in v3, reintroduce the helper.
// ============================================================================

type StudioChatPaneProps = {
  messages: ChatMessage[];
  isThinking: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  replyTarget: ReplyTarget | null;
  onReplyToMessage: (target: ReplyTarget) => void;
  onClearReply: () => void;
  onRegenerateLatest: () => void;
  stopNotice: string | null;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  canSend: boolean;
  // Phase-aware props
  phase: StudioPhase;
  correctionsUsed: number;
  maxCorrections: number;
  prototypeVersionNumber: number;
  onApprove: () => void;
  onRequestCorrection: (prompt: string) => void;
  onRequestProposal: () => void;
  agentHref: string;
  /** Owner-only deep-link token to the public proposal page (proposal_sent CTA). */
  proposalToken?: string | null;
  isWorkspaceVisible: boolean;
  // ADR-028 D10 — D-upstream wire share props (optional; absent when flag off).
  shareEnabled?: boolean;
  shareUrl?: string | null;
  shareUxState?: PrototipoShareUxState;
  onShare?: () => void;
};

function StudioActivityBlock({ content, phase }: { content: string; phase: StudioPhase }) {
  const isActive = phase === "generating_prototype" || phase === "revision_requested";
  const steps = [
    "Structuring the product direction",
    "Preparing the prototype workspace",
    "Generating the first interactive version",
  ];

  return (
    <div className="max-w-[68ch] space-y-2.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {isActive ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 text-foreground/70" />
        )}
        <span>{isActive ? "Building workspace" : "Checkpoint"}</span>
      </div>
      <p className="text-[13px] leading-6 text-foreground/90">{content}</p>
      <div className="space-y-1.5 pl-0.5">
        {steps.map((step, index) => {
          const complete = !isActive || index < 1;

          return (
            <div key={step} className="flex items-center gap-2 text-xs text-muted-foreground">
              {complete ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-foreground/60" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
              )}
              <span>{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StudioChatPane({
  messages,
  isThinking,
  input,
  onInputChange,
  onSend,
  onStop,
  replyTarget,
  onReplyToMessage,
  onClearReply,
  onRegenerateLatest,
  stopNotice,
  inputRef,
  canSend,
  phase,
  correctionsUsed,
  maxCorrections,
  prototypeVersionNumber,
  onApprove,
  onRequestCorrection,
  onRequestProposal,
  agentHref,
  proposalToken,
  isWorkspaceVisible,
  shareEnabled,
  shareUrl,
  shareUxState,
  onShare,
}: StudioChatPaneProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const mounted = useHasMounted();
  const [now, setNow] = useState(() => Date.now());
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [feedbackByMessageId, setFeedbackByMessageId] = useState<
    Record<string, MessageFeedback | null>
  >({});

  const showActionZone =
    phase === "prototype_ready" ||
    phase === "prototype_shared" ||
    phase === "approved_for_proposal" ||
    phase === "proposal_pending_review" ||
    phase === "proposal_sent";

  const showCorrectionBar =
    prototypeVersionNumber > 0 &&
    (phase === "prototype_ready" ||
      phase === "revision_requested" ||
      phase === "approved_for_proposal");
  const contentFrameClass = isWorkspaceVisible ? "w-full" : "mx-auto w-full max-w-[720px]";
  const hasDraft = input.trim().length > 0;
  const canSubmit = hasDraft && !isThinking;
  const messageStackClass = isWorkspaceVisible
    ? `${contentFrameClass} space-y-5 pb-5 pt-5`
    : `${contentFrameClass} flex min-h-full flex-col justify-end gap-5 pb-10 pt-20 sm:pb-12 sm:pt-24`;
  const composerShellClass = isWorkspaceVisible
    ? "shrink-0 px-3 pb-4 pt-2"
    : "shrink-0 px-3 pb-6 pt-3 sm:px-4 sm:pb-7";
  const composerSurfaceClass = isWorkspaceVisible
    ? "rounded-2xl border border-border bg-secondary px-3 pb-2.5 pt-3"
    : "rounded-[22px] border border-border bg-secondary px-4 pb-3 pt-4";
  const composerInputWrapperClass = isWorkspaceVisible ? "min-h-[52px]" : "min-h-[72px]";
  const composerTextAreaClass = isWorkspaceVisible
    ? "max-h-28 min-h-[38px] w-full resize-none bg-transparent px-1 py-1 text-[13px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/55"
    : "max-h-36 min-h-[56px] w-full resize-none bg-transparent px-1 py-1 text-[13.5px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/55";
  const latestAssistantIndex = messages.findLastIndex(
    (message) => message.role === "assistant" && (!message.type || message.type === "chat"),
  );

  function handleCopyMessage(messageId: string, content: string) {
    void copyTextToClipboard(content).then(() => {
      setCopiedMessageId(messageId);
      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === messageId ? null : current));
      }, 1400);
    });
  }

  function handleFeedback(
    messageId: string,
    value: MessageFeedback,
    persistedFeedback?: MessageFeedback | null,
  ) {
    const previous =
      Object.prototype.hasOwnProperty.call(feedbackByMessageId, messageId)
        ? feedbackByMessageId[messageId]
        : persistedFeedback ?? null;
    const nextValue = previous === value ? null : value;

    setFeedbackByMessageId((current) => {
      return { ...current, [messageId]: nextValue };
    });

    void fetch("/api/maxwell/message-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message_id: messageId,
        feedback: nextValue,
      }),
    }).then((response) => {
      if (response.ok) return;
      setFeedbackByMessageId((current) => {
        return { ...current, [messageId]: previous };
      });
    }).catch(() => {
      setFeedbackByMessageId((current) => {
        return { ...current, [messageId]: previous };
      });
    });
  }

  function handleScroll() {
    const container = scrollContainerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 160;
  }

  // Keep the latest exchange visible without yanking the user away while reading
  // older messages. Scroll only the chat's OWN overflow container — never use
  // bottomRef.scrollIntoView(), which also scrolls every ancestor (including the
  // document), so an embedded pane (e.g. the marketing demo below the fold)
  // would hijack the whole page on mount.
  useEffect(() => {
    if (!shouldStickToBottomRef.current) return;
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isThinking, phase, stopNotice]);

  // Focus input when idle — preventScroll so focusing the composer never yanks
  // the page (same embedded-below-the-fold concern as the auto-scroll above).
  useEffect(() => {
    if (canSend) setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50);
  }, [canSend, inputRef]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="relative flex flex-col h-full bg-background">
      {/* Empty / intake state — absolutely centered so it sits in the middle
          of the chat area without interfering with the scroll container.
          Fades out as soon as the first message appears. */}
      {messages.length === 0 && !isWorkspaceVisible && (
        <div className="pointer-events-none absolute inset-0 bottom-40 flex flex-col items-center justify-center gap-5 px-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-[14px] border border-border bg-secondary/60 overflow-hidden">
            <Image src="/maxwell-icon.png" alt="" aria-hidden="true" width={48} height={48} className="h-full w-full object-cover" />
          </div>
          <div className="text-center">
            <p className="text-[17px] font-medium tracking-tight text-foreground/90">
              I&apos;m Maxwell, solutions architect at Noon.
            </p>
            <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted-foreground">
              Tell me what you want to build and I&apos;ll help turn it into a clear, buildable direction.
            </p>
          </div>
        </div>
      )}
      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 sm:px-6"
      >
        <div className={messageStackClass}>
          {messages.map((msg, i) => {
            const messageId = getMessageId(msg, i);
            if (msg.role === "user") return <UserMessage key={messageId} content={msg.content} />;
            if (msg.type === "thinking") return <StudioThinkingBlock key={messageId} content={msg.content} />;
            if (msg.type === "error") return <ErrorNotice key={messageId} content={msg.content} />;
            if (msg.type === "agent_cta") {
              return (
                <AgentCtaNotice
                  key={messageId}
                  content={msg.content}
                  href={msg.agentHref ?? agentHref}
                />
              );
            }
            if (msg.type === "system_event") {
              return <StudioActivityBlock key={messageId} content={msg.content} phase={phase} />;
            }
            const persistedMessageId = msg.id;
            const feedback =
              persistedMessageId &&
              Object.prototype.hasOwnProperty.call(feedbackByMessageId, persistedMessageId)
                ? feedbackByMessageId[persistedMessageId] ?? undefined
                : msg.feedback ?? undefined;
            return (
              <AssistantMessage
                key={messageId}
                content={msg.content}
                durationMs={msg.durationMs}
                createdAt={msg.createdAt}
                now={mounted ? now : null}
                isLatest={i === latestAssistantIndex}
                isThinking={isThinking}
                copied={copiedMessageId === messageId}
                feedback={feedback}
                onCopy={() => handleCopyMessage(messageId, msg.content)}
                onFeedback={(value) => {
                  if (persistedMessageId) {
                    handleFeedback(persistedMessageId, value, msg.feedback);
                  }
                }}
                onReply={() =>
                  persistedMessageId &&
                  onReplyToMessage({
                    messageId: persistedMessageId,
                    excerpt: getMessageExcerpt(msg.content),
                  })
                }
                onRegenerate={onRegenerateLatest}
              />
            );
          })}
          {isThinking && <ThinkingDots />}
          {stopNotice && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Square className="h-3 w-3" />
              <span>{stopNotice}</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Correction bar — version + dot indicators */}
      {showCorrectionBar && (
        <StudioCorrectionBar
          phase={phase}
          versionNumber={prototypeVersionNumber}
          correctionsUsed={correctionsUsed}
          maxCorrections={maxCorrections}
        />
      )}

      {/* Action zone — CTAs for prototype_ready, approved, proposal states */}
      {showActionZone && (
        <div className="shrink-0 px-4 py-3 border-t border-border/70">
          <StudioProposalCta
            phase={phase}
            correctionsUsed={correctionsUsed}
            maxCorrections={maxCorrections}
            onApprove={onApprove}
            onRequestCorrection={onRequestCorrection}
            onRequestProposal={onRequestProposal}
            agentHref={agentHref}
            proposalToken={proposalToken}
            shareEnabled={shareEnabled}
            shareUrl={shareUrl}
            shareUxState={shareUxState}
            onShare={onShare}
          />
        </div>
      )}

      {/* Text input */}
      {canSend && (
        <div className={composerShellClass}>
          <div className={contentFrameClass}>
            <div className={composerSurfaceClass}>
              {replyTarget && (
                <div className="mb-3 flex items-start justify-between gap-3 rounded-xl bg-black/30 px-3 py-2.5 text-xs text-muted-foreground">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground/85">Replying to Maxwell</p>
                    <p className="mt-1 max-h-10 overflow-hidden leading-relaxed text-muted-foreground">
                      {replyTarget.excerpt}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Cancel reply"
                    onClick={onClearReply}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <div className={composerInputWrapperClass}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => onInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                  placeholder={messages.length === 0 ? "Describe what you want to build..." : "Ask a follow-up..."}
                  rows={1}
                  className={composerTextAreaClass}
                />
              </div>
              {/*
                B29 — FASE 1 is internal-only (ADR-008). The Plus "Add context"
                button had no behavior beyond focusing the input, and the Mic
                empty-state on the send button suggested a voice-input feature
                we have not built. Both removed; the Maxwell branding pill goes
                with them since the row was only there to host that trio.

                B30 — Always-visible send: the send button is always rendered
                (the row no longer collapses on mobile) and shows a disabled
                ArrowRight when the input is empty. On touch devices the
                Enter-to-send keyboard shortcut is intentionally skipped (see
                the textarea's onKeyDown above) so users always discover send
                via this visible button.
              */}
              <div className="mt-1 flex items-center justify-end">
                <button
                  type="button"
                  aria-label={isThinking ? "Stop response" : "Send message"}
                  title={isThinking ? "Stop response" : "Send message"}
                  disabled={!isThinking && !canSubmit}
                  onClick={() => {
                    if (isThinking) {
                      onStop();
                    } else if (canSubmit) {
                      onSend();
                    }
                  }}
                  // B40 — Tap target ≥44×44 px (WCAG 2.5.5). Was h-9 w-9 (36px).
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground transition-colors hover:bg-foreground/15 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-foreground/10"
                >
                  {isThinking ? (
                    <Square className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
