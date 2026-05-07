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
  const alerts = [userFull ? t("userFull") : null, studioFull ? t("studioFull") : null].filter(
    (s): s is string => Boolean(s),
  );

  return (
    <div
      className="shrink-0 border-b border-border/60 bg-muted/35 px-3 py-1.5 text-[11px] leading-snug text-muted-foreground sm:text-xs"
      title={t("hint")}
    >
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:gap-x-5">
        <span
          className={
            userFull
              ? "font-medium text-amber-800 dark:text-amber-400/95"
              : "text-foreground/85"
          }
        >
          {t("userBadge", { used: u, limit: ul })}
        </span>
        <span className="select-none text-border/80" aria-hidden>
          ·
        </span>
        <span
          className={
            studioFull
              ? "font-medium text-amber-800 dark:text-amber-400/95"
              : "text-foreground/85"
          }
        >
          {t("studioBadge", { used: g, limit: gl })}
        </span>
      </div>
      {alerts.length > 0 ? (
        <p className="mx-auto mt-1 max-w-4xl text-center text-[10px] leading-snug text-amber-800 dark:text-amber-400/95">
          {alerts.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
