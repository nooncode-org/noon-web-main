/**
 * app/[locale]/maxwell/prototipo/[token]/_components/prior-decision-summary.tsx
 *
 * Read-only banner shown when the client has already decided on this
 * prototipo (`decision.status === 'accepted' | 'rejected'`). Renders alongside
 * `PrototipoFrame` so the client can still review the artifact.
 *
 * Copy comes from the `prototipo.priorDecision` message catalog; the decision
 * date is formatted in the active locale.
 */

import { getLocale, getTranslations } from "next-intl/server";

import type { PrototipoRenderData } from "@/lib/maxwell/prototipo-render-types";

type Props = {
  data: PrototipoRenderData;
};

function formatDecidedAt(iso: string | null, locale: string) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

export async function PriorDecisionSummary({ data }: Props) {
  const t = await getTranslations("prototipo.priorDecision");
  const locale = await getLocale();
  const { decision } = data;
  const decidedAt = formatDecidedAt(decision.decidedAt, locale);

  if (decision.status === "accepted") {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-5 text-sm text-emerald-900 dark:text-emerald-100"
      >
        <p className="font-medium">{t("acceptedTitle")}</p>
        <p className="mt-1 text-emerald-900/80 dark:text-emerald-100/80">
          {t("acceptedBody")}
          {decidedAt && <> {t("decidedAt", { date: decidedAt })}</>}
        </p>
      </aside>
    );
  }

  if (decision.status === "rejected") {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-6 py-5 text-sm text-amber-900 dark:text-amber-100"
      >
        <p className="font-medium">{t("rejectedTitle")}</p>
        <p className="mt-1 text-amber-900/80 dark:text-amber-100/80">
          {t("rejectedBody")}
          {decidedAt && <> {t("decidedAt", { date: decidedAt })}</>}
        </p>
        {decision.notes && (
          <blockquote className="mt-3 border-l-2 border-amber-500/40 pl-3 italic">
            “{decision.notes}”
          </blockquote>
        )}
      </aside>
    );
  }

  return null;
}
