# Architecture — v3 Membership billing **M1** (cobro recurrente real)

- **Iteración:** M1 del paraguas membership billing (`specs/2026-06-21-v3-membership-billing.md`, chunk M1).
- **Fecha:** 2026-06-22
- **Autor:** los devs (NoonWeb)
- **Status:** Ready (gated build)
- **Input de Analysis:** spec `specs/2026-06-21-v3-membership-billing.md`.
- **Contrato cross-repo:** co-firmado por el App en `docs/2026-06-22-app-to-noonweb-v3-membership-billing-cosign-response.md` (respuesta a `docs/2026-06-21-noonweb-to-app-v3-membership-billing-codesign.md`).
- **Decisión de owner (2026-06-22):** construir M1 ya (no diferir), **todo detrás de `MEMBERSHIP_BILLING_ENABLED=false`** hasta el gate de habilitación bilateral. El App construye su mitad (estado SoT + receptor `membership-lifecycle` + outbound del pull).

---

## 1. Objetivo de la iteración

Cerrar la brecha "se advierte una membresía que no se puede cobrar": un cliente que elige **Membresía** debe ser cobrado la **activación + la mensualidad recurrente** por Stripe (no manual), y el portal debe reflejar su estado de membresía. NoonWeb corre Stripe (checkout subscription + webhooks recurrentes) y **reenvía** el ciclo de vida normalizado al App; el App es **SoT del estado** y lo expone sanitizado en el pull de project-status que el portal ya consume.

**Invariante de frontera (no se toca):** el cliente vive en NoonWeb; el wallet/estado interno es del App; el cross-repo es server-to-server HMAC (`project_client_web_seller_app_boundary`).

---

## 2. Module boundaries (qué es responsable de qué)

| Módulo | Responsable de | NO responsable de |
|---|---|---|
| `app/api/maxwell/checkout/route.ts` | Crear el checkout: rama `membership` (`mode:"subscription"`, Opción A) vs `one_time` (`mode:"payment"`, actual). Capturar modalidad/monthly (ya, M0). Gatear la rama subscription por el flag. | Activar el workspace; el ciclo de vida recurrente. |
| `app/api/stripe/webhook/route.ts` | Recibir + verificar eventos Stripe. Rutear: `checkout.session.completed` (activación, incl. subscription-mode) + `invoice.paid` / `invoice.payment_failed` / `customer.subscription.updated` / `customer.subscription.deleted` (ciclo de vida). | Decidir earnings (eso vive en activación + es App-side). Persistir estado de membresía (App es SoT). |
| `lib/maxwell/payment-activation.ts` | `confirmProposalPayment` — activación del workspace + `payment-confirmed` (1× earnings, sobre la activación). Rama membership: persistir sub/customer ids, tolerar el total de la primera factura (activación+monthly). | El ciclo de vida recurrente (renovación/fallo/cancel). |
| `lib/noon-app-integration.ts` | El **wire saliente nuevo** `sendMembershipLifecycleToNoonApp` (builder + forward firmado, idempotente App-side). | Recibir el estado (eso llega por el pull). |
| `lib/maxwell/repositories.ts` + migración 030 | Persistir las **referencias Stripe de correlación** (`stripe_subscription_id`, `stripe_customer_id`) en `proposal_request` + la query `getProposalRequestByStripeSubscriptionId`. | Persistir el estado de membresía cliente-visible (App-owned). |
| `lib/maxwell/project-status-types.ts` + workspace page | Leer el campo **`membership` sanitizado** del pull (allowlist) + pintar el indicador §8.2. | Producir ese campo (App-side). |

**Regla de ownership del estado:** NoonWeb **NO duplica** el estado de membresía cliente-visible. Persiste sólo lo mínimo para **operar Stripe y correlacionar webhooks** (los 2 ids). El estado autoritativo lo lee del pull. (Espejo de Fase 2 Publish: App = SoT, NoonWeb opera la acción.)

---

## 3. Contratos

### C1 — Checkout: rama membership (Opción A)

- **Trigger:** `POST /api/maxwell/checkout` con `payment_modality:"membership"` **Y** `MEMBERSHIP_BILLING_ENABLED==="1"`.
- **Si el flag está OFF:** se ignora la rama subscription y se cae a M0 (se captura la modalidad, se cobra **sólo la activación** vía `mode:"payment"`) — comportamiento actual, byte-idéntico. **Sin error al cliente.**
- **Si ON:** crear UNA Checkout Session `mode:"subscription"`:
  - `line_items`: **dos** ítems vía `price_data` — (1) **activación** one-time (sin `recurring`, `unit_amount = toStripeMinorUnit(approvedAmountUsd,"usd")`) + (2) **mensualidad** recurrente (`recurring:{ interval:"month" }`, `unit_amount = toStripeMinorUnit(monthlyAmountUsd,"usd")`). En `mode:"subscription"` Stripe cobra los ítems one-time en la **primera factura** → primera factura = activación + mensualidad (Opción A). *(Nota impl.: el SDK pineado `2026-04-22.dahlia` NO expone `subscription_data.add_invoice_items`; la lista mixta de `line_items` es el equivalente soportado.)*
  - `subscription_data.metadata`: `{ source:"noon_website", external_session_id, external_proposal_id, public_token }` — correlación para los webhooks (resiliencia si el id no estuviera persistido todavía).
  - `client_reference_id = proposal.id`; `customer_email`; success/cancel URLs (idénticas a hoy).
  - `idempotencyKey: \`noon-checkout-sub:${proposal.id}:${activationMinor}:${monthlyMinor}:usd\``.
- **Pre-condiciones (reusa las actuales):** proposal payable, sesión `proposal_sent`, `approvedAmountUsd>0`, `approvedCurrency==="USD"`. Membership **además** exige `monthlyAmountUsd>0` (engine-derived) → si falta, 409 `MEMBERSHIP_MONTHLY_REQUIRED`.
- **Side effects:** `updateProposalRequestStatus(proposal.id,"payment_pending",{stripeCheckoutSessionId})` + `appendPaymentEvent` (`initiated`), como hoy.
- **Reuse path:** si ya hay un checkout `open`, se reusa (igual que hoy).

### C2 — Webhook: ruteo + handlers recurrentes

`POST /api/stripe/webhook` agrega, manteniendo la verificación de firma actual:

| Stripe event | Condición | Acción NoonWeb |
|---|---|---|
| `checkout.session.completed` | `mode==="payment"`, paid | **Activación one-time** (flujo actual, intacto). |
| `checkout.session.completed` | `mode==="subscription"`, paid | **Activación membership:** persistir `stripe_subscription_id`(=`session.subscription`) + `stripe_customer_id`(=`session.customer`); `confirmProposalPayment` (activa workspace + `payment-confirmed` con `payment_modality:"membership"`, earnings 1× sobre la activación); **forward `membership-lifecycle:activated`** (status `active`, `current_period_end` de la subscription). |
| `invoice.paid` | `billing_reason==="subscription_cycle"` | **forward `renewed`** (status `active`). Estado-only: cero earnings, cero activación. |
| `invoice.paid` | `billing_reason==="subscription_create"` | **IGNORAR** (ya cubierto por el `checkout.session.completed` subscription-mode → evita doble `activated`/`renewed`). |
| `invoice.payment_failed` | — | **forward `payment_failed`** (status `past_due`). |
| `customer.subscription.updated` | — | **forward `updated`** (status = map de `subscription.status`). Cubre `cancel_at_period_end` (sigue `active`, cancelación agendada). |
| `customer.subscription.deleted` | — | **forward `cancelled`** (status `ended`). |
| cualquier otro | — | `ignored` (como hoy). |

- **Correlación:** por `stripe_subscription_id` persistido → `getProposalRequestByStripeSubscriptionId`. Fallback: `subscription.metadata.external_proposal_id`. Si no resuelve → log + `ignored` (no romper el webhook; Stripe reintentará).
- **`current_period_end` + `status` Stripe:** se leen de la **subscription** (en eventos `invoice.*` se hace `stripe.subscriptions.retrieve` si el objeto no la trae). Map `subscription.status` → wire `status`: `active`→`active`; `past_due`/`unpaid`→`past_due`; `canceled`→`cancelled` (o `ended` si vino por `deleted`); `incomplete*`/`trialing`→`active` (MVP no usa trials → no debería ocurrir).
- **Idempotencia NoonWeb:** los handlers recurrentes son **stateless forward** (no escriben estado) → re-entrega de Stripe = re-forward; el App de-dupea (ver C3). La activación reusa la idempotencia existente (`provider_event_id` único en `payment_event`).
- **Gating:** los handlers recurrentes son inertes cuando el flag está OFF (no se crea ninguna subscription → no llegan eventos; igual se gatean defensivamente para no forwardear si el flag se apagó como kill-switch).

### C3 — Wire saliente `membership-lifecycle` (NUEVO, con enmiendas)

`sendMembershipLifecycleToNoonApp` en `lib/noon-app-integration.ts`, vía `postNoonAppWebhook` (firma HMAC `${ts}.${body}`, headers `x-noon-timestamp`/`x-noon-signature`, ±5min, retry 3×). **Reusa `NOON_WEBSITE_WEBHOOK_SECRET`** (sin env nuevo).

```jsonc
POST /api/integrations/website/membership-lifecycle
{
  "external_source": "noon_website",
  "external_session_id": "<studio_session.id>",
  "external_proposal_id": "<proposal_request.id>",
  "external_subscription_id": "<Stripe sub id, opaco para el App>",
  "external_event_id": "<Stripe evt_… id>",          // ENMIENDA 1 — idempotencia explícita
  "membership": {
    "event_kind": "activated|renewed|payment_failed|updated|cancelled",
    "status":     "active|past_due|cancelled|ended",
    "current_period_end": "<ISO8601 | null>",
    "monthly_amount_usd": <number>,                   // ENMIENDA 3 — DÓLARES USD ENTEROS
    "currency": "USD"
  },
  "created": <unix seconds del evento Stripe>,         // ENMIENDA 2 — orden latest-wins
  "metadata": { /* libre, opaco */ }
}
```

- **Enmienda 1 (`external_event_id`):** el `evt_…` de Stripe — globalmente único e idempotente por garantía de Stripe. Es el patrón universal de TODOS los otros wires (`external_payment_id`/`externalActionId`/`updateId`). El App de-dupea por `external_event_id` como clave primaria; la clave compuesta que el App propuso (`session,sub,event_kind,period_end`) queda como secundaria/compatibilidad.
- **Enmienda 2 (`created`):** unix del evento Stripe (`event.created`). Los webhooks de Stripe llegan **desordenados**; el App aplica **latest-wins** por `created` para no resucitar un estado viejo (p.ej. `cancelled` viejo pisando un `renewed` nuevo).
- **Enmienda 3 (unidad):** `monthly_amount_usd` se emite en **dólares USD enteros** (igual que `proposal.amount` en el wire existente, `parseUsdAmount`), tomado de `proposal.monthlyAmountUsd` (registro propio de NoonWeb), **no** de Stripe → evita el bug 100× (Stripe es minor units). El App lo trata como dólares.
- **Earnings:** **cero** en este wire (§24.2). Es estado-only.
- **Status del forward:** síncrono dentro del handler del webhook; `postNoonAppWebhook` reintenta 5xx/red (3×) y tira en 4xx determinista. Un fallo se loguea (audit `noon_app_membership_lifecycle_failed`); Stripe reintenta el webhook → re-forward (App de-dupea). **No** se bloquea la respuesta de activación al cliente por un fallo de forward recurrente.

> **Nota de freeze:** estas 3 enmiendas son **aditivas** y van a re-firma del App (`docs/2026-06-22-noonweb-to-app-v3-membership-billing-amendment.md`). Si el App sólo adopta la clave compuesta, los campos extra son inocuos **siempre que su receptor `membership-lifecycle` NO sea `.strict()`** — por eso el handoff pide explícitamente modelarlos (no-strict o declararlos).

### C4 — Indicador §8.2 en el portal (lee del pull)

- **Productor:** el App (campo `membership` sanitizado dentro del `data` del project-status pull). **Consumidor:** NoonWeb.
- **Schema:** extender `projectStatusDataSchema` (`lib/maxwell/project-status-types.ts`) con:
  ```ts
  membership: z.object({
    status: z.string(),                          // raw — NoonWeb mapea el label (§8.1)
    monthlyAmountUsd: z.number().nullable().optional(),
    currentPeriodEnd: z.string().nullable().optional(),
  }).nullable().optional(),
  ```
  Opcional/nullable → forward-compat: el productor pre-membership (que lo omite) sigue parseando; el allowlist sin `.strict()` ya strippea lo no modelado. **Sin `membership` en el pull → el indicador no se pinta** (no-op hasta que el App lo emita).
- **Render:** en `app/[locale]/maxwell/workspace/[sessionId]/page.tsx`, un indicador que mapea `membership.status` → label cliente-safe (vía un helper `mapMembershipStatusToMeta`, espejo de `mapProjectStatusToMeta`/`mapVersionStateToMeta`). Degrada un status desconocido a un label neutro. NoonWeb **dueño del label** (no se filtra el enum crudo).

### C5 — Data model / migración 030

`proposal_request` (additivo, reversible):

```sql
ALTER TABLE proposal_request ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE proposal_request ADD COLUMN IF NOT EXISTS stripe_customer_id    TEXT;
-- índice parcial único: un proposal ↔ a lo sumo una subscription
CREATE UNIQUE INDEX IF NOT EXISTS proposal_request_stripe_subscription_id_key
  ON proposal_request (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
```

- Self-registra en `schema_migrations` (mirroring 029). Reversible (`DROP COLUMN`/`DROP INDEX`).
- **Repo:** `ProposalRequest` gana `stripeSubscriptionId: string | null` + `stripeCustomerId: string | null`; el mapper de fila + `updateProposalRequest` los soportan; **nueva** `getProposalRequestByStripeSubscriptionId(subId)` para la correlación del webhook.

---

## 4. Regla económica (earnings)

- `creditActivationEarnings` (App-side) se dispara **1×, sobre la activación** — sin cambio vs hoy. NoonWeb manda `payment.amount = activación` en `payment-confirmed` (no activación+monthly), así el App acredita earnings sólo sobre la activación.
- El wire `membership-lifecycle` (`renewed`/`payment_failed`/…) **nunca** toca earnings ni wallet. **Estado-only.** (master-spec §24.2, extendido por owner 2026-06-22: las mensualidades son ingreso puro de Noon, sin split.)

---

## 5. Política dunning / cancelación / refund (Q-M-4/Q-M-5)

Defaults direccionales del App, **adoptados como punto de partida; a ratificar owner+legal antes de tocar T&C**:

- **Dunning:** apoyarse en los **smart retries de Stripe** → `past_due`. **Sin suspensión silenciosa.** Suspender el acceso al workspace **sólo al fallo final** (`customer.subscription.deleted`/`ended`).
- **Cancelación:** **fin-de-período** por default (acceso hasta terminar el período pagado).
- **Refund:** activación y mensualidad **no reembolsables** por default; excepciones = PM/Admin + legal.

**Alcance M1 de esta política:** el wire **transporta** el estado (`past_due`/`ended`/…) para que el App sea SoT y el portal lo refleje. La **suspensión dura de acceso** (ocultar contenido del workspace al `ended`) se modela como **deferred** (ver §7) — el indicador §8.2 muestra el estado, pero el gating de acceso completo es decisión de producto/UX posterior. Esto evita acoplar M1 a una política legal aún no ratificada.

---

## 6. Flag `MEMBERSHIP_BILLING_ENABLED`

- **Implementación = constante de código**, no env: `lib/maxwell/membership-billing.ts` → `export const MEMBERSHIP_BILLING_ENABLED: boolean = false;` (espejo exacto de `lib/maxwell/attachments.ts` `ATTACHMENTS_ENABLED`). Flipeada por PR de enablement, no por Vercel env → sin env nuevo que setear, y los tests la mockean (`{ ...actual, MEMBERSHIP_BILLING_ENABLED: true }`). Tipada `boolean` para que las condiciones no se evalúen como estáticamente conocidas.
- **Default `false`.** Semántica:
  - Checkout: rama subscription **desactivada** → membership cae a M0 (captura modalidad, cobra activación). El cliente no ve error.
  - Webhook: los eventos subscription/invoice se `ignored` (kill-switch; aunque sin subscriptions no hay eventos). El `checkout.session.completed` **one-time** sigue funcionando siempre.
  - Indicador §8.2: independiente del flag (sólo depende de que el pull traiga `membership`).
- **`true`:** rama subscription activa + forward del ciclo de vida activo.
- **Patrón:** kill-switch persistente, igual que `ATTACHMENTS_ENABLED` (B.5b). Orden de despliegue: build gated → App despliega su mitad → **flip** (PR) → smoke bilateral.

---

## 7. ADRs (decisiones no obvias)

- **ADR-M1-1 — Opción A (single `mode:"subscription"`, activación = line item one-time en la primera factura).** Co-firmado. Un solo customer+subscription = un solo stream de ciclo de vida; mejor UX (un flujo "activación + mensualidad"). El activation amount sigue siendo un campo distinto (`payment.amount`) → earnings 1× sin diseccionar line-items de Stripe. *Implementación:* como el SDK dahlia no tiene `subscription_data.add_invoice_items`, la activación va como un `line_item` one-time junto al recurrente (Stripe lo cobra en la 1ª factura) — equivalente. *Alternativa rechazada:* activación one-time separada + subscription aparte (dos flujos, dos correlaciones).
- **ADR-M1-2 — NoonWeb NO duplica el estado de membresía; sólo persiste 2 ids de correlación.** Espejo Fase 2. El estado autoritativo lo lee del pull. *Riesgo:* una divergencia momentánea Stripe↔App (forward in-flight); mitigado porque el App es SoT y el pull es la fuente que el portal pinta.
- **ADR-M1-3 — Idempotencia + orden por campos explícitos del evento Stripe (enmiendas 1/2).** `external_event_id` (= `evt_…`) como clave primaria de de-dup + `created` para latest-wins. Consistente con todos los otros wires; previene resurrección de estado por reorden de webhooks. *Costo:* una vuelta de re-firma del App (aditivo).
- **ADR-M1-4 — `monthly_amount_usd` en dólares enteros desde el registro de NoonWeb, no desde Stripe (enmienda 3).** Evita confusión minor/major units (bug 100×). NoonWeb ya tiene el monthly engine-derived persistido (M0).
- **ADR-M1-5 — La primera factura (`subscription_create`) se ignora en `invoice.paid`; la activación se maneja en `checkout.session.completed` subscription-mode.** Evita doble emisión `activated`+`renewed` para el mismo cobro inicial.
- **ADR-M1-6 — Suspensión dura de acceso = deferred.** M1 transporta y muestra el estado; ocultar el workspace al `ended` se decide con la política legal ratificada (no bloquea el cobro recurrente E2E).

---

## 8. Shortcuts

**Permitidos (con razón / riesgo / deuda):**
- **No persistir el estado de membresía local** (sólo ids). *Razón:* App es SoT (ADR-M1-2). *Riesgo:* sin pull, el portal no muestra estado (degrada al `workspace_status` local, como hoy). *Deuda:* ninguna — es el diseño.
- **Forward recurrente sin outbox local** (síncrono + retry de `postNoonAppWebhook`, App de-dupea). *Razón:* espejo de Fase 2 Publish; el App es SoT del estado + audit. *Riesgo:* un fallo tras 3 retries queda en audit + lo recupera el reintento de Stripe. *Deuda:* outbox persistente + alerting = iteración futura (igual que B9 dead-letter).
- **No assert estricto del `amount_total` de la primera factura** en la rama membership (= activación+monthly, con posible proración/impuestos). *Razón:* la integridad de la activación (lo que genera earnings) está garantizada por el `add_invoice_item` que NoonWeb construye = `approvedAmountUsd`, y el App acredita sobre `payment.amount` que NoonWeb fija. *Riesgo:* un cobro Stripe inflado no lo detecta el match de monto; mitigado porque NoonWeb construye los montos. *Deuda:* assert de `activation line == approved` si se quiere endurecer.
- **Suspensión de acceso deferred** (ADR-M1-6).

**Prohibidos:**
- Emitir ids de Stripe / montos de earnings / internals en el campo `membership` del pull (rompe §8.3). El App sólo expone `{status, monthly, current_period_end}`.
- Tomar `monthly_amount_usd` de Stripe minor units sin convertir (bug 100×).
- Activar la rama subscription sin el flag (rompería el orden de despliegue bilateral).
- Tocar el flujo `one_time` existente (debe quedar byte-idéntico).

---

## 9. Riesgos abiertos para implementación

- **R-impl-1:** el receptor `membership-lifecycle` del App aún no existe → el E2E recurrente espera la mitad del App. NoonWeb construye + unit-testea contra mocks (como B.5b). *Mitigación:* gated por flag; el handoff de enmiendas desbloquea al App.
- **R-impl-2:** `subscription.current_period_end` ubicación según evento → estandarizar en un helper que siempre haga `subscriptions.retrieve` cuando el objeto no la traiga.
- **R-impl-3:** Stripe `apiVersion` / tipos de `add_invoice_items` en `subscription_data` → validar contra la versión del SDK instalada en `tsc`.

---

## 10. Success criterion (M1)

Un cliente que elige **Membresía** (con el flag ON) es cobrado por Stripe la **activación + la mensualidad recurrente** por los montos exactos del SKU; el App recibe `payment-confirmed` (modality=membership) + `membership-lifecycle:activated`, y luego `renewed`/`payment_failed`/`cancelled` según el ciclo; el portal muestra el estado de membresía vía el pull. Verificable por **smoke bilateral** (§5 del cosign), con negativos (firma mala→401, evento reordenado→latest-wins, primera factura→sin doble emisión).

---

## Architecture outcome: **Ready** (gated build)

Contratos C1–C5 explícitos; boundaries y ownership resueltos; migración additive-first + reversible; flag + orden de despliegue definidos; política dunning adoptada como punto de partida con suspensión dura deferred (ADR-M1-6, no bloquea el core). Backend puede implementar. **Bloqueante externo:** re-firma del App de las 3 enmiendas (aditivas) — el build procede en paralelo porque es aditivo y localizado al builder del wire.
