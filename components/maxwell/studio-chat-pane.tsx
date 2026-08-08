"use client";

import { useTranslations } from "next-intl";
import { VoiceInputMenuItem } from "@/components/maxwell/voice-input-menu-item";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUp,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Github,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Reply,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  TriangleIcon,
  BellRing,
  Upload,
  User,
  X,
} from "lucide-react";
import type { StudioMilestone } from "@/lib/maxwell/proposal-milestone";
import {
  ReferenceDirectionCard,
  type ReferenceOption,
} from "@/components/maxwell/reference-direction-card";
import { StudioThinkingBlock } from "./studio-thinking-block";
import { StudioCorrectionBar } from "./studio-correction-bar";
import { StudioProposalCta } from "./studio-proposal-cta";
import type {
  AttachedFile,
  ChatMessage,
  MessageFeedback,
  PrototypeTrace,
  ReplyTarget,
  StudioPhase,
} from "./studio-shell";
import {
  PROTOTYPE_STAGE_ORDER,
  prototypeStageDetail,
  prototypeStageLabel,
  prototypeStepStatus,
  type PrototypeStage,
  type StepStatus,
} from "@/lib/maxwell/prototype-stage";
import { formatElapsed } from "@/lib/maxwell/polling-progress";
import type { PrototipoShareUxState } from "@/lib/maxwell/prototipo-share-types";
import { useHasMounted } from "@/hooks/use-has-mounted";

/** Fase A · E2.4 — up to 3 images of ONE reference (owner's rule). */
const MAX_REFERENCE_IMAGES = 3;

// ============================================================================
// Message sub-components
// ============================================================================

// Starter prompts shown in the empty intake state — lower the blank-page
// barrier with a few on-model examples of what Noon builds. Clicking one fills
// the composer (does not send) so the user can edit before starting.
const STARTER_PROMPTS = [
  "A booking system for my business",
  "An internal operations dashboard",
  "A customer support AI assistant",
  "A CRM for my team",
];

function ThinkingDots() {
  const t = useTranslations("studio");
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      <span>{t("thinking")}</span>
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
  const t = useTranslations("studio");
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
        aria-label={t("goodResponse")}
        title={t("goodResponse")}
        onClick={() => onFeedback("up")}
        className={`${iconButtonClass} ${feedback === "up" ? "bg-secondary/70 text-foreground" : ""}`}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label={t("poorResponse")}
        title={t("poorResponse")}
        onClick={() => onFeedback("down")}
        className={`${iconButtonClass} ${feedback === "down" ? "bg-secondary/70 text-foreground" : ""}`}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label={t("replyToResponse")}
        title={t("reply")}
        onClick={onReply}
        className={iconButtonClass}
      >
        <Reply className="h-3.5 w-3.5" />
      </button>
      {isLatest && (
        <button
          type="button"
          aria-label={t("regenerateResponse")}
          title={t("regenerate")}
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
  const t = useTranslations("studio");
  const durationLabel = formatDuration(durationMs);
  const relativeTime = formatRelativeTime(createdAt, now);

  return (
    <div className="group max-w-[70ch] space-y-2">
      {durationLabel && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          <span>{t("maxwellMapped")}</span>
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
  attachedFile: AttachedFile | null;
  onAttachChange: (file: AttachedFile | null) => void;
  /**
   * Fase A · E2.4 — extra images of the SAME reference (owner's rule: up to
   * 3 in total). The first image keeps the ordinary single-attachment path;
   * these ride alongside it, so every non-image flow is untouched.
   */
  extraImages?: AttachedFile[];
  onExtraImagesChange?: (files: AttachedFile[]) => void;
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
  /**
   * Real stage of the run in flight (poll endpoint), or null when nothing is
   * running / before the first poll answers. Only the most recent activity block
   * consumes it — older ones in the history are finished checkpoints.
   */
  prototypeTrace?: PrototypeTrace | null;
  /** Date.now() when polling started — the trace's elapsed counter. */
  pollingStartedAt?: number | null;
  correctionsUsed: number;
  maxCorrections: number;
  prototypeVersionNumber: number;
  onApprove: () => void;
  onRequestCorrection: (prompt: string) => void;
  onRequestProposal: () => void;
  /**
   * Fase A · E2.2 — the confirmation card's "Continue" tap. Optional so the
   * dev bench (mock data, no handlers) renders unchanged.
   */
  onConfirmDirection?: (selected: ReferenceOption) => void;
  /** Fase A · E2.3 — "Prefiero otra": swap in unseen references. */
  onPreferAnotherDirection?: () => void;
  /** Fase A · E2.4 — one-tap answer to the reference question. */
  onQuickAnswer?: (text: string, focusComposer: boolean) => void;
  agentHref: string;
  isWorkspaceVisible: boolean;
  // ADR-028 D10 — D-upstream wire share props (optional; absent when flag off).
  shareEnabled?: boolean;
  shareUrl?: string | null;
  shareUxState?: PrototipoShareUxState;
  onShare?: () => void;
};

/**
 * Prominent card for review-loop notices (the PM's W7 note, the W8
 * changes-requested aviso). These arrive at the bottom of a long chat and were
 * easy to miss in the muted activity-block styling. Detected by the shared
 * "The Noon team" content prefix because rehydrated rows carry only
 * `messageType: system_event` — adding a dedicated type would need a DB
 * migration for no other gain.
 */
function ReviewNoticeCard({ content }: { content: string }) {
  const t = useTranslations("studio");
  return (
    <div className="max-w-[68ch] rounded-[8px] border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
        <BellRing className="h-3.5 w-3.5" />
        <span>{t("teamUpdate")}</span>
      </div>
      <p className="whitespace-pre-line text-sm leading-6 text-foreground">{content}</p>
    </div>
  );
}

/**
 * MILESTONE CARD — for the moments that change the state of the deal, as opposed
 * to the conversation around them.
 *
 * Why it exists: when a client requests the formal proposal, the chat answered
 * with a plain assistant bubble ("Your proposal has been drafted and is now in
 * review…"). The single most consequential event in the flow — the client has
 * just committed — carried exactly the same visual weight as Maxwell's small
 * talk, and scrolled away like it.
 *
 * Adapted from the owner's reference, keeping its LOGIC rather than its pixels:
 *   · label → value rows, so the facts are scannable instead of buried in prose
 *   · a footer action that goes to the thing being described
 *   · one status line stating where it stands
 * What the reference has and we don't: a connecting rail between events. Theirs
 * shows three consecutive entries; ours land at separate points in a chat with
 * conversation between them, so a rail would be drawing a line across messages
 * it doesn't own.
 *
 * Every field is real or absent — no row is rendered to fill the shape out.
 */
function MilestoneRow({
  label,
  value,
  chips,
  noonAvatar,
}: {
  label: string;
  value?: string | null;
  chips?: string[];
  /** Our mark as the row's avatar — the reference's "Submitted by 👤 John". */
  noonAvatar?: boolean;
}) {
  if (!value && !chips?.length) return null;
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] items-start gap-3">
      <span className="pt-px text-[12px] leading-5 text-muted-foreground">{label}</span>
      {noonAvatar && value ? (
        <span className="flex items-center gap-2 text-[13px] leading-5 text-foreground/90">
          {/* Same avatar treatment the services chat already gives the mark: a
              filled round chip, not a bare glyph floating next to the text.
              NoonMark is our real vector — public/icon.svg in this repo is v0's
              logo, not ours, and must never stand in for the brand. */}
          {/* The brand tile itself (`/logo-icon.png` — the same asset the site
              serves as its favicon: #0056fd, white mark, rounded corners baked
              in), not a mark I compose into a circle at render time.
              That composition was the bug: a 9px mark centred in a 16px circle
              left 3.75px margins, which no device-pixel grid can split evenly, so
              the mark sat visibly off-centre — and the flush-to-viewBox artwork
              got its outline clipped by the SVG's default overflow:hidden on top.
              The tile has its padding and centring drawn in at 1024px, so both
              problems stop existing rather than getting corrected. */}
          {/* Clipped to a circle: this is an AVATAR — it sits where the
              reference puts a person's photo, and every other avatar on the web
              is round. The tile's own corner radius stays underneath, so the
              circle only trims blue, never the mark: the artwork's farthest
              corner sits ~427px from centre in a 512px radius. */}
          <Image
            src="/logo-icon.png"
            alt=""
            width={16}
            height={16}
            className="h-4 w-4 shrink-0 rounded-full"
          />
          {value}
        </span>
      ) : chips?.length ? (
        <span className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            // NOT <TraceChips>, deliberately. That one is built for file paths:
            // monospaced, and it labels each chip with `split("/").pop()` — which
            // on a project name is at best wrong typography and at worst silent
            // truncation the day a name contains a slash. Same shape and fill,
            // sans text: these carry human labels, not identifiers.
            <span
              key={chip}
              className="max-w-full break-words rounded-[4px] border border-border bg-foreground/[0.07] px-1.5 py-0.5 text-[12px] font-medium leading-[16px] text-foreground/90"
            >
              {chip}
            </span>
          ))}
        </span>
      ) : (
        // `break-words`: the grid column can shrink (minmax(0,1fr)), but a value
        // with no spaces or hyphens — a long email, a URL pasted into the goal
        // summary — has nowhere to wrap and spills out of the card. It doesn't
        // show up by measuring the span's rect (its BOX stays inside; the text
        // escapes it); only card.scrollWidth > clientWidth catches it.
        <span className="break-words text-[13px] leading-5 text-foreground/90">{value}</span>
      )}
    </div>
  );
}

export function StudioEventCard({
  title,
  milestone,
}: {
  title: string;
  milestone: StudioMilestone;
}) {
  const rows = (milestone.rows ?? []).filter((r) => r.value || r.chips?.length);
  const steps = milestone.steps ?? [];
  const inProgress = steps.some((s) => s.status !== "done");
  const hasBody =
    rows.length > 0 || steps.length > 0 || Boolean(milestone.status) || Boolean(milestone.action);
  // Resolved BEFORE rendering: an unparseable timestamp formats to "", and an
  // empty <time> element is a hole in the layout plus a datetime attribute
  // pointing at nothing for a screen reader.
  const timeLabel = milestone.at ? formatMilestoneTime(milestone.at) : "";
  // Same instant, two readings: a label while it is a record, a running counter
  // while it is live. Unparseable → no counter rather than a wrong one.
  const parsedAt = milestone.at ? Date.parse(milestone.at) : Number.NaN;
  const startedAtMs = Number.isNaN(parsedAt) ? null : parsedAt;

  return (
    <div className="relative max-w-[68ch] space-y-2.5">
      {/* Heading on the page, not on a filled surface: the emphasis here comes
          from the glyph and the weight, and the one filled thing in a block stays
          reserved for a LIVE state (treatment 1 in the activity trace). A settled
          milestone is not in flight. */}
      {inProgress ? (
        // TREATMENT 1 — the block's one filled surface, exactly as the build
        // trace does its "Building your prototype…". This is the headline state,
        // so it has to be the loudest thing here; as bare text on the page it
        // read as frozen next to a trace that visibly breathes.
        //
        // The counter is real, not decoration: the card knows `at` (when the
        // proposal was requested), so this is time actually spent. And it does a
        // job no copy can — past the 15-minute window the number simply keeps
        // climbing, which IS the honest signal that something is slow, with no
        // invented warning.
        //
        // No timestamp in this state: live gets elapsed, the settled record gets
        // its "Today, 7:07 PM". Both at once would be two clocks for one event.
        <div className="flex items-center gap-3 rounded-[8px] border border-border bg-foreground/[0.05] px-3.5 py-3">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-500" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {title}
          </span>
          {startedAtMs != null && <TraceElapsed startedAt={startedAtMs} />}
        </div>
      ) : (
        <div className="flex items-baseline gap-2.5">
          {/* Neutral, NOT emerald. In this chat emerald already means "running"
              (the trace's spinner), and a green tick additionally reads "all
              good — complete", which this isn't: the proposal has been sent and
              is still awaiting a PM. The EVENT is done, so it gets the same
              `foreground/75` tick the trace uses for a finished step; where it
              actually stands is the status line's job, not the glyph's. */}
          <CheckCircle2 className="h-4 w-4 shrink-0 translate-y-0.5 text-foreground/75" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {timeLabel && (
              // Plain sans, normal case — not the mono/uppercase we use elsewhere
              // for metadata. That treatment is for machine readouts (the trace's
              // ticking counter); "Today, 4:50 PM" is a sentence a person reads,
              // and in mono caps it shouted over the title it belongs to.
              <time
                dateTime={milestone.at!}
                className="mt-0.5 block text-[12px] leading-5 text-muted-foreground"
              >
                {timeLabel}
              </time>
            )}
          </div>
        </div>
      )}

      {/* The rail: down the GLYPH column, from just under the tick to the bottom
          of the box it introduces. Same primitive and same geometry as the
          activity trace's connector, not a line measured by eye — so two
          milestones landing back to back read as one continuous timeline for
          free, with no code that knows about "the next event".
          Gated on there being a body: with no box under it, this would be a stub
          hanging off a title, which is the decoration I was right to refuse. */}
      {hasBody && !inProgress && (
        <span
          aria-hidden
          // `mb-0` is load-bearing: `space-y-2.5` on the parent sets margin-bottom
          // on every child but the last, and this span is a middle one — so
          // `bottom-0` was landing 10px above the box's bottom edge and the line
          // died just short of the corner. Absolute positioning does not exempt an
          // element from the space-y selector.
          className="absolute bottom-0 left-[7.5px] top-[21px] mb-0 w-px bg-border"
        />
      )}

      {/* TWO SHAPES, because the content is of two kinds:
          · IN PROGRESS — steps hanging off the rail, no box. Exactly the build
            trace's anatomy: the connector runs down the steps' own glyph column
            and ends on the last glyph. Boxing them and running a separate rail
            outside is what made this read as unfinished beside the trace — the
            list hung off nothing.
          · SETTLED — the facts inside an outline box (treatment 2: it groups,
            it doesn't shout), introduced by the rail above. */}
      {hasBody && (
        <div
          className={
            inProgress
              ? "space-y-2.5"
              : "ml-[26px] space-y-2.5 rounded-[8px] border border-border p-3.5"
          }
        >
          {milestone.status && (
            <p className="text-[13px] leading-5 text-foreground/90">{milestone.status}</p>
          )}
          {steps.length > 0 && (
            // Same anatomy as the build trace, not a second invention: the rail
            // runs down the STEPS' own glyph column and dies on the last glyph,
            // instead of a list floating inside a box while an unrelated rail
            // runs past it outside. `StepGlyph` and the segment geometry are the
            // trace's, reused verbatim — two lists of steps in one chat must not
            // be drawn by two different pieces of code.
            <ol>
              {steps.map((step, index) => {
                const isLast = index === steps.length - 1;
                return (
                  <li key={step.label} className="relative pb-2.5 last:pb-0">
                    {/* Segment under each glyph rather than one full-height rule
                        behind them: nothing to keep in sync with the background. */}
                    {!isLast && (
                      <span
                        aria-hidden
                        className="absolute bottom-0 left-[7.5px] top-[21px] w-px bg-border"
                      />
                    )}
                    <div className="flex items-start gap-2.5">
                      <StepGlyph status={step.status} />
                      <div className="min-w-0">
                        <p
                          className={`text-[13px] leading-5 ${
                            step.status === "pending"
                              ? "text-muted-foreground/60"
                              : "text-muted-foreground"
                          }`}
                        >
                          {step.label}
                        </p>
                      </div>
                    </div>
                    {/* The step IN FLIGHT opens a box, the same one the trace
                        gives its running step — the note stopped being loose
                        text under a label and became what that step is
                        currently doing. `ml-7` clears the rail, so the box
                        hangs off the line instead of crossing it. */}
                    {step.detail && step.status === "active" && (
                      <div className="relative ml-7 mt-2 rounded-[8px] border border-border p-3.5">
                        <p className="text-[13px] leading-5 text-foreground/90">{step.detail}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {rows.map((row) => (
            <MilestoneRow key={row.label} {...row} />
          ))}
          {milestone.note && (
            // Quieter than the rows: they are the facts you scan, this is an
            // aside. Sits with them, above the divider, because it belongs to
            // what happened and not to the action.
            <p className="text-[12px] leading-5 text-muted-foreground">{milestone.note}</p>
          )}
          {/* No actions while it is preparing (owner, 2026-07-30). "Talk to an
              agent" was a copy of a link that lives permanently in the left rail,
              and "Nudge the team" was shown 100% of the time for a hand-off
              failure that happens rarely — inviting the client to poke a process
              that is working, with a button whose point only makes sense if you
              know the hand-off can fail, which they don't.
              Cost, accepted knowingly: the self-service re-queue is gone from the
              UI entirely, so a stuck proposal now needs an agent (reachable from
              the rail). The endpoint still accepts it if we ever want the button
              back — ideally gated on the wait exceeding the expected window,
              which the card can tell from `at` alone. */}
          {milestone.action && (
            // Hairline above it, like the reference: the rows are FACTS and this
            // is an ACTION. Without the divider the button read as one more row,
            // and the eye had to work out that it was clickable.
            <div className="-mx-3.5 border-t border-border pt-3.5">
              {/* New tab, so the ↗ tells the truth and the conversation survives
                  the click — losing your place in a long chat to read the
                  proposal would be a poor trade. */}
              <a
                href={milestone.action.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mx-3.5 flex items-center justify-center gap-1.5 rounded-[6px] border border-border px-3 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-foreground/[0.05]"
              >
                {milestone.action.label}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * "Today, 10:00 AM" while it's today, an explicit date once it isn't — a chat
 * that stays open for days must not keep calling Tuesday "today".
 */
function formatMilestoneTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  // Pinned to en-US rather than the runtime default: the site launches
  // English-only, and the visitor's OS locale was rendering "4:42 p. m." — which
  // the uppercase styling then turned into "4:42 P. M.".
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const isToday = new Date().toDateString() === date.toDateString();
  return isToday
    ? `Today, ${time}`
    : `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
}

/** Ticking elapsed counter for the live trace. Mirrors the preview pane's badge. */
function TraceElapsed({ startedAt }: { startedAt: number }) {
  const mounted = useHasMounted();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Until hydrated, render 0 so SSR and the first client paint agree.
  const seconds = mounted ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  // Same slot the reference gives its countdown, filled with what we can
  // actually know: time spent, not time left.
  return (
    <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide tabular-nums text-muted-foreground/70">
      {formatElapsed(seconds)} elapsed
    </span>
  );
}

/**
 * Status glyph per step. The reference's whole glyph inventory is three shapes —
 * an empty ring, a ringed mark, and a thin spinning arc — so this uses the same
 * three and nothing else. Sized 4 (16px) to sit with the larger step type.
 */
function StepGlyph({ status }: { status: StepStatus }) {
  if (status === "done") {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-foreground/75" aria-hidden />;
  }
  if (status === "active") {
    return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-500" aria-hidden />;
  }
  return (
    <span
      aria-hidden
      className="h-4 w-4 shrink-0 rounded-full border border-border bg-transparent"
    />
  );
}

/** A line inside a step's result box: a settled finding, or work in progress. */
type TraceResult = { done: boolean; text: string; chips?: string[]; more?: number };

/**
 * TREATMENT 3 — small filled badges with weighted text: pinpoint emphasis on
 * specific values. Shared by both row shapes (inline on a finished step, and
 * inside the active step's box) so they can never drift apart.
 */
function TraceChips({ chips, more }: { chips?: string[]; more?: number }) {
  if (!chips?.length) return null;
  return (
    // Their OWN tighter gap: badges belong to each other more than to the words
    // beside them, and inheriting the row's spacing scattered them.
    <span className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        // Keyed by the full specifier (two dirs can hold the same file name) but
        // LABELLED with just the last segment: the full path truncates exactly
        // where the useful part is. The whole thing stays in the tooltip.
        //
        // Snug on purpose: this used to be px-2 py-1 at 11px, which rendered a
        // 27px badge against a 20px line — 35% taller than the text it annotates,
        // so it read as a button rather than a mark on the sentence. Now ~20px:
        // the same height as the line it sits in.
        <code
          key={chip}
          title={chip}
          className="rounded-[4px] border border-border bg-foreground/[0.07] px-1.5 py-0.5 font-mono text-[12px] font-medium leading-[14px] text-foreground/90"
        >
          {chip.split("/").pop() || chip}
        </code>
      ))}
      {more ? <span className="font-mono text-[11px] text-muted-foreground">+{more}</span> : null}
    </span>
  );
}

/**
 * What a step has to show inside its box. Only real data ever gets in here: the
 * files v0 emitted, and the stage's own description while it runs. A step with
 * nothing to report gets no box at all, rather than a box padded with filler.
 */
function stepResults(
  step: PrototypeStage,
  status: StepStatus,
  fileCount: number,
  fileNames: string[],
  missingFiles: string[],
): TraceResult[] {
  const rows: TraceResult[] = [];
  // The files belong to the step that produced them, so they stay on screen
  // once generating is behind us — like the reference keeping a finished step's
  // findings visible instead of collapsing them away.
  if (step === "generating" && fileCount > 0) {
    rows.push({
      // A settled finding, even while the step keeps running — the files really
      // are written. Same split as the reference: findings tick, work in
      // progress spins.
      done: true,
      text: `${fileCount} ${fileCount === 1 ? "file" : "files"} written`,
      // Two, not three: at the chat pane's real width three file names wrap to a
      // second line, and the reference's rows never wrap. The overflow count
      // carries the rest.
      chips: fileNames.slice(0, 2),
      more: Math.max(0, fileCount - 2),
    });
  }
  if (status === "active") {
    // When the server told us WHICH files it is waiting on, name them: the value
    // belongs in badges (treatment 3), not buried in a sentence. The generic
    // line stays as the fallback for the other `assembling` cause (an unstable
    // version signature), which has no file list — never a made-up one.
    if (step === "assembling" && missingFiles.length > 0) {
      rows.push({
        done: false,
        text: `Waiting for ${missingFiles.length} ${missingFiles.length === 1 ? "file" : "files"}`,
        chips: missingFiles.slice(0, 2),
        more: Math.max(0, missingFiles.length - 2),
      });
    } else {
      rows.push({ done: false, text: prototypeStageDetail(step) });
    }
  }
  return rows;
}

/**
 * The chat's build trace.
 *
 * **What changed and why.** This block used to draw three hardcoded steps whose
 * status was `complete = index < 1` — the first always ticked, the other two
 * span forever, and none of it corresponded to anything happening on the server.
 * It now renders the REAL stages the poll endpoint reports
 * (`lib/maxwell/prototype-stage`), with real sub-results: the files v0 has
 * actually emitted, by name.
 *
 * Elapsed time is shown; time REMAINING is not. v0's duration isn't predictable,
 * and a countdown that slips is worse than no countdown.
 *
 * `trace` is passed only for the most recent block — older ones in the history
 * are finished work and render as a static checkpoint.
 */
export function StudioActivityBlock({
  content,
  phase,
  trace,
  startedAt,
}: {
  content: string;
  phase: StudioPhase;
  trace?: PrototypeTrace | null;
  startedAt?: number | null;
}) {
  const isActive = phase === "generating_prototype" || phase === "revision_requested";
  // Before the first poll answers we have no server stage yet, but we do know
  // what was just started: v0 is generating. That is the run's known initial
  // condition, not a guess about progress.
  const stage = trace?.stage ?? "generating";
  const fileCount = trace?.fileCount ?? 0;
  const fileNames = trace?.fileNames ?? [];
  const missingFiles = trace?.missingFiles ?? [];

  return (
    <div
      className="max-w-[68ch] space-y-3"
      role={isActive ? "status" : undefined}
      aria-live={isActive ? "polite" : undefined}
    >
      <p className="text-[13px] leading-6 text-foreground/90">{content}</p>

      {/* TREATMENT 1 — a FILLED surface, and the only one in the block that
          breaks away from the page. This is the headline state, so it has to be
          the loudest thing here.
          It used to use `bg-card`, which in this palette equals the page (white
          on white / #080808 on #000) — so it had no elevation at all, and the
          result boxes below actually out-shouted it. A large area needs only a
          light fill to read as raised, hence 0.05 against the badge's 0.07. */}
      <div className="flex items-center gap-3 rounded-[8px] border border-border bg-foreground/[0.05] px-3.5 py-3">
        {isActive ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-500" aria-hidden />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-foreground/75" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {isActive ? "Building your prototype…" : "Build complete"}
        </span>
        {isActive && startedAt != null && <TraceElapsed startedAt={startedAt} />}
      </div>

      {/* The rail runs down the GLYPH column and the result boxes are indented
          clear of it, so one continuous line threads the whole trace and the
          boxes hang off it — the reference's anatomy. Spacing is per-item
          padding (not a gap) so the line never breaks between steps. */}
      <ol>
        {PROTOTYPE_STAGE_ORDER.map((step, index) => {
          // A finished block is a summary, not a live trace: every step reads
          // done regardless of where the (now irrelevant) stage pointer sits.
          const status: StepStatus = isActive ? prototypeStepStatus(step, stage) : "done";
          const results = isActive
            ? stepResults(step, status, fileCount, fileNames, missingFiles)
            : [];
          const isLast = index === PROTOTYPE_STAGE_ORDER.length - 1;
          // TWO ROW SHAPES, and which one you get is the point:
          //   · a FINISHED step states its value INLINE — "label: [chip] [chip]"
          //   · the step IN FLIGHT opens a box showing the work under way
          // Everything used to get a box, so the inline shape never appeared and
          // a settled result was dressed up as ongoing work.
          const inlineResult =
            status === "done" && results.length === 1 && (results[0].chips?.length ?? 0) > 0
              ? results[0]
              : null;
          const boxedResults = inlineResult ? [] : results;

          return (
            <li key={step} className="relative pb-2.5 last:pb-0">
              {/* Drawn as a segment under each glyph rather than one full-height
                  rule behind them: no punch-through to keep in sync with the
                  pane background. */}
              {!isLast && (
                // left/top follow the 16px glyph: centre is 8px, and the segment
                // starts just below it.
                <span
                  aria-hidden
                  className="absolute bottom-0 left-[7.5px] top-[21px] w-px bg-border"
                />
              )}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <StepGlyph status={status} />
                <span
                  className={`text-[13px] leading-5 ${
                    // A step not started yet steps back, but only slightly: in
                    // the reference every step label carries the same weight and
                    // the glyph is what tells you where you are.
                    status === "pending" ? "text-muted-foreground/60" : "text-muted-foreground"
                  }`}
                >
                  {prototypeStageLabel(step)}
                  {inlineResult ? ":" : ""}
                </span>
                {inlineResult && (
                  <TraceChips chips={inlineResult.chips} more={inlineResult.more} />
                )}
              </div>

              {boxedResults.length > 0 && (
                // TREATMENT 2 — the page's own value, defined ONLY by its border.
                // This box GROUPS, it does not emphasise: its job is to say
                // "these lines belong to that step". Giving it a fill (it had
                // 0.035) made every step compete with the status card and
                // flattened the hierarchy — the quietest treatment is the
                // correct one here.
                <div className="relative ml-7 mt-2 space-y-2.5 rounded-[8px] border border-border p-3.5">
                  {boxedResults.map((result) => (
                    // Chips sit INLINE with their line (flex-wrap), the way the
                    // reference reads: "<what happened>  [value] [value]".
                    <div
                      key={result.text}
                      // Findings read at full contrast — they are the payload of
                      // the trace, not metadata about it (the reference keeps
                      // these lines near-black while step labels stay gray).
                      className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] leading-5 text-foreground/85"
                    >
                      {result.done ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-foreground/60" aria-hidden />
                      ) : (
                        <Loader2
                          className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground/70"
                          aria-hidden
                        />
                      )}
                      <span>{result.text}</span>
                      <TraceChips chips={result.chips} more={result.more} />
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function StudioChatPane({
  messages,
  isThinking,
  input,
  onInputChange,
  onSend,
  attachedFile,
  onAttachChange,
  extraImages = [],
  onExtraImagesChange,
  onStop,
  replyTarget,
  onReplyToMessage,
  onClearReply,
  onRegenerateLatest,
  stopNotice,
  inputRef,
  canSend,
  phase,
  prototypeTrace,
  pollingStartedAt,
  correctionsUsed,
  maxCorrections,
  prototypeVersionNumber,
  onApprove,
  onRequestCorrection,
  onRequestProposal,
  onConfirmDirection,
  onPreferAnotherDirection,
  onQuickAnswer,
  agentHref,
  isWorkspaceVisible,
  shareEnabled,
  shareUrl,
  shareUxState,
  onShare,
}: StudioChatPaneProps) {
  const t = useTranslations("studio");
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Only the newest activity block is the run in flight; every earlier one is
  // finished work. Without this, starting a second generation would light up
  // every past block in the history as if it were running again.
  const liveActivityIndex = messages.reduce(
    (last, msg, i) =>
      msg.type === "system_event" && !msg.content.startsWith("The Noon team") ? i : last,
    -1,
  );
  const shouldStickToBottomRef = useRef(true);
  const mounted = useHasMounted();
  const [now, setNow] = useState(() => Date.now());
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [feedbackByMessageId, setFeedbackByMessageId] = useState<
    Record<string, MessageFeedback | null>
  >({});

  // Composer attach menu — ported from the home hero composer. `attachedFile`
  // is lifted to the shell (sent with the next message); the menu's open/url
  // state is local UI. Icons/behavior mirror the hero composer.
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [urlInputMode, setUrlInputMode] = useState<"github" | "vercel" | "image" | null>(null);
  const [urlInputValue, setUrlInputValue] = useState("");
  const [urlInputLoading, setUrlInputLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setAttachMenuOpen(false);
        setUrlInputMode(null);
        setUrlInputValue("");
      }
    }
    if (attachMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [attachMenuOpen]);

  async function handleUrlImport() {
    if (!urlInputValue.trim()) return;
    setUrlInputLoading(true);
    try {
      if (urlInputMode === "github") {
        const match = urlInputValue.match(/github\.com\/([^/]+\/[^/]+)/);
        const repo = match ? match[1].replace(/\.git$/, "") : urlInputValue;
        const res = await fetch(`https://api.github.com/repos/${repo}/readme`, {
          headers: { Accept: "application/vnd.github.raw+json" },
        });
        if (res.ok) {
          const text = await res.text();
          onAttachChange({ name: `${repo} (README.md)`, mimeType: "text/plain", dataUrl: "", textContent: text.slice(0, 8000) });
        } else {
          onAttachChange({ name: `GitHub: ${repo}`, mimeType: "text/plain", dataUrl: "" });
        }
      } else if (urlInputMode === "vercel") {
        onAttachChange({ name: `Vercel: ${urlInputValue}`, mimeType: "text/plain", dataUrl: "", textContent: `Vercel project URL: ${urlInputValue}` });
      } else if (urlInputMode === "image") {
        onAttachChange({ name: urlInputValue, mimeType: "image/url", dataUrl: urlInputValue });
      }
    } catch {
      onAttachChange({ name: urlInputValue, mimeType: "text/plain", dataUrl: "" });
    } finally {
      setUrlInputLoading(false);
      setAttachMenuOpen(false);
      setUrlInputMode(null);
      setUrlInputValue("");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    const file = picked[0];
    if (!file) return;
    e.target.value = "";

    // Fase A · E2.4 — picking several images at once means "these are views
    // of ONE reference" (owner: hasta 3 imágenes de UNA referencia). The
    // first goes down the ordinary single-attachment path below; the extras
    // ride alongside. A single pick behaves exactly as it always has.
    const extras = picked
      .slice(1)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, MAX_REFERENCE_IMAGES - 1);
    if (extras.length > 0 && onExtraImagesChange) {
      void Promise.all(
        extras.map(
          (f) =>
            new Promise<AttachedFile>((resolve) => {
              const reader = new FileReader();
              reader.onload = () =>
                resolve({ name: f.name, mimeType: f.type, dataUrl: reader.result as string });
              reader.readAsDataURL(f);
            }),
        ),
      ).then((loaded) => onExtraImagesChange(loaded));
    }
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => onAttachChange({ name: file.name, mimeType: file.type, dataUrl: reader.result as string });
      reader.readAsDataURL(file);
    } else if (file.type.startsWith("text/") || file.name.endsWith(".md") || file.name.endsWith(".csv") || file.name.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = () => onAttachChange({ name: file.name, mimeType: file.type, dataUrl: "", textContent: reader.result as string });
      reader.readAsText(file);
    } else {
      onAttachChange({ name: file.name, mimeType: file.type, dataUrl: "" });
    }
  }

  // Only the phases whose panel still exists. Both proposal phases are out: this
  // wrapper draws a top border plus 24px of padding on its own, so listing a
  // phase whose panel returns null leaves a bare divider with nothing under it —
  // which is exactly what happened the first time and what the owner spotted. A
  // container has to know when its contents stopped existing.
  const showActionZone = phase === "prototype_ready" || phase === "approved_for_proposal";

  // W9 — no `approved_for_proposal` here: approving ends the adjustment loop
  // (approved_for_proposal → revision_requested is an illegal transition), so
  // showing the bar there offered an action that could only 500.
  const showCorrectionBar =
    prototypeVersionNumber > 0 &&
    (phase === "prototype_ready" || phase === "revision_requested");
  const contentFrameClass = isWorkspaceVisible ? "w-full" : "mx-auto w-full max-w-[720px]";
  const hasDraft = input.trim().length > 0;
  const canSubmit = (hasDraft || !!attachedFile || extraImages.length > 0) && !isThinking;
  const messageStackClass = isWorkspaceVisible
    ? `${contentFrameClass} space-y-5 pb-5 pt-5`
    : `${contentFrameClass} flex min-h-full flex-col justify-end gap-5 pb-10 pt-20 sm:pb-12 sm:pt-24`;
  const composerShellClass = isWorkspaceVisible
    ? "shrink-0 px-3 pb-4 pt-2"
    : "shrink-0 px-3 pb-6 pt-3 sm:px-4 sm:pb-7";
  // Composer surface — matches the home hero composer (tight 9px card, subtle
  // 3-side shadow border instead of a solid border).
  const composerSurfaceClass =
    "rounded-[9px] p-1.5 bg-[#f9f9f9] dark:bg-[#131313] shadow-[0_-1px_0_0_#0000000f,-1px_0_0_0_#0000000f,1px_0_0_0_#0000000f] dark:shadow-[0_-1px_0_0_#ffffff14,-1px_0_0_0_#ffffff14,1px_0_0_0_#ffffff14]";
  const composerInputWrapperClass = isWorkspaceVisible ? "min-h-[80px]" : "min-h-[96px]";
  const composerTextAreaClass = isWorkspaceVisible
    ? "max-h-40 min-h-[64px] w-full resize-none bg-transparent px-3 py-1.5 text-[14px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/55"
    : "max-h-52 min-h-[84px] w-full resize-none bg-transparent px-3 py-1.5 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/55";
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
          <div className="pointer-events-auto flex max-w-md flex-wrap items-center justify-center gap-2">
            {STARTER_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onInputChange(p)}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                {p}
              </button>
            ))}
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
              // A milestone carries its facts as data, so it is matched on the
              // payload — not on a content prefix like the review notice below,
              // which has to sniff a string because those rows come back from the
              // DB with nothing but their text.
              if (msg.milestone) {
                return (
                  <StudioEventCard
                    key={messageId}
                    title={msg.content}
                    milestone={msg.milestone}
                  />
                );
              }
              // Fase A · E2.2 — the visual-direction confirmation card. The
              // "Continue" tap confirms and generates; swap / use-mine land
              // with E2.3 / E2.4.
              if (msg.referenceDirection) {
                return (
                  <ReferenceDirectionCard
                    key={messageId}
                    data={msg.referenceDirection}
                    onContinue={onConfirmDirection}
                    onPreferAnother={onPreferAnotherDirection}
                  />
                );
              }
              if (msg.content.startsWith("The Noon team")) {
                return <ReviewNoticeCard key={messageId} content={msg.content} />;
              }
              const isLive = i === liveActivityIndex;
              return (
                <StudioActivityBlock
                  key={messageId}
                  content={msg.content}
                  phase={isLive ? phase : "prototype_ready"}
                  trace={isLive ? prototypeTrace : null}
                  startedAt={isLive ? pollingStartedAt : null}
                />
              );
            }
            const persistedMessageId = msg.id;
            const feedback =
              persistedMessageId &&
              Object.prototype.hasOwnProperty.call(feedbackByMessageId, persistedMessageId)
                ? feedbackByMessageId[persistedMessageId] ?? undefined
                : msg.feedback ?? undefined;
            // Fase A · E2.4 — Maxwell's reference question carries its three
            // answers as buttons: the action lives in the message, not in a
            // menu. Tapping one sends that label as the client's reply.
            const quick = msg.quickActions;
            return (
              <div key={messageId}>
              <AssistantMessage
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
              {quick && onQuickAnswer && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { label: quick.hasMine, focus: true },
                    { label: quick.chooseForMe, focus: false },
                    { label: quick.skip, focus: false },
                  ].map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      disabled={isThinking}
                      onClick={() => onQuickAnswer(action.label, action.focus)}
                      className="rounded-[6px] border border-border px-3 py-1.5 text-[13px] font-medium text-foreground/85 transition-colors hover:bg-secondary/60 disabled:opacity-50"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
              </div>
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
                    <p className="font-medium text-foreground/85">{t("replyingToMaxwell")}</p>
                    <p className="mt-1 max-h-10 overflow-hidden leading-relaxed text-muted-foreground">
                      {replyTarget.excerpt}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={t("cancelReply")}
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
              {/* Attached file badges (ported from the home hero composer).
                  E2.4 adds one badge per extra reference image, each
                  removable on its own. */}
              {extraImages.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-1.5 pb-1">
                  {extraImages.map((image, index) => (
                    <span
                      key={`${image.name}-${index}`}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-medium text-foreground"
                    >
                      <span className="truncate">{image.name}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${image.name}`}
                        onClick={() =>
                          onExtraImagesChange?.(extraImages.filter((_, i) => i !== index))
                        }
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {attachedFile && (
                <div className="px-1.5 pb-1">
                  <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-medium text-foreground">
                    <span className="truncate">{attachedFile.name}</span>
                    <button
                      type="button"
                      aria-label={t("removeAttachment")}
                      onClick={() => onAttachChange(null)}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                </div>
              )}

              {/* Bottom row — attach menu (left) + send (right), home-style. */}
              <div className="mt-1 flex items-center justify-between gap-2 px-1.5 pb-1 pt-1">
                <div className="relative" ref={attachMenuRef}>
                  {/* `multiple` serves the reference rule: several images of
                      ONE reference in a single pick. Picking one file is
                      unchanged, and non-image extras are ignored. */}
                  <input ref={fileInputRef} type="file" multiple accept="image/*,.txt,.md,.csv,.json,.doc,.docx" className="hidden" onChange={handleFileChange} />
                  <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
                  <button
                    type="button"
                    aria-label={t("add")}
                    onClick={() => {
                      setAttachMenuOpen((v) => !v);
                      setUrlInputMode(null);
                      setUrlInputValue("");
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-foreground transition-opacity hover:opacity-70"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  {attachMenuOpen && (
                    <div className="liquid-glass-card absolute bottom-10 left-0 z-50 w-52 overflow-hidden rounded-[10px]">
                      {!urlInputMode ? (
                        <div className="py-1">
                          <VoiceInputMenuItem
                            value={input}
                            onChange={onInputChange}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-secondary"
                            iconClassName="h-4 w-4 text-muted-foreground"
                          />
                          <div className="my-1 h-px bg-border" />
                          <button type="button" onClick={() => { fileInputRef.current?.click(); setAttachMenuOpen(false); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-secondary">
                            <Upload className="h-4 w-4 text-muted-foreground" />
                            Upload file
                          </button>
                          <button type="button" onClick={() => { pdfInputRef.current?.click(); setAttachMenuOpen(false); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-secondary">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            Upload PDF
                          </button>
                          <div className="my-1 h-px bg-border" />
                          <button type="button" onClick={() => setUrlInputMode("github")} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-secondary">
                            <Github className="h-4 w-4 text-muted-foreground" />
                            Import from GitHub
                          </button>
                          <button type="button" onClick={() => setUrlInputMode("vercel")} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-secondary">
                            <TriangleIcon className="h-4 w-4 text-muted-foreground" />
                            Import from Vercel
                          </button>
                          <button type="button" onClick={() => setUrlInputMode("image")} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-secondary">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            Image URL
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2 p-3">
                          <p className="text-xs font-medium text-muted-foreground">
                            {urlInputMode === "github" ? "GitHub repository" : urlInputMode === "vercel" ? "Vercel project" : "Image URL"}
                          </p>
                          <input
                            type="text"
                            autoFocus
                            value={urlInputValue}
                            onChange={(e) => setUrlInputValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void handleUrlImport();
                              if (e.key === "Escape") { setUrlInputMode(null); setUrlInputValue(""); }
                            }}
                            placeholder={urlInputMode === "github" ? "github.com/user/repo" : urlInputMode === "vercel" ? "vercel.com/project" : "https://..."}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-foreground/30"
                          />
                          <div className="flex gap-2">
                            <button type="button" onClick={() => void handleUrlImport()} disabled={urlInputLoading || !urlInputValue.trim()} className="flex-1 rounded-lg bg-[#0056FD] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0047e0] disabled:opacity-40">
                              {urlInputLoading ? "Importing…" : "Import"}
                            </button>
                            <button type="button" onClick={() => { setUrlInputMode(null); setUrlInputValue(""); }} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

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
                  className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0056FD] text-white transition-colors hover:bg-[#0047e0] disabled:opacity-40"
                >
                  {isThinking ? (
                    <Square className="h-3 w-3 fill-current" />
                  ) : (
                    <ArrowUp className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
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
