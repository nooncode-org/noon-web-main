"use client";

/**
 * MaxwellDemo — embeds the REAL studio components (header + chat pane) from
 * `components/maxwell/*` on the marketing page, driven by static demo data
 * and local-only handlers. When the product UI evolves, this demo updates
 * automatically — there's no copy of the studio code here, just a wrapper.
 *
 * Side-effects (handlers): all are no-ops or anchor links. The chat pane's
 * one network call (`/api/maxwell/message-feedback`) is fired by an internal
 * fetch that, if it fails (401 here without auth), is silently rolled back
 * by the component itself — it doesn't break the UI.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { Monitor } from "lucide-react";
import { StudioHeader } from "@/components/maxwell/studio-header";
import { StudioChatPane } from "@/components/maxwell/studio-chat-pane";
import type { ReplyTarget } from "@/components/maxwell/studio-shell";
import { getContactHref } from "@/lib/site-config";
import {
  DEMO_MESSAGES,
  DEMO_PROJECT_NAME,
  DEMO_VIEWER_EMAIL,
} from "./demo-data";

const noop = () => {};

export function MaxwellDemo({ className = "" }: { className?: string }) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const agentHref = getContactHref({ inquiry: "general", source: "maxwell-demo" });

  return (
    <div
      className={`overflow-hidden rounded-[12px] border border-foreground/10 bg-background shadow-[0_24px_60px_-30px_rgba(0,0,0,0.55)] ${className}`}
    >
      {/* The real header — interactive (drafts popover, menu drawer, etc.) */}
      <StudioHeader
        projectName={DEMO_PROJECT_NAME}
        phase="prototype_ready"
        correctionsUsed={0}
        maxCorrections={2}
        agentHref={agentHref}
        viewerEmail={DEMO_VIEWER_EMAIL}
        activeView="chat"
        onToggleView={noop}
        hasPrototype={true}
        hasWorkspace={true}
        draftSessions={[]}
        currentSessionId={null}
        onSelectDraftSession={noop}
        onNewDraftChat={noop}
        onDeleteDraftSession={noop}
      />

      {/* Two-pane workspace — chat on the left, preview placeholder on the right.
         Fixed height + min-h-0 on the chat column so the chat pane's internal
         overflow-y-auto + flex-1 layout works as designed. */}
      <div className="grid h-[600px] lg:grid-cols-[440px_1fr]">
        {/* Left: the real chat pane */}
        <div className="min-h-0 overflow-hidden border-b border-foreground/10 lg:border-b-0 lg:border-r">
          <StudioChatPane
            messages={DEMO_MESSAGES}
            isThinking={false}
            input={input}
            onInputChange={setInput}
            onSend={noop}
            onStop={noop}
            replyTarget={replyTarget}
            onReplyToMessage={setReplyTarget}
            onClearReply={() => setReplyTarget(null)}
            onRegenerateLatest={noop}
            stopNotice={null}
            inputRef={inputRef}
            canSend={true}
            phase="prototype_ready"
            correctionsUsed={0}
            maxCorrections={2}
            prototypeVersionNumber={1}
            onApprove={noop}
            onRequestCorrection={noop}
            onRequestProposal={noop}
            agentHref={agentHref}
            isWorkspaceVisible={true}
          />
        </div>

        {/* Right: preview placeholder (phase 2 will replace this with a real
           static prototype rendering — keeping the chat alive in phase 1
           means we ship the demo today and iterate on the preview next) */}
        <PreviewPlaceholder />
      </div>

      {/* Footer CTA */}
      <div className="border-t border-foreground/10 px-5 py-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          This is the real Maxwell studio — interactive demo with sample data.
        </span>
        <Link
          href="/en/maxwell/studio"
          className="text-foreground/85 underline-offset-4 hover:underline"
        >
          Open the real studio →
        </Link>
      </div>
    </div>
  );
}

function PreviewPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-8 py-12 text-center bg-secondary/30">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
        <Monitor className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground/85">Working prototype</p>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
          Maxwell generates a real, interactive prototype here — sign in to try
          it yourself.
        </p>
      </div>
      <Link
        href="/en/maxwell/studio"
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Open the studio
      </Link>
    </div>
  );
}
