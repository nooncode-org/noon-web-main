"use client";

/**
 * Dev-only bench: the trace inside the REAL chat.
 *
 * Renders `<StudioChatPane>` itself — the same component the studio mounts — fed
 * a mock conversation, so what shows here is what a client would actually see:
 * true column width, the trace's spacing against the surrounding messages, the
 * composer below it. A hand-built mock-up of the chat would drift from the real
 * one the first time either changed; this can't.
 *
 * Only the handlers are stubs. Nothing in `StudioChatPane` is reimplemented.
 */
import { useRef, useState } from "react";
import { StudioChatPane } from "@/components/maxwell/studio-chat-pane";
import type { ChatMessage, PrototypeTrace } from "@/components/maxwell/studio-shell";
import { PROTOTYPE_STAGE_ORDER, type PrototypeStage } from "@/lib/maxwell/prototype-stage";

/** Anchored to the run's start so the "x ago" stamp reads like a real reply. */
function buildMessages(startedAt: number): ChatMessage[] {
  return [
    {
      id: "m1",
      role: "user",
      content: "A landing page for my coffee subscription — hero, plans, and a signup form.",
    },
    {
      id: "m2",
      role: "assistant",
      content:
        "Got it. A subscription landing page: one strong hero, three plan tiers, and a signup form that captures email and plan choice. I'll build a first interactive version you can click through.",
      createdAt: new Date(startedAt).toISOString(),
    },
    {
      id: "m3",
      role: "assistant",
      type: "system_event",
      content: "Turning your brief into an interactive prototype.",
    },
  ];
}

const FILE_NAMES = ["app/page.tsx", "components/hero-section.tsx", "components/plan-cards.tsx"];

export function ChatBench({ startedAt }: { startedAt: number }) {
  const [stage, setStage] = useState<PrototypeStage>("assembling");
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const trace: PrototypeTrace = {
    stage,
    fileCount: stage === "generating" ? 3 : 12,
    fileNames: FILE_NAMES,
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground/70">
          stage:
        </span>
        {PROTOTYPE_STAGE_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStage(s)}
            className={`rounded-[6px] border px-2.5 py-1 font-mono text-[11px] transition-colors ${
              s === stage
                ? "border-foreground/30 bg-secondary text-foreground"
                : "border-border text-muted-foreground hover:bg-secondary/50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* The studio's own chat column geometry (lg:w-[440px] in the shell, which
          the resizable split can widen) with the height it really gets. */}
      <div className="h-[760px] w-full max-w-[520px] overflow-hidden rounded-[8px] border border-border">
        <StudioChatPane
          messages={buildMessages(startedAt)}
          isThinking={false}
          input={input}
          onInputChange={setInput}
          onSend={() => {}}
          attachedFile={null}
          onAttachChange={() => {}}
          onStop={() => {}}
          replyTarget={null}
          onReplyToMessage={() => {}}
          onClearReply={() => {}}
          onRegenerateLatest={() => {}}
          stopNotice={null}
          inputRef={inputRef}
          // The shell's `canSendMessage` includes generating_prototype, so the
          // composer IS on screen while a build runs. The bench has to match, or
          // it misreports how much room the trace actually gets.
          canSend
          phase="generating_prototype"
          prototypeTrace={trace}
          pollingStartedAt={startedAt}
          correctionsUsed={0}
          maxCorrections={2}
          prototypeVersionNumber={0}
          onApprove={() => {}}
          onRequestCorrection={() => {}}
          onRequestProposal={() => {}}
          agentHref="/en/contact"
          isWorkspaceVisible={false}
        />
      </div>
    </div>
  );
}
