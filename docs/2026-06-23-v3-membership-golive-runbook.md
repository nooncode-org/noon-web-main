# v3 Membership Billing — Runbook de go-live (config Stripe + dry-run + smoke)

**Fecha:** 2026-06-23
**Estado del código:** M1 + M2 construidos, gateados por `MEMBERSHIP_BILLING_ENABLED` (constante en
`lib/maxwell/membership-billing.ts`, hoy `false` en `main`). Auditado línea-por-línea +
validado contra los docs de Stripe (los 6 supuestos externos confirmados). Tests endurecidos
(PR #100, mergeado). **Falta solo la config del operador en Stripe + el merge del flip (PR #98) +
el smoke.**

Este runbook lo ejecuta el operador con acceso a la cuenta de Stripe (Partes A, C, D) y, opcionalmente,
los devs para el dry-run local (Parte B). El orden es **duro**: la Parte A va **antes** del merge de #98.

---

## 0. Por qué el orden importa

Stripe solo **entrega** los eventos que están suscritos en el endpoint. Si se flipea el flag (merge #98)
**antes** de suscribir los eventos recurrentes:

- La **activación** sigue funcionando (viaja en `checkout.session.completed`, ya suscrito desde el launch).
- Pero la **primera renovación / cancelación** (un mes después, o cuando un cliente cancele) → Stripe
  no la entrega → el forward al App nunca ocurre → el estado de membresía se desincroniza en silencio.

Por eso: **config de Stripe (Parte A) → merge #98 (Parte C) → smoke (Parte D)**.

---

## 1. Pre-requisitos

- [ ] Migración 030 aplicada en prod (`stripe_subscription_id` + `stripe_customer_id` en `proposal_request`). **Ya hecho.**
- [ ] La mitad del App desplegada: receptor `POST /api/integrations/website/membership-lifecycle`
      + tabla `project_memberships` + `membership` sanitizado en el pull. **Ya hecho** (App PR #205 / ADR-046, mig 0098).
- [ ] PR #98 abierto y mergeable (el flip). **Abierto.**
- [ ] Acceso de operador al dashboard de Stripe (modo live + modo test).

---

## 2. Parte A — Config del dashboard de Stripe (operador) · BLOQUEANTE de #98

### A.1 — Suscribir el endpoint del webhook a los eventos recurrentes

En el dashboard de Stripe (modo **live**): **Developers → Webhooks → el endpoint de producción**
(la ruta `/api/stripe/webhook` que ya recibe `checkout.session.completed`).

Agregar estos **4 eventos** a la suscripción del endpoint (además del `checkout.session.completed`
que ya debe estar):

- [ ] `invoice.paid`
- [ ] `invoice.payment_failed`
- [ ] `customer.subscription.updated`
- [ ] `customer.subscription.deleted`

**Verificaciones:**

- [ ] El **signing secret** del endpoint **no cambió** (la env var `STRIPE_WEBHOOK_SECRET` en Vercel sigue válida).
      Agregar eventos a un endpoint existente **no** rota el secret; si por algún motivo se recrea el endpoint,
      hay que actualizar `STRIPE_WEBHOOK_SECRET` en Vercel.
- [ ] `checkout.session.completed` sigue suscrito (no quitarlo: de él depende la activación).

### A.2 — Activar el Customer portal (M2 / Fase 6b)

En el dashboard de Stripe (modo **live**): **Settings → Billing → Customer portal**.

- [ ] **Activar** la configuración default del portal (el código no pasa un `configuration` id; usa el default — ADR-M2-2).
- [ ] Habilitar **"Cancel subscriptions"** (de eso depende que el botón "Manage membership" permita cancelar →
      dispara `customer.subscription.deleted` → forward `cancelled`/`ended`).
- [ ] Si el portal no se activa, la server action `openBillingPortal` degrada limpio a `PORTAL_FAILED`
      (no rompe la página), pero el botón no sirve.

---

## 3. Parte B — Dry-run en test-mode (opcional, recomendado antes del go-live)

Valida el flujo completo contra eventos **reales** de Stripe sin tocar producción. Lo corren los devs.

### B.0 — Limitación importante de `stripe trigger`

`stripe trigger <evento>` genera eventos **sintéticos** que **no** llevan la metadata de correlación de Noon
(`external_proposal_id`) ni un `stripe_subscription_id` persistido → el handler los resuelve como
**"no proposal mapped" → ignored**. Sirven para probar el ruteo/firma, **no** el forward.

Para ejercitar el forward de verdad hay que usar una **suscripción real creada por el checkout de NoonWeb**
(así lleva la metadata + persiste el sub id) y avanzar su ciclo con un **Test Clock**.

### B.1 — Setup local

1. Claves **test** de Stripe (`sk_test_…`) en `.env.local`.
2. Stripe CLI logueado: `stripe login`.
3. Forward del webhook:
   ```
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Copiar el `whsec_…` que imprime → setearlo como `STRIPE_WEBHOOK_SECRET` en `.env.local`.
4. **Flag ON local** (NO commitear): en `lib/maxwell/membership-billing.ts` poner
   `MEMBERSHIP_BILLING_ENABLED = true`.
5. Forward saliente al App: `NOON_WEBSITE_WEBHOOK_SECRET` apuntando al receptor **test/staging** del App
   (mismo secret de ambos lados). Sin un receptor alcanzable, el forward falla y solo se valida el lado NoonWeb
   hasta el intento de POST.
6. Levantar el dev server.

### B.2 — Flujo + aserciones (los 6 must-verify)

| # | Acción | Qué afirmar |
|---|--------|-------------|
| 1 | Crear un checkout de membership (propuesta con `payment_modality:"membership"`) y pagar con `4242 4242 4242 4242` | La **1ª factura** en el dashboard test = **activación + mensual** (Opción A: el line item one-time se cobra una vez en la factura inicial). Forward `activated`/`active`. |
| 2 | Tras pagar | El `proposal_request` persiste `stripe_subscription_id` **y** `stripe_customer_id` (de eso depende M2). |
| 3 | Avanzar el ciclo con un **Test Clock** (siguiente período) | `invoice.paid` con `billing_reason:"subscription_cycle"` → forward `renewed`/`active`. La 1ª factura (`subscription_create`) **no** dispara renewed (dedup). |
| 4 | En cualquier forward | `current_period_end` viene poblado (leído del shape per-item de basil+). |
| 5 | Cobro con tarjeta que falla (`4000 0000 0000 0341`) + avanzar el clock | `invoice.payment_failed` → forward `payment_failed`/`past_due`. |
| 6 | Cancelar la suscripción (en el Customer portal test, o `stripe subscriptions cancel sub_…`) | `customer.subscription.deleted` → forward `cancelled`/`ended`. |

**Negativos a verificar:**

- [ ] Firma inválida → el endpoint responde 400 (`constructEvent` tira).
- [ ] Evento recurrente con el flag OFF → `ignored` (probar antes de poner el flag ON).
- [ ] Re-entrega del mismo evento (mismo `evt_…`) → el App de-dupea por `external_event_id` (idempotente; sin doble estado).

### B.3 — Limpieza

- [ ] Volver `MEMBERSHIP_BILLING_ENABLED = false` en local (NO commitear el flip).
- [ ] Borrar el `whsec_…` de test de `.env.local` si se comparte la máquina.
- [ ] Borrar la suscripción/cliente de prueba en el dashboard test (housekeeping).

---

## 4. Parte C — Go-live (merge #98 + deploy)

**Solo después** de completar la Parte A.

1. [ ] Mergear **PR #98** (`MEMBERSHIP_BILLING_ENABLED=false→true`).
2. [ ] Vercel despliega `main` automáticamente. Verificar que el deploy de prod termine **success**
       (la migración 030 ya está aplicada → el drift-check pasa).
3. [ ] Avisar al App que membership está LIVE → coordinar el smoke (Parte D).

El flag queda como **kill-switch**: ante cualquier problema, volver a `false` + deploy → el checkout cae a M0
(solo activación) y los eventos recurrentes vuelven a `ignored`, al instante.

---

## 5. Parte D — Smoke bilateral en prod

Replica B.2 pero en producción, con el App confirmando recepción del lado de su receptor.

**Happy path:**

- [ ] Activación: checkout de membership → workspace activado + `activated` recibido por el App.
- [ ] Renovación: ciclo (o Test Clock en una sub de prueba prod) → `renewed`/`active` en el App.
- [ ] M2: cancelar en el Customer portal → `cancelled`/`ended` en el App.

**Negativos:**

- [ ] Firma mala → 400.
- [ ] Evento reordenado (un `created` menor que el último aplicado) → el App aplica **latest-wins** (no resucita estado viejo).
- [ ] Replay (mismo `evt_…`) → **idempotente** en el App.
- [ ] 1ª factura (`subscription_create`) → **ignored** (no doble activated/renewed).
- [ ] Fallo de renovación → `payment_failed`/`past_due`.

---

## 6. Rollback / kill-switch

`MEMBERSHIP_BILLING_ENABLED=false` (revertir #98) + deploy →

- El checkout de membership cae a M0 (`mode:"payment"`, solo activación) — sin error de cliente.
- Los eventos `invoice.*` / `customer.subscription.*` → `ignored`.
- El botón "Manage membership" (M2) se oculta.

Las suscripciones ya creadas en Stripe **siguen vivas** (el flag no las cancela); el rollback solo deja de
abrir nuevas y de forwardear. Para detener cobros existentes hay que cancelarlas en Stripe.

---

## 7. Apéndice — Mapa evento Stripe → estado del wire

| Evento Stripe | `event_kind` | `status` |
|---|---|---|
| `checkout.session.completed` (mode `subscription`) | `activated` | `active` |
| `invoice.paid` (`subscription_cycle`) | `renewed` | `active` |
| `invoice.paid` (`subscription_create`) | — (ignored: lo cubre el checkout) | — |
| `invoice.payment_failed` | `payment_failed` | `past_due` |
| `customer.subscription.updated` | `updated` | mapeado de `subscription.status` |
| `customer.subscription.deleted` | `cancelled` | `ended` |

El wire es **state-only** (cero earnings; las earnings se acreditan 1× en la activación vía `payment-confirmed`).
El App es SoT del estado; de-dupea por `external_event_id` (`evt_…`) y aplica latest-wins por `created`.
`monthly_amount_usd` viaja en **dólares enteros** (no minor units).
