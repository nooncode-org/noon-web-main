import { Blocks, UserRound, Building2, ShieldCheck } from "lucide-react";

// BuildOptionsCompare — the honest 4-way comparison (audit §3.1: "Noon vs
// traditional dev vs no-code vs in-house — honest, outcome-framed"). Strictly
// qualitative: every cell is either an approved site claim (review wedge,
// ownership, "collapses when logic gets serious") or an uncontroversial trait
// of the alternative — no invented numbers, and the alternatives get their
// fair "best when". Desktop renders a hairline matrix; mobile stacks one card
// per option. Server-safe (no hooks).

const DIMENSIONS = [
  "What you get",
  "Who reviews the work",
  "Ownership & lock-in",
  "When logic gets serious",
  "Best when",
] as const;

type Option = {
  name: string;
  icon: typeof Blocks;
  highlight?: boolean;
  values: [string, string, string, string, string]; // one per dimension
};

const OPTIONS: Option[] = [
  {
    name: "No-code builders",
    icon: Blocks,
    values: [
      "Flows assembled inside a platform",
      "Nobody — you are the QA",
      "Platform lock-in; you rent the logic",
      "Workarounds pile up, then it collapses",
      "Prototyping or simple sites",
    ],
  },
  {
    name: "Freelancers",
    icon: UserRound,
    values: [
      "Code — quality varies by person",
      "Usually no second pair of eyes",
      "Yours, if the handoff is clean",
      "Depends on one person's ceiling",
      "Small, well-bounded tasks",
    ],
  },
  {
    name: "In-house team",
    icon: Building2,
    values: [
      "Full control, built over time",
      "Your senior engineers — if you have them",
      "Fully yours",
      "Scales with the team you hired",
      "Long-term scale justifies the payroll",
    ],
  },
  {
    name: "Noon",
    icon: ShieldCheck,
    highlight: true,
    values: [
      "Production software, scoped and shipped",
      "A senior engineer signs every change",
      "Yours — code, repository, and IP",
      "Built for it from the start — a real codebase",
      "You need real software without building a team",
    ],
  },
];

export function BuildOptionsCompare() {
  return (
    <section className="site-section">
      <div className="site-shell">
        <div className="mb-8 max-w-3xl lg:mb-10">
          <span className="site-meta-label mb-4 inline-flex items-center gap-3 font-mono text-muted-foreground">
            <span className="h-px w-8 bg-foreground/30" />
            The honest comparison
          </span>
          <h2 className="site-section-title mb-4">Four ways to get software built.</h2>
          <p className="site-section-copy text-muted-foreground">
            Each one is right for someone. Here&apos;s where each fits — and where Noon does.
          </p>
        </div>

        {/* desktop: hairline matrix (dimension rows × option columns) */}
        <div className="hidden overflow-hidden rounded-[12px] border border-foreground/10 lg:block">
          <div className="grid grid-cols-[170px_repeat(4,1fr)] gap-px bg-foreground/10 text-sm">
            <div className="bg-background p-4" />
            {OPTIONS.map((o) => {
              const Icon = o.icon;
              return (
                <div
                  key={o.name}
                  className={`flex items-center gap-2.5 p-4 ${
                    o.highlight ? "bg-primary/[0.05]" : "bg-background"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] ${
                      o.highlight ? "bg-primary/10 text-primary" : "bg-foreground/[0.05] text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <span className={`font-semibold ${o.highlight ? "text-primary" : "text-foreground"}`}>
                    {o.name}
                  </span>
                </div>
              );
            })}

            {DIMENSIONS.map((dim, di) => (
              <div key={dim} className="contents">
                <div className="bg-background p-4 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground/70">
                  {dim}
                </div>
                {OPTIONS.map((o) => (
                  <div
                    key={o.name + dim}
                    className={`p-4 leading-snug ${
                      o.highlight ? "bg-primary/[0.05] text-foreground" : "bg-background text-muted-foreground"
                    }`}
                  >
                    {o.values[di]}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* mobile: one card per option */}
        <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
          {OPTIONS.map((o) => {
            const Icon = o.icon;
            return (
              <div
                key={o.name}
                className={`rounded-[12px] border p-5 ${
                  o.highlight ? "border-primary/30 bg-primary/[0.04]" : "border-foreground/10 bg-background"
                }`}
              >
                <div className="mb-4 flex items-center gap-2.5">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] ${
                      o.highlight ? "bg-primary/10 text-primary" : "bg-foreground/[0.05] text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <span className={`text-[15px] font-semibold ${o.highlight ? "text-primary" : "text-foreground"}`}>
                    {o.name}
                  </span>
                </div>
                <dl className="space-y-3">
                  {DIMENSIONS.map((dim, di) => (
                    <div key={dim}>
                      <dt className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground/60">
                        {dim}
                      </dt>
                      <dd className="mt-0.5 text-sm leading-snug text-foreground/85">{o.values[di]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
