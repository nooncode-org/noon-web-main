"use client";

import { useTranslations } from "next-intl";
import type { PrototypeQuotaSnapshot } from "@/lib/maxwell/prototype-quota";

export function PrototypeQuotaStrip({ snapshot }: { snapshot: PrototypeQuotaSnapshot }) {
  const t = useTranslations("maxwellStudio.quota");
  const u = snapshot.userDistinctSessionsWithV1ThisUtcMonth;
  const ul = snapshot.userMonthlyInitialLimit;
  const g = snapshot.globalInitialPrototypesThisUtcMonth;
  const gl = snapshot.globalMonthlyInitialLimit;
  const userFull = u >= ul;
  const studioFull = g >= gl;
  const anyFull = userFull || studioFull;
  const alerts = [userFull ? t("userFull") : null, studioFull ? t("studioFull") : null].filter(
    (s): s is string => Boolean(s),
  );

  return (
    <div
      className={`shrink-0 px-3 py-1 text-[11px] leading-snug sm:text-xs ${
        anyFull ? "border-b border-amber-500/30 bg-amber-500/10" : "border-b border-border/50"
      }`}
      title={t("hint")}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5">
        <span
          className={
            userFull
              ? "font-medium text-amber-800 dark:text-amber-400/95"
              : "text-muted-foreground/70"
          }
        >
          {t("userBadge", { used: u, limit: ul })}
        </span>
        <span className="select-none text-border/70" aria-hidden>
          ·
        </span>
        <span
          className={
            studioFull
              ? "font-medium text-amber-800 dark:text-amber-400/95"
              : "text-muted-foreground/70"
          }
        >
          {t("studioBadge", { used: g, limit: gl })}
        </span>
      </div>
      {alerts.length > 0 ? (
        <p className="mt-1 text-center text-[10px] leading-snug text-amber-800 dark:text-amber-400/95">
          {alerts.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
