/**
 * app/[locale]/maxwell/tracepreview/page.tsx
 *
 * Dev-only bench for the chat's build trace (`StudioActivityBlock`).
 *
 * **Why it exists.** The trace only appears while v0 is actually generating, so
 * reviewing its design used to mean burning a real generation (and waiting for
 * the exact second a given stage happened to be on screen). This renders the
 * REAL component — not a copy — in every stage at once, so a design change can
 * be seen immediately and the stages can be compared side by side.
 *
 * Same hard gate as `wspreview`: anywhere but `next dev` it plain doesn't exist,
 * which is what makes it safe to commit.
 */
import { notFound } from "next/navigation";
import { GeistSans } from "geist/font/sans";
import { StudioActivityBlock } from "@/components/maxwell/studio-chat-pane";
import { PROTOTYPE_STAGE_ORDER } from "@/lib/maxwell/prototype-stage";
import { ChatBench } from "./chat-bench";

export const dynamic = "force-dynamic";

// Real-shaped v0 output: these are the kind of paths v0 actually emits, so the
// chips are reviewed at their true length rather than at a flattering one.
const FILE_NAMES = [
  "app/page.tsx",
  "components/hero-section.tsx",
  "components/feature-grid.tsx",
  "components/site-footer.tsx",
  "lib/utils.ts",
];

// Anchored at import rather than per render: the counter is a client-side clock
// against this value, so a fixed anchor makes it tick like a real run instead of
// resetting on every refresh (and keeps render pure).
const BENCH_STARTED_AT = Date.now();

export default async function TracePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const startedAt = BENCH_STARTED_AT;

  return (
    <div className={`${GeistSans.className} min-h-screen bg-background p-10`}>
      <div className="mx-auto max-w-6xl">
        <h1 className="text-lg font-medium">Build trace — every stage</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          The real <code className="font-mono text-[12px]">StudioActivityBlock</code>, one copy per
          stage the poll endpoint can report. Dev-only bench: the live chat shows exactly one of
          these at a time.
        </p>

        {/* In context first — the block on its own tells you nothing about how it
            sits against the rest of the conversation. */}
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium">In the chat</h2>
          <ChatBench startedAt={BENCH_STARTED_AT} />
        </section>

        <h2 className="mb-3 mt-12 text-sm font-medium">Every stage, in isolation</h2>
        <div className="grid gap-8 lg:grid-cols-2">
          {PROTOTYPE_STAGE_ORDER.map((stage) => (
            <section key={stage} className="rounded-[8px] border border-border p-5">
              <p className="mb-4 font-mono text-[11px] uppercase tracking-wide text-muted-foreground/70">
                stage: {stage}
              </p>
              <StudioActivityBlock
                content="Turning your brief into an interactive prototype."
                phase="generating_prototype"
                startedAt={startedAt}
                trace={{
                  stage,
                  // Nothing written yet at the very start — the file sub-result
                  // has to be reviewed in its empty state too.
                  fileCount: stage === "generating" ? 3 : 12,
                  fileNames: stage === "generating" ? FILE_NAMES.slice(0, 3) : FILE_NAMES,
                }}
              />
            </section>
          ))}

          <section className="rounded-[8px] border border-border p-5">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-wide text-muted-foreground/70">
              finished (history checkpoint)
            </p>
            <StudioActivityBlock
              content="Turning your brief into an interactive prototype."
              phase="prototype_ready"
              trace={null}
              startedAt={null}
            />
          </section>

          <section className="rounded-[8px] border border-border p-5">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-wide text-muted-foreground/70">
              first poll not back yet (no files)
            </p>
            <StudioActivityBlock
              content="Turning your brief into an interactive prototype."
              phase="generating_prototype"
              trace={null}
              startedAt={startedAt}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
