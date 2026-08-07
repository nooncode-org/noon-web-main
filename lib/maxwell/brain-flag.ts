/**
 * lib/maxwell/brain-flag.ts
 *
 * Fase A · Entrega 2 — LA LLAVE. The generation brain (study → ficha →
 * order → customs → milimetric prompt → the confirmation card) only runs
 * when this flag is on. Off (the default, and production's state until
 * the owner tastes the antes/después and approves): every flow behaves
 * byte-identically to the pre-brain product — the owner's rule "nada no
 * probado se enciende para un cliente".
 *
 * Flip = set MAXWELL_BRAIN_ENABLED=1 (or "true") and reload. One
 * variable, zero code — same contract as the model seats.
 */

export function isBrainEnabled(): boolean {
  const raw = process.env.MAXWELL_BRAIN_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true";
}
