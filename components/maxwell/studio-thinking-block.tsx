"use client";

import { useState } from "react";
import { Brain, ChevronDown, ChevronUp } from "lucide-react";

type StudioThinkingBlockProps = {
  content: string;
};

export function StudioThinkingBlock({ content }: StudioThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="max-w-[68ch] text-xs text-muted-foreground">
      <div className="inline-flex flex-col">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 transition-colors hover:text-foreground"
        >
          <Brain className="w-3 h-3 shrink-0" />
          <span>Thinking</span>
          {expanded ? (
            <ChevronUp className="w-3 h-3 shrink-0" />
          ) : (
            <ChevronDown className="w-3 h-3 shrink-0" />
          )}
        </button>

        {expanded && (
          <div className="mt-2 max-w-[68ch] whitespace-pre-wrap border-l border-border/70 pl-4 text-[11px] leading-6 text-muted-foreground/80">
            {content}
          </div>
        )}
      </div>
    </div>
  );
}
