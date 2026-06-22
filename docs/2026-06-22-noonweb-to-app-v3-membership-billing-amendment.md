# Handoff — NoonWeb → App: **ack + 3 enmiendas** del wire `membership-lifecycle` (M1)

**Fecha:** 2026-06-22
**Para:** equipo **App-nooncode**.
**De:** NoonWeb (`noon-web-main`).
**En respuesta a:** `docs/2026-06-22-app-to-noonweb-v3-membership-billing-cosign-response.md` (su co-firma de C-M0 + Q-M-1..6 + el shape propuesto de §Q-M-2).
**Arquitectura NoonWeb:** `docs/2026-06-22-v3-membership-m1-architecture.md`.

---

## 0. TL;DR

- **Co-firma aceptada.** C-M0, Q-M-1, Q-M-3 (Opción A), Q-M-6 y la regla económica (mensualidades sin earnings) quedan **confirmadas**. NoonWeb **ya construyó su mitad de M1** (Stripe subscription + webhooks recurrentes + el wire + el indicador §8.2), **gateada por `MEMBERSHIP_BILLING_ENABLED=false`** (constante de código, espejo de `ATTACHMENTS_ENABLED`; no es env). 4 gates verdes.
- **El shape de §Q-M-2 lo congelamos con 3 enmiendas ADITIVAS** (no rompen la idempotencia que ustedes propusieron). Necesitamos su **re-firma** de estas 3 para cerrar el freeze:
  1. **`external_event_id`** (= el `evt_…` de Stripe) como clave **primaria** de idempotencia — el patrón universal de todos los otros wires.
  2. **`created`** (unix del evento Stripe) para orden **latest-wins** — los webhooks de Stripe llegan desordenados.
  3. **`monthly_amount_usd` en dólares USD enteros** (no centavos) — evita un bug 100×.
- **Pedido clave:** su receptor `membership-lifecycle` **NO debe ser `.strict()`** (o debe modelar estos 3 campos), para que los campos extra que emitimos no le den 400.
- **Orden de despliegue (duro, como B.5b):** NoonWeb mergea gated → el App despliega su mitad → **NoonWeb flipea el flag** (PR) → smoke bilateral.

---

## 1. Confirmaciones (sin cambio)

- **C-M0** ✅ — su captura aditiva (`payment_modality`/`monthly_amount_usd` → `payments.metadata`) es justo lo que esperábamos. El M0 de NoonWeb sigue cobrando solo la activación; nada cambia ahí.
- **Q-M-1** ✅ — **App = SoT del estado**; NoonWeb corre Stripe + reenvía eventos normalizados; **NoonWeb NO duplica el estado** (sólo persiste 2 ids de correlación Stripe: `stripe_subscription_id` + `stripe_customer_id`, migración 030, additive/reversible).
- **Q-M-3 = Opción A** ✅ — un solo checkout `mode:"subscription"`. **Precisión de implementación (no afecta el contrato):** el SDK Stripe pineado (`2026-04-22.dahlia`) **no** expone `subscription_data.add_invoice_items`; usamos el equivalente soportado — la activación va como un **`line_item` one-time** junto al recurrente, que Stripe cobra en la **primera factura**. Resultado idéntico: 1ª factura = activación + mensualidad. El App no ve esto; sólo ve `payment.amount = activación` en `payment-confirmed` (earnings 1×) + el wire de ciclo de vida.
- **Q-M-6** ✅ — **sin env nuevo cross-repo.** El wire reusa `NOON_WEBSITE_WEBHOOK_SECRET`. (El flag de NoonWeb es una constante de código, no un env compartido.)
- **Regla económica (master-spec §24.2 extendida)** ✅ — `creditActivationEarnings` 1× sobre la activación; el wire `membership-lifecycle` es **state-only, cero earnings**. NoonWeb manda `payment.amount = activación` (no activación+mensualidad), así el App acredita earnings sólo sobre la activación, exactamente como hoy.

---

## 2. El shape congelado de `membership-lifecycle` (con las 3 enmiendas)

NoonWeb emite, vía `POST /api/integrations/website/membership-lifecycle`, firmado HMAC `${timestamp}.${body}` (headers `x-noon-timestamp`/`x-noon-signature`, ±5 min, F-1):

```jsonc
{
  "external_source": "noon_website",
  "external_session_id": "<studio_session.id>",
  "external_proposal_id": "<proposal_request.id>",
  "external_subscription_id": "<Stripe sub id; opaco para el App>",
  "external_event_id": "<Stripe evt_… id>",          // ENMIENDA 1
  "membership": {
    "event_kind": "activated|renewed|payment_failed|updated|cancelled",
    "status":     "active|past_due|cancelled|ended",
    "current_period_end": "<ISO8601 | null>",
    "monthly_amount_usd": <number>,                   // ENMIENDA 3 — dólares USD enteros
    "currency": "USD"
  },
  "created": <unix seconds del evento Stripe>,         // ENMIENDA 2
  "metadata": { "stripe_event_type": "<string>" }
}
```

### Enmienda 1 — `external_event_id` (idempotencia explícita)
El `evt_…` de Stripe es **globalmente único e idempotente por garantía de Stripe**. Pedimos que el App de-dupee por **`external_event_id` como clave primaria**. La clave compuesta que ustedes propusieron (`external_session_id, external_subscription_id, event_kind, current_period_end`) queda como **secundaria/compatibilidad** — sigue siendo válida, pero `external_event_id` la hace más robusta (p.ej. dos `updated` en el mismo período con `current_period_end` sin avanzar no colapsan).

### Enmienda 2 — `created` (orden latest-wins)
Los webhooks de Stripe **llegan desordenados**. Pedimos que el App aplique **latest-wins por `created`** para no resucitar un estado viejo (p.ej. un `cancelled` viejo pisando un `renewed` nuevo).

### Enmienda 3 — `monthly_amount_usd` en dólares enteros
Lo emitimos en **dólares USD enteros** (igual que `proposal.amount` del wire existente), tomado del registro propio de NoonWeb (`proposal.monthlyAmountUsd`, engine-derived), **no** de Stripe (que está en minor units). El App lo lee directo, sin conversión 100×.

> **Todas son ADITIVAS.** Si el App sólo adopta la clave compuesta, los campos extra son inocuos — **siempre que su receptor no sea `.strict()`**. Por eso pedimos explícitamente que el receptor `membership-lifecycle` **tolere campos no declarados** (no-strict) o **modele los 3**.

---

## 3. Mapeo Stripe → (`event_kind`, `status`) que NoonWeb emite

| Disparador Stripe | `event_kind` | `status` |
|---|---|---|
| `checkout.session.completed` (mode=subscription, paid) | `activated` | `active` |
| `invoice.paid` (`billing_reason=subscription_cycle`) | `renewed` | `active` |
| `invoice.paid` (`billing_reason=subscription_create`) | — **NoonWeb lo ignora** (ya cubierto por `activated`) | — |
| `invoice.payment_failed` | `payment_failed` | `past_due` |
| `customer.subscription.updated` | `updated` | map de `subscription.status` (active→active, past_due/unpaid→past_due, canceled→cancelled) |
| `customer.subscription.deleted` | `cancelled` | `ended` |

- `current_period_end`: leído de la subscription (`items.data[].current_period_end` en dahlia), ISO8601 o null.
- **Política dunning/cancel/refund (Q-M-4/5):** NoonWeb adopta sus **defaults direccionales** como punto de partida (Stripe smart retries → `past_due`; suspender sólo al fallo final/`ended`; cancelar fin-de-período; no-reembolsable por default). **La suspensión DURA de acceso al workspace queda diferida** (ADR-M1-6): M1 **transporta y muestra** el estado; ocultar contenido al `ended` se decide cuando owner+legal ratifiquen + se actualicen T&C. El wire ya lleva el estado para que ustedes sean SoT.

---

## 4. Indicador §8.2 (lo que NoonWeb necesita del pull)

El portal pinta el estado de membresía leyéndolo del **project-status pull existente** (no un wire nuevo). NoonWeb ya agregó al schema del pull un campo **`membership` opcional/nullable, sanitizado**:

```jsonc
"membership": {
  "status": "active|past_due|cancelled|ended",   // raw — NoonWeb mapea el label
  "monthlyAmountUsd": <number|null>,             // opcional
  "currentPeriodEnd": "<ISO8601|null>"           // opcional
}
```

- **Pedido al App:** exponer este `membership` sanitizado en el `data` del project-status signed-read (camelCase, como el resto del pull). **Nunca** ids de Stripe / montos de earnings / internals (§8.3 — nuestro allowlist los strippea de todos modos).
- Hasta que el App lo emita, el indicador es **no-op** (el portal cae al copy interino de M0). Sin acople de despliegue.

---

## 5. Orden de despliegue + qué preparar para el smoke

1. **App re-firma las 3 enmiendas** (§2) + confirma receptor no-strict + el campo `membership` del pull (§4). → **freeze cerrado.**
2. App construye/despliega su mitad: receptor `membership-lifecycle` (HMAC, idempotente por `external_event_id`, latest-wins por `created`, state-only) + el `membership` sanitizado en el pull.
3. **NoonWeb flipea `MEMBERSHIP_BILLING_ENABLED=true`** (PR de enablement) cuando el App confirme su mitad desplegada.
4. **Smoke bilateral:** cliente elige Membresía → activación cobrada (earnings 1×) + subscription creada → App recibe `payment-confirmed` (modality=membership) + `membership-lifecycle:activated` → estado=active → el portal lo muestra vía pull. Luego renovación/fallo/cancelación → transiciones → el portal refleja. Negativos: firma mala→401, evento reordenado→latest-wins, primera factura→sin doble emisión.

> El App puede construir + unit-testear su mitad contra este contrato **ya** (mock del wire); el E2E recurrente espera el flip de NoonWeb.

---

## 6. Asks concretos para el App (para cerrar el freeze)

- **A-1:** ¿re-firman las **3 enmiendas** (`external_event_id`, `created`, `monthly_amount_usd` en dólares)?
- **A-2:** ¿el receptor `membership-lifecycle` es **no-strict** (o modela los 3 campos) para no dar 400 a los campos extra?
- **A-3:** ¿confirman el de-dup por **`external_event_id`** (primario) + **latest-wins por `created`**?
- **A-4:** ¿confirman el campo **`membership` sanitizado** en el project-status pull (§4)?
- **A-5:** ¿OK con la política dunning/cancel como punto de partida (§3) y la **suspensión dura diferida** (ADR-M1-6) a ratificación owner+legal?

---

## 7. Referencias

- Co-firma App: `docs/2026-06-22-app-to-noonweb-v3-membership-billing-cosign-response.md`.
- Co-diseño NoonWeb: `docs/2026-06-21-noonweb-to-app-v3-membership-billing-codesign.md`.
- Arquitectura M1 (contratos C1–C5, ADRs, shortcuts): `docs/2026-06-22-v3-membership-m1-architecture.md`.
- Spec (M0–M3): `specs/2026-06-21-v3-membership-billing.md`.
- Wire/HMAC base: `lib/noon-app-integration.ts` (`sendMembershipLifecycleToNoonApp`, `postNoonAppWebhook`).
