// ============================================================================
// TechEcosystem — a Vercel-style "tools & technology" showcase: the real tools
// behind every Noon build, each with its brand-colored logo, role, the value
// it adds, key benefits, and a factual highlight (the tool's own published
// characteristics — not fabricated Noon metrics). Authentic color comes from
// the real brand logos. Fully theme-aware (light + dark).
// ============================================================================

type Tool = {
  name: string;
  role: string;
  logo: string;
  color: string; // brand hex, or "fg" for monochrome brands
  desc: string;
  benefits: [string, string, string];
  highlight: string;
};

const TOOLS: Tool[] = [
  {
    name: "Claude (Opus)",
    role: "Architecture & analysis",
    logo: "/figma/logos/logo-anthropic.svg",
    color: "#D97757",
    desc: "Deep reasoning for architecture decisions, code review, and scaling strategy.",
    benefits: ["Architecture", "Code review", "Scalability"],
    highlight: "Large-context reasoning",
  },
  {
    name: "GPT",
    role: "Ideation & content",
    logo: "/figma/logos/logo-openai.svg",
    color: "#10A37F",
    desc: "Turns rough ideas into a clear scope and content — and accelerates the work.",
    benefits: ["Scoping", "Content", "Speed"],
    highlight: "Idea → spec, fast",
  },
  {
    name: "Stripe",
    role: "Payments",
    logo: "/figma/logos/logo-stripe.svg",
    color: "#635BFF",
    desc: "Secure, fast, reliable payments without building the hard parts yourself.",
    benefits: ["Secure", "Global", "Instant"],
    highlight: "PCI-DSS Level 1 · 135+ currencies",
  },
  {
    name: "Vercel",
    role: "Deployment",
    logo: "/figma/logos/logo-vercel.svg",
    color: "fg",
    desc: "Instant deploys and high performance on a global edge network.",
    benefits: ["Edge", "Instant deploys", "Auto-scale"],
    highlight: "Global edge network",
  },
  {
    name: "Supabase",
    role: "Backend & data",
    logo: "/figma/logos/logo-supabase.svg",
    color: "#3ECF8E",
    desc: "Managed Postgres with authentication, realtime, and storage built in.",
    benefits: ["Postgres", "Auth", "Realtime"],
    highlight: "Open-source · Postgres-native",
  },
  {
    name: "Next.js",
    role: "Framework",
    logo: "/figma/logos/logo-nextjs.svg",
    color: "fg",
    desc: "Production-grade React with server rendering and edge performance.",
    benefits: ["SSR", "Routing", "Performance"],
    highlight: "React framework",
  },
];

const ALSO: { src: string; alt: string; color: string }[] = [
  { src: "/figma/logos/logo-typescript.svg", alt: "TypeScript", color: "#3178C6" },
  { src: "/figma/logos/logo-react.svg", alt: "React", color: "#61DAFB" },
  { src: "/figma/logos/logo-tailwind.svg", alt: "Tailwind CSS", color: "#06B6D4" },
  { src: "/figma/logos/logo-nodejs.svg", alt: "Node.js", color: "#5FA04E" },
  { src: "/figma/logos/logo-python.svg", alt: "Python", color: "#3776AB" },
  { src: "/figma/logos/logo-postgresql.svg", alt: "PostgreSQL", color: "#4169E1" },
  { src: "/figma/logos/logo-flutter.svg", alt: "Flutter", color: "#0468D7" },
];

function MaskLogo({ src, color, alt, className }: { src: string; color: string; alt: string; className: string }) {
  return (
    <span
      role="img"
      aria-label={alt}
      className={className}
      style={{
        backgroundColor: color === "fg" ? "var(--color-foreground)" : color,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

export function TechEcosystem() {
  return (
    <div>
      {/* Key tools — one card each: logo, role, value, benefits, factual highlight */}
      <div className="overflow-hidden rounded-[10px] border border-foreground/10">
        <div className="grid gap-px bg-foreground/10 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => (
            <div
              key={t.name}
              className="group flex flex-col bg-background p-5 transition-colors duration-300 hover:bg-card/40 lg:p-6"
            >
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-foreground/10 bg-card/40">
                  <MaskLogo src={t.logo} color={t.color} alt={t.name} className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight text-foreground">{t.name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/60">{t.role}</p>
                </div>
              </div>
              <p className="text-sm leading-snug text-muted-foreground">{t.desc}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {t.benefits.map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center rounded-full border border-foreground/10 bg-card/40 px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {b}
                  </span>
                ))}
              </div>
              <div className="mt-auto flex items-center gap-1.5 pt-4 text-[11px] text-foreground/75">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: t.color === "fg" ? "var(--color-foreground)" : t.color }}
                />
                {t.highlight}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Also in the stack — the rest of the toolset, brand-colored */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/60">
          Also in the stack
        </span>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {ALSO.map((l) => (
            <span key={l.alt} className="inline-flex items-center gap-2">
              <MaskLogo src={l.src} color={l.color} alt={l.alt} className="h-4 w-4" />
              <span className="text-[12px] text-muted-foreground">{l.alt}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
