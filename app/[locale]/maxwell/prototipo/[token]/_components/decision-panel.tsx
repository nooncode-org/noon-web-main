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
 * sanitiser truncates to 2000 chars per ADR-023 §6.4).
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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

function ErrorBanner({ uxState }: { uxState: PrototipoDecisionUxState }) {
  const copy = errorCopyFor(uxState);
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground"
    >
      <p className="font-medium">{copy.title}</p>
      <p className="mt-1 opacity-90">{copy.body}</p>
    </div>
  );
}

function errorCopyFor(state: PrototipoDecisionUxState): { title: string; body: string } {
  switch (state.kind) {
    case "terminal.invalid-link":
      return {
        title: "Este link no es válido",
        body: "El link expiró o no corresponde a un prototipo activo. Pedile al vendedor uno nuevo.",
      };
    case "terminal.identifier-mismatch":
      return {
        title: "El link no corresponde al prototipo solicitado",
        body: "Recargá la página y volvé a intentar. Si el problema persiste, contactá al vendedor.",
      };
    case "expired.regenerated":
      return {
        title: "Este prototipo fue actualizado",
        body: "Hay una versión más nueva. Pedile al vendedor el link actualizado.",
      };
    case "expired.lead-deleted":
      return {
        title: "Este prototipo ya no está disponible",
        body: "El proyecto fue removido. Si pensás que es un error, contactá al vendedor.",
      };
    case "transient.persist-failed":
      return {
        title: "No pudimos guardar tu decisión",
        body: "Hubo un error temporal. Probá nuevamente en unos segundos.",
      };
    case "transient.rate-limited":
      return {
        title: "Demasiados intentos",
        body: "Esperá un minuto e intentá de nuevo.",
      };
    case "already-decided.read-only":
      return {
        title: "Ya respondiste a este prototipo",
        body: "Recargá la página para ver tu decisión.",
      };
    case "confirmed.accepted":
    case "confirmed.rejected":
      // Defensive: the panel does not call ErrorBanner with confirmed states.
      return { title: "Decisión registrada", body: "Recargá la página para verla." };
    case "fatal.unknown":
      return {
        title: "No pudimos completar la operación",
        body: `Ocurrió un error inesperado (código ${state.httpStatus}). Recargá e intentá de nuevo.`,
      };
  }
}

export function DecisionPanel({ token, prototypeWorkspaceId, submitAction }: Props) {
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
        aria-label="Tu decisión"
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-5 text-sm text-emerald-900 dark:text-emerald-100"
      >
        <p className="font-medium">¡Listo! Registramos tu decisión.</p>
        <p className="mt-1 opacity-90">Actualizando la vista…</p>
      </section>
    );
  }

  if (mode.kind === "error") {
    return (
      <section aria-label="Tu decisión" className="space-y-3">
        <ErrorBanner uxState={mode.uxState} />
        <Button variant="outline" onClick={() => setMode({ kind: "idle" })}>
          Volver
        </Button>
      </section>
    );
  }

  if (mode.kind === "choosing") {
    const isAccept = mode.decision === "accepted";
    return (
      <section
        aria-label={isAccept ? "Confirmar aceptación" : "Enviar feedback de rechazo"}
        className="rounded-2xl border border-border bg-card px-6 py-6 space-y-4"
      >
        <div>
          <h2 className="text-lg font-medium">
            {isAccept ? "Aceptar este prototipo" : "Pedir cambios al prototipo"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAccept
              ? "Vamos a notificarle al vendedor para que prepare la propuesta detallada. Podés agregar un comentario si querés."
              : "Contale al vendedor qué te gustaría ajustar. Cuanto más específico, mejor."}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="decision-notes" className="text-sm font-medium">
            {isAccept ? "Comentario (opcional)" : "Qué cambiarías"}
          </label>
          <Textarea
            id="decision-notes"
            value={mode.notes}
            onChange={(event) => updateNotes(event.target.value)}
            rows={4}
            placeholder={
              isAccept
                ? "Ej: Me encanta el diseño, podríamos empezar pronto."
                : "Ej: El header debería ser más grande, y faltan los testimonios."
            }
            maxLength={NOTES_MAX}
          />
          <p className="text-xs text-muted-foreground">
            {mode.notes.length}/{NOTES_MAX}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={submit} disabled={isPending}>
            {isPending
              ? "Enviando…"
              : isAccept
                ? "Confirmar aceptación"
                : "Enviar rechazo"}
          </Button>
          <Button
            variant="outline"
            onClick={cancelChoosing}
            disabled={isPending}
          >
            Cancelar
          </Button>
        </div>
      </section>
    );
  }

  // idle
  return (
    <section aria-label="Tu decisión" className="rounded-2xl border border-border bg-card px-6 py-6 space-y-4">
      <div>
        <h2 className="text-lg font-medium">¿Qué te parece el prototipo?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Si está alineado con lo que esperabas, aceptalo para que arranquemos. Si querés
          cambios, contanos qué ajustar.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => startChoosing("accepted")}>Aceptar prototipo</Button>
        <Button variant="outline" onClick={() => startChoosing("rejected")}>
          Pedir cambios
        </Button>
      </div>
    </section>
  );
}
