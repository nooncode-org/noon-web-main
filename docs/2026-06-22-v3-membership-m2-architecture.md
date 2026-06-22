# Architecture — v3 Membership billing **M2** (Customer Portal / Fase 6b)

- **Iteración:** M2 del paraguas membership billing (`specs/2026-06-21-v3-membership-billing.md`, chunk M2).
- **Fecha:** 2026-06-22
- **Autor:** los devs (NoonWeb)
- **Status:** Ready (gated build)
- **Depende de:** M1 (`docs/2026-06-22-v3-membership-m1-architecture.md`) — el `stripe_customer_id` que M2 usa lo persiste M1 (migración 030). Mismo flag `MEMBERSHIP_BILLING_ENABLED`.

---

## 1. Objetivo

Que el cliente **auto-gestione** su membresía (cambiar método de pago, **cancelar**) sin pasar por el PM — vía el **Stripe Billing Portal** (`stripe.billingPortal`). AC-5 del modelo. NoonWeb solo abre la sesión del portal; Stripe hostea la UI.

---

## 2. Pieza clave: cero lógica de estado nueva

El portal de Stripe deja al cliente cancelar / actualizar la suscripción. Esas acciones disparan **`customer.subscription.updated` / `customer.subscription.deleted`**, que **el webhook de M1 YA maneja** → los reenvía como `membership-lifecycle` (`updated`/`cancelled`) al App, que es SoT, y el portal del cliente refleja el nuevo estado vía el pull. **M2 NO agrega ningún handler de webhook, ni migración, ni estado.** Solo abre la puerta; el ciclo de vida ya está construido.

---

## 3. Contrato — `openBillingPortal` (server action)

`app/[locale]/maxwell/workspace/[sessionId]/_actions/open-billing-portal.ts`. **Server action**, no API route (la spec sugería `/api/maxwell/billing-portal`, pero los botones del workspace usan server actions con `auth()`+ownership — más consistente y sin wiring de fetch/route-auth aparte; **ADR-M2-1**).

- **Input:** `{ sessionId: string }`.
- **Output:** `{ ok: true; url: string } | { ok: false; error: string; code }` con `code ∈ { UNAUTHENTICATED, NOT_FOUND, NOT_AVAILABLE, RATE_LIMITED, PORTAL_FAILED }`.
- **Pasos (espejo de `submit-version-action.ts`):**
  1. `auth()` → `viewerEmail`; sin sesión → `UNAUTHENTICATED`.
  2. **Gate del flag:** `MEMBERSHIP_BILLING_ENABLED` off → `NOT_AVAILABLE` (kill-switch: oculta + rechaza).
  3. **Rate-limit** por email (`namespace "maxwell.billing-portal"`, burst chico).
  4. `getStudioSession` + `viewerOwnsStudioSession` → si no es dueño → `NOT_FOUND`.
  5. `getLatestProposalRequest(sessionId)` → `stripeCustomerId`. Null → `NOT_AVAILABLE` (no hay suscripción/customer que gestionar).
  6. `return_url = buildWorkspaceUrl(session.id, { locale: session.language })`.
  7. `getStripeClient().billingPortal.sessions.create({ customer, return_url })` → `{ url }`.
  8. Éxito → `{ ok: true, url }`. El cliente redirige (`window.location.href = url`).
- **Errores:** `StripeConfigError` → `PORTAL_FAILED` (clean; loguea). Cualquier otro (incl. portal **no configurado** en el dashboard de Stripe — ver §5) → `PORTAL_FAILED`. Nunca filtra detalle de Stripe al cliente.
- **No persiste nada.** No revalida (el cliente sale del sitio al portal; al volver, la page re-renderiza con el pull).

---

## 4. UI — botón "Manage membership"

`_components/manage-membership-button.tsx` (client, `useTransition`, espejo de `version-publish-button.tsx`): llama la action; on `ok` → `window.location.href = url`; on error → mensaje inline.

En `page.tsx`, dentro de la card "Plan" (§8.2), se renderiza **gateado por `MEMBERSHIP_BILLING_ENABLED && planProposal?.stripeCustomerId`** (hay un customer Stripe real que gestionar). Sin customer (one-time / pre-M1 / no activado) → no aparece.

---

## 5. Dependencias / shortcuts

- **[Operador] Configurar el Customer Portal en el dashboard de Stripe** (Settings → Billing → Customer portal → activar la configuración default, con cancelación habilitada). Sin esto, `billingPortal.sessions.create` (sin `configuration`) **falla** → la action devuelve `PORTAL_FAILED` (degrada limpio, no rompe el workspace). Se usa la **default configuration** (no se pasa `configuration` id) — **ADR-M2-2** (cero estado de config en el repo; el dashboard es la fuente).
- **Gating:** mismo flag de M1; M2 entra LIVE con el mismo flip (no necesita flip propio).
- **Sin migración, sin env nuevo, sin wire nuevo.**

---

## 6. ADRs

- **ADR-M2-1 — Server action, no API route.** Consistencia con los botones del workspace (`auth()`+ownership+rate-limit ya resueltos). *Alternativa rechazada:* `/api/maxwell/billing-portal` (route con fetch + auth aparte) — más wiring sin beneficio.
- **ADR-M2-2 — Default portal configuration del dashboard, no `configuration` id en el repo.** El dashboard de Stripe es la fuente de la config del portal (features, cancelación, branding). El repo no la versiona. *Riesgo:* si el operador no la activa, falla → mitigado por el degrade limpio + nota de dependencia.
- **ADR-M2-3 — M2 no agrega lógica de ciclo de vida.** Las cancelaciones del portal fluyen por el webhook + wire de M1 (`updated`/`cancelled`). M2 es solo el punto de entrada.

---

## 7. Success criterion + outcome

Un cliente con membresía activa abre el Billing Portal desde su workspace, cancela (o actualiza el método de pago), y el cambio se refleja en su estado de membresía (vía el webhook M1 → wire → App → pull). **Outcome: Ready (gated build).** Verificable en el smoke bilateral de M1 (se suma "cliente cancela en el portal → `cancelled`/`ended` → portal refleja"). Dependencia de operador: activar el Customer Portal en Stripe.
