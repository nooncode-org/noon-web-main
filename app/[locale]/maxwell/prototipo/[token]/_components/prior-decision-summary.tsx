/**
 * app/[locale]/maxwell/prototipo/[token]/_components/prior-decision-summary.tsx
 *
 * Read-only banner shown when the client has already decided on this
 * prototipo (`decision.status === 'accepted' | 'rejected'`). Renders alongside
 * `PrototipoFrame` so the client can still review the artifact.
 *
 * Copy is editorial — owner review pending per D-slice plan §11.
 */

import type { PrototipoRenderData } from "@/lib/maxwell/prototipo-render-types";

type Props = {
  data: PrototipoRenderData;
};

function formatDecidedAt(iso: string | null) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("es-AR", {
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

export function PriorDecisionSummary({ data }: Props) {
  const { decision } = data;
  const decidedAt = formatDecidedAt(decision.decidedAt);

  if (decision.status === "accepted") {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-5 text-sm text-emerald-900 dark:text-emerald-100"
      >
        <p className="font-medium">Ya aceptaste este prototipo.</p>
        <p className="mt-1 text-emerald-900/80 dark:text-emerald-100/80">
          El vendedor recibió tu aceptación y te va a contactar con la propuesta detallada.
          {decidedAt && <> Decisión registrada el {decidedAt}.</>}
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
        <p className="font-medium">Rechazaste este prototipo.</p>
        <p className="mt-1 text-amber-900/80 dark:text-amber-100/80">
          El vendedor lo va a tomar en cuenta para generar una nueva versión.
          {decidedAt && <> Decisión registrada el {decidedAt}.</>}
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
