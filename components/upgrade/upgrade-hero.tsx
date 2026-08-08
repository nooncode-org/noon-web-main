import { useTranslations } from "next-intl";
import { Globe, Sparkles } from "lucide-react";

const LOOP = "10s";
const BRAND = "#4155ef";
const BRAND_DEEP = "#1200c5";

export function UpgradeHero() {
  const t = useTranslations("upgradeTool");
  return (
    <div
      aria-hidden="true"
      className="relative h-[420px] w-full"
    >
      {/* Technical guide rails behind the audit cards */}
      <div className="pointer-events-none absolute inset-x-[6%] top-[18%] h-px bg-foreground/10" />
      <div className="pointer-events-none absolute bottom-[20%] left-[8%] right-[4%] grid grid-cols-3 gap-2">
        {["crawl", "rewrite", "handoff"].map((item) => (
          <div key={item} className="rounded-md border border-foreground/8 bg-background/35 px-3 py-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-foreground/45">{item}</span>
          </div>
        ))}
      </div>

      {/* ─── Back card — site mockup (gets "upgraded") ───────────────── */}
      <div
        className="absolute left-[2%] top-[12%] w-[78%]"
        style={{ transform: "rotate(-2.5deg)" }}
      >
        <div className="relative rounded-[10px] liquid-glass-card overflow-hidden">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 border-b border-foreground/8 px-3 py-2">
            <div className="flex gap-1.5">
              <span className="h-2 w-2 rounded-full bg-foreground/15" />
              <span className="h-2 w-2 rounded-full bg-foreground/15" />
              <span className="h-2 w-2 rounded-full bg-foreground/15" />
            </div>
            <div className="ml-2 flex flex-1 items-center gap-1.5 rounded-md bg-foreground/5 px-2 py-1">
              <Globe className="h-2.5 w-2.5 text-foreground/40" />
              <span className="font-mono text-[9px] text-foreground/50">yourwebsite.com</span>
            </div>
          </div>

          {/* Site content — two layers stacked: "old" (grey) and "new" (brand) */}
          <div className="relative">
            {/* OLD layer — visible by default, fades out during brighten */}
            <div
              className="upgrade-anim space-y-3 p-4"
              style={{
                animation: `upgrade-fade-old ${LOOP} ease-in-out infinite`,
              }}
            >
              <div className="h-2.5 w-1/2 rounded bg-foreground/15" />
              <div className="space-y-1.5">
                <div className="h-1.5 w-full rounded bg-foreground/8" />
                <div className="h-1.5 w-[88%] rounded bg-foreground/8" />
                <div className="h-1.5 w-[72%] rounded bg-foreground/8" />
              </div>
              <div className="flex gap-2 pt-1">
                <div className="h-5 w-16 rounded-full bg-foreground/12" />
                <div className="h-5 w-14 rounded-full border border-foreground/15" />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="aspect-[4/3] rounded-md bg-foreground/6" />
                <div className="aspect-[4/3] rounded-md bg-foreground/6" />
                <div className="aspect-[4/3] rounded-md bg-foreground/6" />
              </div>
            </div>

            {/* NEW layer — overlaid in same position, fades in 65-95% */}
            <div
              className="upgrade-anim absolute inset-0 space-y-3 p-4"
              style={{
                animation: `upgrade-brighten ${LOOP} ease-in-out infinite`,
              }}
            >
              <div
                className="h-2.5 w-2/3 rounded"
                style={{
                  background: `linear-gradient(90deg, ${BRAND_DEEP}, ${BRAND})`,
                }}
              />
              <div className="space-y-1.5">
                <div className="h-1.5 w-full rounded" style={{ background: `${BRAND}40` }} />
                <div className="h-1.5 w-[92%] rounded" style={{ background: `${BRAND}30` }} />
                <div className="h-1.5 w-[80%] rounded" style={{ background: `${BRAND}25` }} />
              </div>
              <div className="flex gap-2 pt-1">
                <div
                  className="h-5 w-20 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${BRAND_DEEP}, ${BRAND})`,
                    boxShadow: `0 4px 12px ${BRAND_DEEP}55`,
                  }}
                />
                <div
                  className="h-5 w-14 rounded-full border"
                  style={{ borderColor: `${BRAND}55` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div
                  className="aspect-[4/3] rounded-md"
                  style={{ background: `linear-gradient(135deg, ${BRAND}25, ${BRAND}10)` }}
                />
                <div
                  className="aspect-[4/3] rounded-md"
                  style={{ background: `linear-gradient(135deg, ${BRAND_DEEP}25, ${BRAND}15)` }}
                />
                <div
                  className="aspect-[4/3] rounded-md"
                  style={{ background: `linear-gradient(135deg, ${BRAND}30, ${BRAND_DEEP}15)` }}
                />
              </div>
            </div>

            {/* Scan-line overlay — sweeps top→bottom 50-78% */}
            <div
              className="upgrade-anim pointer-events-none absolute inset-x-0 top-0 h-[3px]"
              style={{
                background: `linear-gradient(180deg, transparent, ${BRAND}, transparent)`,
                boxShadow: `0 0 16px 2px ${BRAND}80`,
                animation: `upgrade-scan-sweep ${LOOP} ease-in-out infinite`,
              }}
            />
          </div>
        </div>
      </div>

      {/* ─── Front card — Maxwell prompt (URL types, button pulses) ──── */}
      <div
        className="absolute right-[0%] top-[2%] w-[62%]"
        style={{ transform: "rotate(2deg)" }}
      >
        <div className="rounded-[10px] liquid-glass-card">
          <div className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-md"
                style={{ background: `${BRAND}24` }}
              >
                <Sparkles className="h-3 w-3" style={{ color: BRAND }} />
              </div>
              <span className="text-sm font-medium text-foreground">{t("upgradeWithMaxwell")}</span>
            </div>

            {/* URL input — text reveals via clip-path; caret blinks while typing */}
            <div className="relative rounded-md border border-foreground/12 bg-background/50 px-2.5 py-2">
              <div className="relative flex items-center">
                <span
                  className="upgrade-anim font-mono text-[10px] text-foreground/70"
                  style={{
                    animation: `upgrade-type-reveal ${LOOP} steps(40, end) infinite`,
                  }}
                >
                  https://yourwebsite.com
                </span>
                <span
                  className="upgrade-anim ml-0.5 inline-block h-3 w-px"
                  style={{
                    background: BRAND,
                    animation: `upgrade-caret-blink ${LOOP} steps(1, end) infinite`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="h-1.5 w-[85%] rounded bg-foreground/10" />
              <div className="h-1.5 w-[60%] rounded bg-foreground/10" />
            </div>

            <div className="flex justify-end pt-1">
              <div
                className="upgrade-anim inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium"
                style={{
                  background: `linear-gradient(135deg, ${BRAND_DEEP} 0%, ${BRAND} 100%)`,
                  color: "#fff",
                  boxShadow: `0 4px 14px ${BRAND_DEEP}59`,
                  animation: `upgrade-cta-pulse ${LOOP} ease-in-out infinite`,
                }}
              >
                <Sparkles className="h-3 w-3" />
                Generate
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
