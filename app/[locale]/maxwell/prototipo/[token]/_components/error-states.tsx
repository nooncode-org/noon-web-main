/**
 * app/[locale]/maxwell/prototipo/[token]/_components/error-states.tsx
 *
 * Renders the deterministic UX copy for each non-`ok` bucket produced by
 * `mapRenderResultToUxState` (ADR-024 error taxonomy). The page-level
 * orchestrator passes the UX state; this component owns the visual treatment
 * per kind and pulls the copy from the `prototipo.renderErrors` message catalog
 * (English is served at launch; other locales redirect to /en — see
 * `i18n/launch-locales.ts`).
 */

import { getTranslations } from "next-intl/server";

import type { PrototipoRenderUxState } from "@/lib/maxwell/prototipo-render-types";

type Props = {
  state: Exclude<
    PrototipoRenderUxState,
    | { kind: "ready.pending"; data: unknown }
    | { kind: "ready.accepted"; data: unknown }
    | { kind: "ready.rejected"; data: unknown }
    | { kind: "ready.preparing"; data: unknown }
  >;
};

type Tone = "neutral" | "warning" | "info" | "danger";

/** kind → tone + message-key stem (catalog holds `${stem}Title` / `${stem}Body`). */
function toneAndStem(state: Props["state"]): { tone: Tone; stem: string } {
  switch (state.kind) {
    case "terminal.invalid-link":
      return { tone: "warning", stem: "invalidLink" };
    case "expired.regenerated":
      return { tone: "info", stem: "regenerated" };
    case "expired.lead-deleted":
      return { tone: "neutral", stem: "leadDeleted" };
    case "transient.auth-failed":
      return { tone: "danger", stem: "authFailed" };
    case "transient.rate-limited":
      return { tone: "warning", stem: "rateLimited" };
    case "transient.internal-failed":
      return { tone: "danger", stem: "internalFailed" };
    case "fatal.unknown":
      return { tone: "danger", stem: "unknown" };
  }
}

const toneClass: Record<Tone, string> = {
  neutral: "border-border bg-card text-foreground",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100",
  danger:
    "border-destructive/30 bg-destructive/10 text-destructive-foreground dark:text-destructive-foreground",
};

export async function ErrorStates({ state }: Props) {
  const t = await getTranslations("prototipo.renderErrors");
  const { tone, stem } = toneAndStem(state);
  const title = t(`${stem}Title`);
  const body =
    state.kind === "fatal.unknown"
      ? t("unknownBody", { status: String(state.httpStatus) })
      : t(`${stem}Body`);

  return (
    <section
      role="alert"
      aria-live="assertive"
      className={`rounded-2xl border px-6 py-6 ${toneClass[tone]}`}
    >
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="mt-2 text-sm opacity-90">{body}</p>
    </section>
  );
}
