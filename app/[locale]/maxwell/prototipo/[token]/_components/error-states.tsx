/**
 * app/[locale]/maxwell/prototipo/[token]/_components/error-states.tsx
 *
 * Renders the deterministic UX copy for each non-`ok` bucket produced by
 * `mapRenderResultToUxState` (ADR-024 error taxonomy). The page-level
 * orchestrator passes the UX state; this component owns the copy and the
 * visual treatment per kind.
 *
 * Copy editorial — neutral Spanish (no voseo), owner-approved 2026-06-25.
 * Spec source: handoff-mel §3; this component keeps the strings in one
 * place for easy iteration.
 */

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

type Surface = {
  tone: "neutral" | "warning" | "info" | "danger";
  title: string;
  body: string;
};

function surfaceFor(state: Props["state"]): Surface {
  switch (state.kind) {
    case "terminal.invalid-link":
      return {
        tone: "warning",
        title: "Este link no es válido",
        body:
          "El link que abriste no corresponde a ningún prototipo activo. Pídele al vendedor un link nuevo o verifica que copiaste la URL completa.",
      };
    case "expired.regenerated":
      return {
        tone: "info",
        title: "Este prototipo fue actualizado",
        body:
          "Hay una versión más nueva de tu prototipo. Pídele al vendedor el link actualizado para verlo y decidir sobre la última versión.",
      };
    case "expired.lead-deleted":
      return {
        tone: "neutral",
        title: "Este prototipo ya no está disponible",
        body:
          "El proyecto asociado a este link fue removido. Si piensas que es un error, contacta al vendedor.",
      };
    case "transient.auth-failed":
      return {
        tone: "danger",
        title: "Servicio temporalmente no disponible",
        body:
          "No pudimos validar la conexión con el servidor en este momento. Prueba recargar la página en unos minutos.",
      };
    case "transient.rate-limited":
      return {
        tone: "warning",
        title: "Demasiados intentos",
        body:
          "Recibimos muchas solicitudes en poco tiempo. Espera un minuto e intenta de nuevo recargando la página.",
      };
    case "transient.internal-failed":
      return {
        tone: "danger",
        title: "Algo falló al cargar tu prototipo",
        body:
          "Hubo un error temporal del servidor. Prueba recargar la página en unos minutos. Si el problema persiste, avísale al vendedor.",
      };
    case "fatal.unknown":
      return {
        tone: "danger",
        title: "No pudimos cargar tu prototipo",
        body: `Ocurrió un error inesperado (código ${state.httpStatus}). Prueba recargar; si persiste, avísale al vendedor.`,
      };
  }
}

const toneClass: Record<Surface["tone"], string> = {
  neutral: "border-border bg-card text-foreground",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100",
  danger:
    "border-destructive/30 bg-destructive/10 text-destructive-foreground dark:text-destructive-foreground",
};

export function ErrorStates({ state }: Props) {
  const surface = surfaceFor(state);
  return (
    <section
      role="alert"
      aria-live="assertive"
      className={`rounded-2xl border px-6 py-6 ${toneClass[surface.tone]}`}
    >
      <h2 className="text-lg font-medium">{surface.title}</h2>
      <p className="mt-2 text-sm opacity-90">{surface.body}</p>
    </section>
  );
}
