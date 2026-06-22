# Handoff — App → NoonWeb: **re-firma de las 3 enmiendas + FREEZE cerrado** (membership-lifecycle, M1)

**Fecha:** 2026-06-22
**Para:** equipo **NoonWeb** (`noon-web-main`).
**De:** App-nooncode.
**En respuesta a:** `noon-web-main/docs/2026-06-22-noonweb-to-app-v3-membership-billing-amendment.md` (su ack + 3 enmiendas) + `noon-web-main/docs/2026-06-22-v3-membership-m1-architecture.md` (arquitectura M1, C1–C5 + ADRs).
**Objetivo:** **re-firmar las 3 enmiendas aditivas** del wire `membership-lifecycle` y **cerrar el freeze** del contrato cross-repo de M1. Con esto el App construye su mitad (receptor + estado SoT + outbound del pull) y NoonWeb puede preparar el flip de `MEMBERSHIP_BILLING_ENABLED`.

---

## 0. TL;DR

- **Las 3 enmiendas: RE-FIRMADAS** — son mejoras técnicas correctas, no rompen nada del lado App. **Contrato CONGELADO.**
- **A-1..A-5: todas confirmadas.** A-2 lo cumplimos **modelando los 3 campos** en el schema del receptor (más fuerte que solo no-strict: valida tipos + rechaza malformados con 400). El de-dup es por **`external_event_id`** (primario) + **latest-wins por `created`**; la clave compuesta queda como defensa secundaria.
- **El App expone `membership` sanitizado en el pull** (`{status, monthlyAmountUsd, currentPeriodEnd}`, camelCase, §8.3 allowlist) — no-op hasta que el App lo emita, sin acople de despliegue.
- **Política dunning/cancel** = punto de partida aceptado; **suspensión dura diferida** (ADR-M1-6) a owner+legal. El App es SoT y transporta el estado.
- **Cero env nuevo App-side** (el wire reusa `NOON_WEBSITE_WEBHOOK_SECRET`).

---

## 1. Re-firma de las 3 enmiendas (§2 de su handoff)

### Enmienda 1 — `external_event_id` como clave primaria de idempotencia → ✅ RE-FIRMADA
El App de-dupea por **`external_event_id` (= `evt_…` de Stripe) como clave PRIMARIA** vía un ledger dedicado con UNIQUE sobre ese id (patrón `version_actions`/`outbound_webhook_events`). Un re-envío de Stripe con el mismo `evt_…` → **200 idempotente, no re-aplica estado**. La clave compuesta que propuse (`external_session_id, external_subscription_id, event_kind, current_period_end`) **se conserva como defensa secundaria** (no como primaria). Acuerdo: `external_event_id` es más robusta (dos `updated` en el mismo período no colapsan).

### Enmienda 2 — `created` para orden latest-wins → ✅ RE-FIRMADA
El App aplica **latest-wins por `created`**: una transición de estado solo se aplica si `event.created >= last_applied_event_created` guardado en la fila de estado. Un evento **reordenado/viejo** (p.ej. `cancelled` viejo tras un `renewed` nuevo) se **acepta con 200 pero NO pisa** el estado más nuevo (se registra en el ledger para audit, no muta el estado vivo). Esto previene la resurrección de estado.

### Enmienda 3 — `monthly_amount_usd` en dólares USD enteros → ✅ RE-FIRMADA
El App trata `monthly_amount_usd` como **dólares USD enteros** (igual que `proposal.amount` en el wire existente), **sin** conversión de minor units. Lo persiste tal cual y lo re-emite en el pull. Cero riesgo de bug 100× porque ninguna de las dos puntas convierte.

> **Confirmado:** las 3 son aditivas; el receptor del App **modela las 3** explícitamente (no depende de tolerancia no-strict, aunque tampoco será `.strict()` rechazando extras desconocidos inocuos — declarará lo conocido y dejará pasar lo no modelado en un `metadata` libre).

---

## 2. Respuestas a los asks (§6)

- **A-1 (re-firmar las 3 enmiendas):** ✅ Sí — §1 arriba.
- **A-2 (receptor no-strict o modela los 3):** ✅ **Modela los 3** (`external_event_id`, `created`, `membership.monthly_amount_usd`) en el Zod schema del receptor + un `metadata` libre. Un campo extra futuro no rompe; un campo modelado malformado → **400** (no se persiste). Mejor que no-strict puro.
- **A-3 (de-dup por `external_event_id` primario + latest-wins por `created`):** ✅ Confirmado — ledger UNIQUE(`external_event_id`) + guarda `created >= last_applied`.
- **A-4 (campo `membership` sanitizado en el pull):** ✅ Confirmado. El App produce, dentro del `data` del project-status signed-read, `membership: { status, monthlyAmountUsd, currentPeriodEnd }` (camelCase, raw `status` para que NoonWeb mapee el label). **Nunca** ids de Stripe / earnings / internals (§8.3). Omitido cuando no hay membresía → indicador no-op (sin acople de despliegue).
- **A-5 (política dunning/cancel como punto de partida + suspensión dura diferida):** ✅ OK. Los defaults (smart-retries→`past_due`, sin suspensión silenciosa, suspender solo al fallo final/`ended`, cancel fin-de-período, no-refund por default) son el punto de partida; la **suspensión dura de acceso** (ocultar el workspace al `ended`) queda **diferida (ADR-M1-6)** a ratificación owner+legal + T&C. M1 **transporta y muestra** el estado; el App es SoT. (Consistente con la decisión de owner del 2026-06-22.)

---

## 3. Qué construye el App (contra el contrato congelado)

- **Receptor `POST /api/integrations/website/membership-lifecycle`** — HMAC `${ts}.${body}` (reusa `NOON_WEBSITE_WEBHOOK_SECRET`, headers `x-noon-timestamp`/`x-noon-signature`, ±5 min, rate-limit antes de verify); Zod modela los 3 campos; **idempotente por `external_event_id`** (ledger); **latest-wins por `created`**; **state-only (cero earnings/wallet, §24.2)**. Resuelve el proyecto vía el `website_inbound_links` existente (correlación `external_session_id`/`external_proposal_id`), fallback por `external_subscription_id`.
- **Modelo de estado de membresía App-interno (SoT)** — migración aditiva: fila por proyecto con `status` / `current_period_end` / `monthly_amount_usd` / `modality` / `external_subscription_id` (opaco) / `last_event_id` / `last_event_created` (para latest-wins) + un ledger de eventos para idempotencia/audit. RLS staff-read; escritura solo service_role (espejo de los receptores §9/Fase 2).
- **Outbound** — el campo `membership` sanitizado en el `data` del project-status pull (§8.2), derive-on-read desde el estado.
- **Sin superficie cliente en el App** (§8.3 intacto); **sin tocar el flujo `one_time`**; **sin env nuevo**.

> El App puede construir + unit-testear su mitad contra este contrato **ya** (mock del wire). El E2E recurrente espera el flip de `MEMBERSHIP_BILLING_ENABLED=true`.

---

## 4. Orden de despliegue (igual que su §5 / B.5b)

1. **App re-firma las 3 enmiendas + confirma receptor modela-los-3 + el campo `membership` del pull.** → **FREEZE CERRADO.** *(este doc)*
2. App construye/despliega su mitad (receptor + estado + outbound), migración **aplicada-antes-de-merge**.
3. **NoonWeb flipea `MEMBERSHIP_BILLING_ENABLED=true`** (PR de enablement) cuando el App confirme su mitad desplegada.
4. **Smoke bilateral:** cliente elige Membresía → activación cobrada (earnings 1×) + subscription creada → App recibe `payment-confirmed` (modality=membership) + `membership-lifecycle:activated` → estado=active → portal lo muestra vía pull. Luego renovación/fallo/cancelación → transiciones → el portal refleja. Negativos: firma mala→401, evento reordenado→latest-wins (no pisa), primera factura `subscription_create`→sin doble emisión (NoonWeb la ignora).

---

## 5. Referencias

- Enmiendas NoonWeb: `noon-web-main/docs/2026-06-22-noonweb-to-app-v3-membership-billing-amendment.md`.
- Arquitectura M1 NoonWeb (C1–C5, ADR-M1-1..6): `noon-web-main/docs/2026-06-22-v3-membership-m1-architecture.md`.
- Co-firma App previa: `docs/handoffs/2026-06-22-app-to-noonweb-v3-membership-billing-cosign-response.md`.
- Patrón receptor/idempotencia/ledger: Fase 2 `version-action` (`app/api/integrations/website/version-action`, ADR-039) + §9 `client-request-update`.
- Wire/HMAC base: `docs/integrations/cross-repo-webhook-v1.md`; auth `lib/server/website-webhook-auth.ts` (`NOON_WEBSITE_WEBHOOK_SECRET`).
