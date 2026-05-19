/**
 * lib/maxwell/polling-progress.ts
 *
 * B28 — Helpers puros para el indicador de progreso del polling v0.
 *
 * El cliente de Studio (`components/maxwell/studio-shell.tsx`) hace
 * polling cada 5s al endpoint `/api/maxwell/prototype/poll` mientras v0
 * genera el prototipo. Antes de B28, el usuario veía una pantalla con
 * skeleton + barra de progreso estática + texto fijo "20-40 seconds",
 * sin contador real de tiempo transcurrido. Para generaciones que se
 * estiraban (60-90s+) el usuario no sabía si seguía progresando o se
 * había colgado.
 *
 * Estos helpers son puros (no tocan DOM, no usan timers) para que el
 * componente que los consume sea trivial de testear: la lógica de copy
 * + format vive acá y los tests cubren los 4 buckets de tiempo.
 */

/**
 * Formatea segundos a un string compacto visible al usuario.
 *
 * Ejemplos:
 *   formatElapsed(0)    → "0s"
 *   formatElapsed(45)   → "45s"
 *   formatElapsed(60)   → "1m"
 *   formatElapsed(75)   → "1m 15s"
 *   formatElapsed(125)  → "2m 5s"
 *
 * Diseño:
 * - Bajo 60s mostramos solo segundos (la unidad que el usuario espera
 *   ver moverse mientras observa).
 * - Igual o sobre 60s pasamos a `Xm` o `Xm Ys` para evitar números
 *   grandes ("125s" se lee peor que "2m 5s" para tiempo percibido).
 * - Negative inputs y NaN se normalizan a 0s para no mostrar basura si
 *   `Date.now()` regresa hacia atrás por NTP drift.
 */
export function formatElapsed(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0s";
  }
  const total = Math.floor(seconds);
  if (total < 60) {
    return `${total}s`;
  }
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  if (remainder === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainder}s`;
}

/** Bucket categorizando el progreso para elegir copy + tono visual. */
export type PollingPhase = "setup" | "generating" | "almost" | "extended";

/**
 * Clasifica el tiempo transcurrido en una de 4 fases para que la UI
 * pueda mostrar mensajes apropiados al estado real.
 *
 * Bordes elegidos en base al rango histórico observado:
 *   - 20-40s: rango típico de v0 (per copy pre-B28)
 *   - >45s: "casi listo" sigue siendo razonable
 *   - >90s: anomalía — usuario debería saber que puede esperar o reintentar
 *
 * Los bordes son inclusivos en el límite superior del bucket previo, así:
 *   classifyPollingPhase(14)  → "setup"
 *   classifyPollingPhase(15)  → "generating"
 *   classifyPollingPhase(44)  → "generating"
 *   classifyPollingPhase(45)  → "almost"
 *   classifyPollingPhase(89)  → "almost"
 *   classifyPollingPhase(90)  → "extended"
 */
export function classifyPollingPhase(seconds: number): PollingPhase {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  if (total < 15) return "setup";
  if (total < 45) return "generating";
  if (total < 90) return "almost";
  return "extended";
}

/**
 * Copy visible al usuario, una línea por fase. Mantener corto: aparece
 * dentro de un placeholder con espacio limitado y compite con otros
 * elementos visuales (skeleton, spinner, contador).
 */
export function pollingStatusText(phase: PollingPhase): string {
  switch (phase) {
    case "setup":
      return "Maxwell is setting up the generation…";
    case "generating":
      return "Generating your preview…";
    case "almost":
      return "Almost there — finalizing details…";
    case "extended":
      return "This is taking longer than usual. You can wait or try again.";
  }
}

/**
 * Conveniencia para callers que solo quieren la línea final:
 *   pollingStatusForElapsed(28) → "Generating your preview…"
 *
 * Equivalente a `pollingStatusText(classifyPollingPhase(seconds))`,
 * extraído para evitar repetición en los componentes.
 */
export function pollingStatusForElapsed(seconds: number): string {
  return pollingStatusText(classifyPollingPhase(seconds));
}
