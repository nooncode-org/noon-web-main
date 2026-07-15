/**
 * app/[locale]/maxwell/prototipo/[token]/_components/decision-panel.tsx
 *
 * Client component for the accept/reject form on the prototipo page.
 *
 * State machine:
 *   idle ────► choosing (accept | reject) ────► submitting ────► (success → revalidate)
 *                                                          └──► error → show inline banner
 *
 * The server action (`submitDecisionAction`) is passed in via props rather than
 * imported so this component can be unit-tested with a mock and so the page
 * keeps the action wiring explicit. On success the action calls
 * `revalidatePath`, which triggers Next to re-render — the next page render
 * will return `ready.accepted` / `ready.rejected` and `PriorDecisionSummary`
 * replaces this panel.
 *
 * Notes are optional on accept, encouraged on reject (UI hint only — App-side
 * sanitiser truncates to 2000 chars per ADR-023 §6.4). Copy comes from the
 * `prototipo.decision` message catalog.
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PrototipoDecisionUxState } from "@/lib/maxwell/prototipo-decision-types";

import type {
  SubmitDecisionActionInput,
  SubmitDecisionActionResult,
} from "../_actions/submit-decision";

const NOTES_MAX = 2000;

type Mode =
  | { kind: "idle" }
  | { kind: "choosing"; decision: "accepted" | "rejected"; notes: string }
  | { kind: "success"; decision: "accepted" | "rejected" }
  | { kind: "error"; uxState: PrototipoDecisionUxState };

type Props = {
  token: string;
  prototypeWorkspaceId: string;
  submitAction: (input: SubmitDecisionActionInput) => Promise<SubmitDecisionActionResult>;
};

/** UX-state kind → message-key stem under `prototipo.decision.errors`. */
function errorStem(state: PrototipoDecisionUxState): string {
  switch (state.kind) {
    case "terminal.invalid-link":
      return "invalidLink";
    case "terminal.identifier-mismatch":
      return "identifierMismatch";
    case "expired.regenerated":
      return "regenerated";
    case "expired.lead-deleted":
      return "leadDeleted";
    case "transient.persist-failed":
      return "persistFailed";
    case "transient.rate-limited":
      return "rateLimited";
    case "already-decided.read-only":
      return "alreadyDecided";
    case "confirmed.accepted":
    case "confirmed.rejected":
      return "confirmed";
    case "fatal.unknown":
      return "unknown";
  }
}

function ErrorBanner({ uxState }: { uxState: PrototipoDecisionUxState }) {
  const t = useTranslations("prototipo.decision.errors");
  const stem = errorStem(uxState);
  const title = t(`${stem}Title`);
  const body =
    uxState.kind === "fatal.unknown"
      ? t("unknownBody", { status: String(uxState.httpStatus) })
      : t(`${stem}Body`);
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground"
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 opacity-90">{body}</p>
    </div>
  );
}

export function DecisionPanel({ token, prototypeWorkspaceId, submitAction }: Props) {
  const t = useTranslations("prototipo.decision");
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  function startChoosing(decision: "accepted" | "rejected") {
    setMode({ kind: "choosing", decision, notes: "" });
  }

  function cancelChoosing() {
    setMode({ kind: "idle" });
  }

  function updateNotes(value: string) {
    if (mode.kind !== "choosing") return;
    setMode({ ...mode, notes: value.slice(0, NOTES_MAX) });
  }

  function submit() {
    if (mode.kind !== "choosing") return;
    const payload: SubmitDecisionActionInput = {
      token,
      prototypeWorkspaceId,
      decision: mode.decision,
      ...(mode.notes.trim() ? { notes: mode.notes.trim() } : {}),
    };
    startTransition(async () => {
      const result = await submitAction(payload);
      if (
        result.uxState.kind === "confirmed.accepted" ||
        result.uxState.kind === "confirmed.rejected" ||
        result.uxState.kind === "already-decided.read-only"
      ) {
        setMode({ kind: "success", decision: mode.kind === "choosing" ? mode.decision : "accepted" });
        // The action already revalidated the path — refresh to pull the new
        // GET data and let the page swap to PriorDecisionSummary.
        router.refresh();
      } else {
        setMode({ kind: "error", uxState: result.uxState });
      }
    });
  }

  if (mode.kind === "success") {
    return (
      <section
        aria-label={t("sectionLabel")}
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-5 text-sm text-emerald-900 dark:text-emerald-100"
      >
        <p className="font-medium">{t("successTitle")}</p>
        <p className="mt-1 opacity-90">{t("successBody")}</p>
      </section>
    );
  }

  if (mode.kind === "error") {
    return (
      <section aria-label={t("sectionLabel")} className="space-y-3">
        <ErrorBanner uxState={mode.uxState} />
        <Button variant="outline" onClick={() => setMode({ kind: "idle" })}>
          {t("back")}
        </Button>
      </section>
    );
  }

  if (mode.kind === "choosing") {
    const isAccept = mode.decision === "accepted";
    return (
      <section
        aria-label={isAccept ? t("acceptTitle") : t("rejectTitle")}
        className="rounded-2xl border border-border bg-card px-6 py-6 space-y-4"
      >
        <div>
          <h2 className="text-lg font-medium">
            {isAccept ? t("acceptTitle") : t("rejectTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAccept ? t("acceptDescription") : t("rejectDescription")}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="decision-notes" className="text-sm font-medium">
            {isAccept ? t("acceptLabel") : t("rejectLabel")}
          </label>
          <Textarea
            id="decision-notes"
            value={mode.notes}
            onChange={(event) => updateNotes(event.target.value)}
            rows={4}
            placeholder={isAccept ? t("acceptPlaceholder") : t("rejectPlaceholder")}
            maxLength={NOTES_MAX}
          />
          <p className="text-xs text-muted-foreground">
            {mode.notes.length}/{NOTES_MAX}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={submit} disabled={isPending}>
            {isPending
              ? t("submitting")
              : isAccept
                ? t("submitAccept")
                : t("submitReject")}
          </Button>
          <Button
            variant="outline"
            onClick={cancelChoosing}
            disabled={isPending}
          >
            {t("cancel")}
          </Button>
        </div>
      </section>
    );
  }

  // idle
  return (
    <section
      aria-label={t("sectionLabel")}
      className="rounded-2xl border border-border bg-card px-6 py-6 space-y-4"
    >
      <div>
        <h2 className="text-lg font-medium">{t("idleTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("idleBody")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => startChoosing("accepted")}>{t("accept")}</Button>
        <Button variant="outline" onClick={() => startChoosing("rejected")}>
          {t("requestChanges")}
        </Button>
      </div>
      {/* W6 (owner decision 2026-07-14): accepting on this page confirms the
          PROTOTYPE only — never the formal proposal or a charge. Without this
          note, someone landing here from a forwarded link reads "accept" as
          accepting the commercial proposal. */}
      <p className="border-t border-border pt-3 text-xs text-muted-foreground">
        {t("disclaimer")}
      </p>
    </section>
  );
}
