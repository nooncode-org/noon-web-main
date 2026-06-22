# Handoff — App → NoonWeb: respuesta de co-firma de **membership billing** (C-M0 + Q-M-1..6)

**Fecha:** 2026-06-22
**Para:** equipo **NoonWeb** (`noon-web-main`).
**De:** App-nooncode.
**En respuesta a:** `noon-web-main/docs/2026-06-21-noonweb-to-app-v3-membership-billing-codesign.md` (su handoff de co-diseño) + `noon-web-main/specs/2026-06-21-v3-membership-billing.md` (chunks M0–M3).
**Objetivo:** **confirmar C-M0** y **co-firmar Q-M-1..6** para congelar la frontera cross-repo del cobro recurrente de membresía. El App construye su mitad de M1 (estado de membresía + receptor de ciclo de vida + outbound sanitizado) contra este contrato; NoonWeb construye Stripe (subscription + webhooks recurrentes) + el indicador §8.2 del portal.

> Verificado contra el código real del App (Explore 2026-06-22): el receptor `payment-confirmed` (`app/api/integrations/website/payment-confirmed/route.ts` + `websitePaymentConfirmedPayloadSchema` en `lib/server/website-integration.ts:98-116`) **no usa `.strict()`** → tolera campos extra, pero Zod **descarta** las claves no declaradas (hoy `proposal` solo expone `title/body/amount/currency`). El crédito de earnings vive en `creditActivationEarnings` (activación: developer 50% + noon 50% en inbound, seller=null). No existe hoy ningún concepto de modalidad/recurrencia/membresía en el App.

---

## 0. TL;DR

- **C-M0 = SÍ tolera, NO persiste.** El receptor no rompe con los 2 campos aditivos, pero los **descarta** (no hay `.strict()`, y Zod tira las claves desconocidas). Para que la facturación manual interina tenga el dato, **el App agrega ahora una captura aditiva chica** (extiende el schema + persiste `payment_modality`/`monthly_amount_usd`). Sin eso, M0 App-side es no-op.
- **Q-M-1..6: CO-FIRMADAS como las propusieron**, con precisiones App-side. El reparto (App = SoT del estado; NoonWeb corre Stripe + reenvía eventos normalizados; el portal lee el estado del pull) **encaja exactamente** con el invariante de frontera (cliente vive en NoonWeb; wallet/estado interno = App) y con el patrón Fase 2 Publish (App SoT / NoonWeb opera la acción).
- **Decisión de owner registrada:** **M1 se construye ya** (no se difiere). El App construye su mitad ahora contra este contrato; NoonWeb dimensiona Stripe. ⚠️ Nota de riesgo: R1 = 0 workspaces pagos orgánicos hoy (NoonWeb recomendaba diferir). El owner decide construir; queda anotado.
- **Modelo Stripe (Q-M-3) = Opción A** (un checkout `mode:"subscription"` con la activación como `add_invoice_items`).
- **Nuevo cierre económico (master-spec §24.2):** las **mensualidades NO generan earnings** (ni seller, ni developer, ni noon). El crédito de earnings se dispara **una sola vez sobre la activación**; las facturas recurrentes son **estado-de-membresía puro**, cero earnings.
- **Dunning/refund (Q-M-4/5):** **diferidas a la implementación de M1** con defaults direccionales App-side (§6 abajo); requieren legal.
- **El App no agrega env nuevo:** todo el wire reusa `NOON_WEBSITE_WEBHOOK_SECRET`.

---

## 1. C-M0 — confirmación (tolera + el App agrega captura)

**Confirmado:** los 2 campos aditivos (`payment_modality`, `monthly_amount_usd`) **no rompen** el receptor `payment-confirmed`. Pero el schema Zod del App **no los expone** — las claves no declaradas se descartan silenciosamente (ni siquiera quedan en `website_inbound_links.payment_payload`, que guarda el payload *ya validado*).

**Acción App (M0, aditiva, sin migración):** el App extiende `proposalSnapshotSchema` (o captura a nivel `proposal`) con:

```jsonc
"payment_modality": "one_time" | "membership" | null,
"monthly_amount_usd": <number | null>
```

y los **persiste** en `payments.metadata` (JSON) — opcional surfacing en `/dashboard/pm-queue` para que el PM vea qué plan eligió el cliente al facturar la mensualidad manual. Aditivo, bajo riesgo, no toca el flujo one-time.

> **El monto cobrado en M0 NO cambia:** Stripe sigue cobrando solo la activación (`mode:"payment"`); la mensualidad es manual (PM) hasta M1. El App solo **registra** la modalidad elegida.

---

## 2. Co-firma de Q-M-1..6

### Q-M-1 — SoT del estado de membresía → ✅ **App es SoT**
Co-firmado **como lo propusieron**. El estado de membresía (activo / past_due / cancelado / fin-de-período + período actual) es **interno del App** (espejo de Fase 2 Publish: App = SoT, NoonWeb opera la acción Stripe). NoonWeb **no duplica** el estado — solo opera Stripe y reenvía eventos. Respeta el invariante de frontera (`project_client_web_seller_app_boundary`): el cliente nunca entra al App; el cross-repo es server-to-server HMAC.

### Q-M-2 — Transporte del estado → ✅ **doble vía** (inbound nuevo + outbound existente)
- **Inbound (NoonWeb → App): wire NUEVO normalizado.** NoonWeb **no** manda eventos Stripe crudos; los normaliza a un evento App-facing (el App se mantiene Stripe-agnóstico). Molde `payment-confirmed`/§9: HMAC `${timestamp}.${body}`, headers `x-noon-timestamp`+`x-noon-signature`, ±5 min, idempotente con ledger (patrón `outbound_webhook_events`/`version_actions`). **Shape propuesto por el App (a congelar con su ack):**

```jsonc
POST /api/integrations/website/membership-lifecycle
{
  "external_source": "noon_website",
  "external_session_id": "<studio_session.id>",
  "external_proposal_id": "<...>",
  "external_subscription_id": "<opaco; ref Stripe, el App no lo interpreta>",
  "membership": {
    "event_kind": "activated" | "renewed" | "payment_failed" | "updated" | "cancelled",
    "status":     "active" | "past_due" | "cancelled" | "ended",
    "current_period_end": "<ISO8601 | null>",
    "monthly_amount_usd": <number>,
    "currency": "USD"
  },
  "metadata": { /* libre, opaco */ }
}
```
  El App mapea `event_kind`→transición de estado, guarda `status`+`current_period_end`, es idempotente por `(external_session_id, external_subscription_id, event_kind, current_period_end)`. **Cero earnings en este wire** (§3).

- **Outbound (App → portal): el pull de project-status EXISTENTE (§8.2).** El estado de membresía viaja como **campo aditivo sanitizado** en el signed-read que NoonWeb ya consume (igual que status/versions/requests). NoonWeb lo pinta en el workspace. Sanitizado = solo `{ status, plan/monthly, current_period_end }`; **nunca** ids de Stripe, montos de earnings, ni internals (§8.3).

### Q-M-3 — Modelo Stripe → ✅ **Opción A** (subscription + activación add-on)
Un solo checkout `mode:"subscription"` con la activación (+ seller fee) como `add_invoice_items` en la primera factura. Razón: mejor UX cliente (un solo flujo "activación + mensualidad") + un solo customer+subscription = un solo stream de ciclo de vida para los webhooks recurrentes. **El App es robusto a A o B**, pero pide una garantía de contrato que A cumple naturalmente:
- El **monto de activación** (earnings-bearing) llega como **campo distinto** en el evento de activación (ya está: `payment.amount` vs `monthly_amount_usd`). El App acredita earnings sobre ese campo, **exactamente como hoy**, sin diseccionar line-items de Stripe.
- Las renovaciones llegan por el **wire de ciclo de vida** (§Q-M-2), **estado-only**.

### Q-M-4 — Dunning / fallo de pago → ⏭️ **diferido a impl. de M1** (default App en §6)
### Q-M-5 — Cancelación + refund → ⏭️ **diferido a impl. de M1** (default App en §6)
Negocio + legal; el master-spec no define la mecánica. Se implementan en M1 con la política del owner. Defaults direccionales App-side en §6.

### Q-M-6 — Env / secreto → ✅ **el App no agrega nada**
El wire inbound de ciclo de vida y el outbound del pull **reusan `NOON_WEBSITE_WEBHOOK_SECRET`** (como B.2b/B.3a/B.5b). Cero env nuevo App-side. Cualquier env/secreto Stripe recurrente es **NoonWeb-only**.

---

## 3. Cierre económico nuevo (master-spec §24.2) — earnings

`master-spec-v3.md §24.2` cierra: el seller fee *"is one-time; is charged inside the activation payment; is not monthly; is not recurring; does not participate in membership/monthly payments"*. **Decisión de owner (2026-06-22) extendiéndolo:** las mensualidades son **ingreso puro de Noon, sin split** (ni seller, ni developer, ni noon-as-actor). Por tanto:

- `creditActivationEarnings` se dispara **una sola vez, sobre la activación** (sin cambio vs hoy).
- El receptor de ciclo de vida (`renewed`/`payment_failed`/...) **nunca** toca earnings ni el wallet de actores. Es **estado-only**.
- Esto simplifica M1 y mantiene `§24.2` literal.

---

## 4. Qué construye el App (M0 + mitad de M1)

**M0 (ya, aditivo):**
- Captura de `payment_modality` + `monthly_amount_usd` en `payment-confirmed` → `payments.metadata`; opcional surfacing en pm-queue.

**M1 — mitad App (contra este contrato):**
- **Modelo de estado de membresía** (App-interno, SoT): tabla/columnas keyed por project (`status`, `current_period_end`, `monthly_amount_usd`, `external_subscription_id` opaco, `modality`). Migración aditiva (lane a confirmar por ownership).
- **Receptor `membership-lifecycle`** (HMAC, idempotente, ledger; mapea `event_kind`→estado; estado-only, cero earnings).
- **Outbound sanitizado** del estado en el pull de project-status (§8.2).
- **Sin superficie cliente en el App** (§8.3 intacto); el estado lo pinta NoonWeb.

---

## 5. Orden de despliegue (duro, como Fase 2 / B.5b)

1. **App confirma C-M0 + co-firma Q-M-1..6** → contrato congelado al ack de NoonWeb del shape §Q-M-2. *(este doc)*
2. App ship M0 (captura) — independiente, puede ir ya.
3. App construye su mitad de M1 (modelo + receptor + outbound), migración **aplicada-antes-de-merge**. El receptor acepta el wire desde el día 1 (no hay demanda → no requiere flag).
4. NoonWeb construye Stripe (subscription + webhooks recurrentes + forward normalizado) + el indicador §8.2, **gateado por un flag NoonWeb** (p.ej. `MEMBERSHIP_BILLING_ENABLED=false`) hasta que ambas mitades estén desplegadas.
5. **Gate de habilitación:** App confirma su mitad desplegada → NoonWeb flipea el flag.
6. **Smoke bilateral:** cliente elige Membresía en checkout → activación cobrada (earnings 1×) + subscription creada → App recibe `payment-confirmed` (modality=membership) + `membership-lifecycle:activated` → estado=active → el portal lo muestra vía pull. Luego renovación/fallo/cancelación → transiciones de estado → el portal refleja. Negativos: firma mala→401, evento fuera de orden→idempotente, etc.

> **Dependencia cruzada:** el App puede construir + unit-testear su mitad contra este contrato YA (mock del wire); el E2E recurrente espera la mitad Stripe de NoonWeb.

---

## 6. Defaults App-side para Q-M-4/Q-M-5 (direccionales, a ratificar por owner+legal en M1)

- **Dunning:** apoyarse en los **smart retries de Stripe** → estado `past_due`; **sin suspensión silenciosa**; suspender el acceso al workspace (NoonWeb oculta el contenido) **solo al fallo final** (`subscription.deleted`/`ended`). El App es SoT del estado; quién/cuándo suspende = decisión NoonWeb sobre lo que el App expone.
- **Cancelación:** **fin-de-período** (mantener acceso hasta que termine el período pagado) por default.
- **Refund:** activación y mensualidad **no reembolsables** por default una vez cobradas; excepciones = PM/Admin + legal.
- Todo esto **se ratifica/edita en el system-architecture de M1** antes de implementar AC-4/AC-5; el master-spec/T&C deben actualizarse (recurrencia) — owner+legal.

---

## 7. Referencias

- Co-diseño NoonWeb: `noon-web-main/docs/2026-06-21-noonweb-to-app-v3-membership-billing-codesign.md`.
- Spec NoonWeb (M0–M3): `noon-web-main/specs/2026-06-21-v3-membership-billing.md`.
- Modelo de producto: `App-nooncode/docs/product/master-spec-v3.md` §8.2 (indicadores), §10.1/§10.2 (one-time vs membership), **§24.2 (regla económica — earnings)**.
- Patrón cross-repo SoT/operador: Fase 2 Publish (`docs/handoffs/...v3-fase2...`, ADR-038/039).
- Invariante de frontera: memoria `project_client_web_seller_app_boundary`; receptor base: `app/api/integrations/website/payment-confirmed/route.ts`, `lib/server/website-integration.ts`.
- Wire/HMAC: `docs/integrations/cross-repo-webhook-v1.md`; auth: `lib/server/website-webhook-auth.ts` (`NOON_WEBSITE_WEBHOOK_SECRET`).
