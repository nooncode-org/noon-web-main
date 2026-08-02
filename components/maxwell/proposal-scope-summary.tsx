import { Check } from "lucide-react";
import {
  parseProposalBlocks,
  stripInternalReviewFlags,
} from "@/lib/maxwell/proposal-content";

/**
 * The client-facing replacement for the proposal DOCUMENT (owner, 2026-08-01):
 * the consultancy costume — executive summary, discovery phases, week counts —
 * contradicted the real model, where the AI starts generating the MVP the
 * moment payment clears. So the client never reads a "document" again; the
 * decision page states the scope directly, and delivery is told as it actually
 * happens.
 *
 * Only two sections of the draft survive for the client, because only two are
 * theirs: what gets built, and what does not. The rest of the draft stays a
 * team-side record on /maxwell/review.
 */

type ScopeItem = { title: string; detail: string | null };

/** Blocks under a heading matching `re`, up to the next heading. */
function sectionBlocks(
  blocks: ReturnType<typeof parseProposalBlocks>,
  re: RegExp,
) {
  const start = blocks.findIndex((b) => b.type === "heading" && re.test(b.text));
  if (start === -1) return [];
  const out = [];
  for (let i = start + 1; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === "heading") break;
    out.push(block);
  }
  return out;
}

/** "**Title** — detail" → {title, detail}; anything else is all title. */
function splitItem(raw: string): ScopeItem {
  const match = raw.match(/^\*\*([^*]+)\*\*\s*[—–-]\s*([\s\S]+)$/);
  // Capitalized like the hand-written plan rows these now sit among — the
  // generator writes details as lowercase fragments after the dash.
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (match) return { title: cap(match[1].trim()), detail: cap(match[2].trim()) };
  return { title: cap(raw.replace(/\*\*/g, "").trim()), detail: null };
}

// Scope only — the draft's Exclusions section deliberately never reaches the
// client (owner: the page states what we offer, not what we don't); the team
// reads it on /maxwell/review.
export type ProposalScope = { scope: ScopeItem[] };

/**
 * Heading match covers the generator's English contract and the Spanish drafts
 * it produces when the conversation ran in Spanish. A draft with no scope
 * section (or no draft at all) yields an empty array and the section simply
 * does not render — the page degrades to the cards alone, never to an empty box.
 */
export function extractProposalScope(draftContent: string | null | undefined): ProposalScope {
  const blocks = parseProposalBlocks(stripInternalReviewFlags(draftContent ?? ""));
  const lists = (section: ReturnType<typeof sectionBlocks>) =>
    section.flatMap((b) =>
      b.type === "ordered_list" || b.type === "unordered_list" ? b.items : [],
    );
  return {
    scope: lists(sectionBlocks(blocks, /scope|deliverable|alcance|entregable/i)).map(splitItem),
  };
}

// Exported: the payment table's "Included in every plan" band renders these
// same steps inline (single source for the delivery story).
export const DELIVERY_STEPS: ScopeItem[] = [
  { title: "Choose how to start", detail: "Pick an option above — nothing is charged until you confirm." },
  { title: "Your MVP starts immediately", detail: "The AI begins generating it the moment payment clears." },
  { title: "We finish and ship it", detail: "The Noon team completes it — follow progress live in your portal." },
];

export function ProposalScopeSummary({ scope }: ProposalScope) {
  if (scope.length === 0) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-center text-2xl font-medium text-foreground sm:text-3xl">
        What we&apos;ll build
      </h2>

      {/* Same row anatomy as the plan cards (check / bold title / muted
          detail, zebra) so scope and plans read as one system, not a
          document pasted onto a pricing page. */}
      <ul className="mt-8 overflow-hidden rounded-[6px]">
        {scope.map((item, index) => (
          <li
            key={item.title}
            className={`flex items-start gap-2.5 px-3 py-2.5 ${index % 2 === 0 ? "bg-foreground/[0.035]" : ""}`}
          >
            <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-[#0056fd]" strokeWidth={2.5} />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium leading-snug text-foreground">
                {item.title}
              </span>
              {item.detail && (
                <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">
                  {item.detail}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {/* No "Not included" block (owner: the client-facing page states what we
          offer, never what we don't). The exclusions keep doing their real job
          — fencing scope disputes — in the team-side document on
          /maxwell/review. */}

      {/* Delivery as it actually happens — this replaces the draft's
          "Estimated Timeline" phases, which described a discovery-and-weeks
          process Noon does not run. */}
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {DELIVERY_STEPS.map((step, index) => (
          <div key={step.title}>
            <span className="font-mono text-[11px] text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            <p className="mt-1.5 text-[13px] font-medium leading-snug text-foreground">
              {step.title}
            </p>
            <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{step.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
