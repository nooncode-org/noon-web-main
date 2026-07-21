"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";

/**
 * Editable project title for the workspace header. Click to edit inline;
 * Enter/blur commits, Escape cancels. Front-only: logic-later wires the commit
 * to a server action that persists the renamed title.
 */
export function WorkspaceProjectTitle({ initialTitle }: { initialTitle: string }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [draft, setDraft] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function startEdit() {
    setDraft(title);
    setEditing(true);
  }

  function commit() {
    const trimmed = draft.trim();
    if (trimmed) setTitle(trimmed);
    else setDraft(title);
    setEditing(false);
  }

  function cancel() {
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); cancel(); }
        }}
        className="min-w-[80px] max-w-full rounded-[6px] bg-secondary px-2 py-0.5 text-base font-medium leading-tight outline-none ring-1 ring-[#0056fd]/50 focus:ring-[#0056fd] [field-sizing:content]"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      title="Click to rename"
      className="group inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-[6px] px-1 py-0.5 -mx-1 text-left transition-colors hover:bg-secondary/60"
    >
      <span className="min-w-0 truncate text-base font-medium leading-tight">{title}</span>
      <Pencil
        className="h-3 w-3 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100"
        strokeWidth={1.75}
      />
    </button>
  );
}
