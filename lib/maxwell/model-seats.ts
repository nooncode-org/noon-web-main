/**
 * lib/maxwell/model-seats.ts
 *
 * Fase A (Quality Layer v2) — "cada modelo en el asiento de su especialidad"
 * (constitución del owner, tarea #37; spec: docs/maxwell/fase-a-spec.md,
 * § Modelos por asiento).
 *
 * Two seats, one doctrine — cost is cut at the hands, never at the brain:
 *
 *   ORCHESTRATOR — decides and orders. Judges reference captures into the
 *     dossier ("por qué funciona" included) and writes the creative order
 *     (shot list + real copy + data) that executors follow verbatim. The
 *     best available model sits here.
 *
 *   EXECUTOR — carries out complete orders. 1-of-24 classification, batch
 *     image verification against an explicit checklist. Needs vision and
 *     obedience, not brilliance — a much cheaper model.
 *
 * Defaults are the GPT-5.6 family (2026-07-09): Sol (frontier, $5/$30 —
 * same price as gpt-5.5) orchestrates; Luna ($0.20/$1.20, vision)
 * executes. Both are env-overridable so swapping a model is one variable
 * and zero code — the spec's rollback/upgrade path:
 *
 *   MAXWELL_MODEL_ORCHESTRATOR  (default "gpt-5.6-sol")
 *   MAXWELL_MODEL_EXECUTOR      (default "gpt-5.6-luna")
 *
 * Both resolvers re-read process.env on every call (same contract as
 * `resolveDefaultOpenAIModel`) so an env flip in Vercel takes effect on
 * reload and `vi.stubEnv` works without module-cache tricks.
 */

const DEFAULT_ORCHESTRATOR = "gpt-5.6-sol";
const DEFAULT_EXECUTOR = "gpt-5.6-luna";

function resolveSeat(envVar: string, fallback: string): string {
  const fromEnv = process.env[envVar]?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : fallback;
}

/** The seat that decides and orders: reference analysis, creative order. */
export function resolveOrchestratorModel(): string {
  return resolveSeat("MAXWELL_MODEL_ORCHESTRATOR", DEFAULT_ORCHESTRATOR);
}

/** The seat that executes complete orders: classification, batch verify. */
export function resolveExecutorModel(): string {
  return resolveSeat("MAXWELL_MODEL_EXECUTOR", DEFAULT_EXECUTOR);
}
