# Handoff — App → NoonWeb: **M1 App-side half DEPLOYED → ready to flip `MEMBERSHIP_BILLING_ENABLED`**

**Fecha:** 2026-06-22
**Para:** equipo **NoonWeb** (`noon-web-main`).
**De:** App-nooncode.
**Contexto:** cierra el orden de despliegue del contrato congelado (`docs/handoffs/2026-06-22-app-to-noonweb-v3-membership-billing-amendment-resign.md`). La mitad-App de M1 está **mergeada + migrada en prod**. Esto es la señal de readiness para que NoonWeb habilite su mitad.

---

## 0. TL;DR

- **La mitad-App de M1 está LIVE** (PR #205 merged a develop `775367b` → deploy a prod vía Vercel; migración **0098 aplicada + object-verificada** en prod).
- **El receptor `membership-lifecycle` acepta eventos desde ya** (no hay flag App-side). Hasta que NoonWeb empiece a forwardear, simplemente no recibe nada (un probe suelto → 404 no-revelador).
- **Acción NoonWeb:** una vez confirmado el deploy a prod (el operador confirma), **flipear `MEMBERSHIP_BILLING_ENABLED=true`** (su constante de código) → arranca la rama subscription del checkout + los webhooks recurrentes + el forward del ciclo de vida.
- Luego: **smoke bilateral** (§3) cierra M1 E2E.

---

## 1. Qué está live del lado App

- **Receptor:** `POST /api/integrations/website/membership-lifecycle`
  - HMAC `${timestamp}.${body}` (headers `x-noon-timestamp`/`x-noon-signature`, ±5 min) **reusando `NOON_WEBSITE_WEBHOOK_SECRET`** — sin env nuevo.
  - Rate-limit antes de verify (namespace `website-membership-lifecycle`).
  - Zod **modela las 3 enmiendas re-firmadas**: `external_event_id`, `created` (unix), `membership.monthly_amount_usd` (dólares enteros) + `event_kind`/`status` enums + `metadata` libre. Campo extra desconocido = inerte; campo modelado malformado → **400**.
  - **Idempotente por `external_event_id`** (ledger `membership_lifecycle_events` UNIQUE) → un re-envío de Stripe con el mismo `evt_…` = **200 idempotente, no re-aplica estado**.
  - **Latest-wins por `created`** → un evento reordenado/viejo se acepta (200) y se ledgerea, pero **NO pisa** el estado más nuevo.
  - **State-only:** cero earnings/wallet (§24.2). El estado de membresía es App-SoT.
  - **Correlación:** por `external_session_id`/`external_proposal_id` → el proyecto del App (vía `website_inbound_links`, seteado en `payment-confirmed`); fallback por `external_subscription_id`. Sin resolver → **404 no-revelador**.
  - **Mapeo:** `event_kind` {activated, renewed, payment_failed, updated, cancelled} → `status` {active, past_due, cancelled, ended} (tabla §3 de su amendment).
- **Estado App-interno (SoT):** tablas `project_memberships` (1:1 por proyecto) + `membership_lifecycle_events` (ledger), service_role-only.
- **Outbound (§8.2):** el campo `membership` sanitizado `{ status, monthlyAmountUsd, currentPeriodEnd }` (camelCase, `status` raw para que NoonWeb mapee el label) viaja en el **project-status pull existente** — se emite **solo cuando el proyecto tiene una fila de membresía**; ausente/null si no → el indicador del portal es no-op hasta el primer `activated`. **Nunca** cruza un id de Stripe / earnings / internal (§8.3).

---

## 2. Acción NoonWeb + orden de habilitación

1. **App:** mergeado + 0098 aplicado + deploy a prod (esto). *(hecho — el operador confirma el deploy live).*
2. **NoonWeb:** flipear **`MEMBERSHIP_BILLING_ENABLED=true`** (PR de enablement, espejo del flip de `ATTACHMENTS_ENABLED`). A partir de ahí: el checkout abre la rama `mode:"subscription"` (Opción A) + los handlers recurrentes (C2) reenvían el ciclo de vida + el indicador §8.2 lee el `membership` del pull.
3. **Smoke bilateral** (§3).

> El receptor del App ya tolera eventos; no hay acople inverso. El flip es unilateral de NoonWeb cuando confirmen el deploy del App.

---

## 3. Smoke bilateral (cierra M1 E2E)

**Happy path:** un cliente elige **Membresía** en el checkout → Stripe cobra activación + crea la subscription → NoonWeb forwardea `membership-lifecycle:activated` (status `active`, `current_period_end`) → el App lo persiste (state-only, earnings 1× ya ocurrió en `payment-confirmed` sobre la activación) → el portal muestra el estado vía el pull. Luego:
- **Renovación:** `invoice.paid` (`subscription_cycle`) → `renewed`/`active` → el portal sigue activo, período actualizado.
- **Fallo de pago:** `invoice.payment_failed` → `payment_failed`/`past_due` → el portal muestra past_due.
- **Cancelación:** `customer.subscription.deleted` → `cancelled`/`ended`.

**Negativos a confirmar:**
- Firma mala / timestamp fuera de ±5 min → **401** (cero mutación).
- **Evento reordenado** (un `created` viejo tras uno nuevo) → **200** pero el estado vivo NO retrocede (latest-wins).
- **Replay** (mismo `external_event_id`) → **200 idempotente**, sin segunda mutación.
- **Primera factura** (`invoice.paid` `subscription_create`) → NoonWeb la **ignora** (ya cubierta por `activated`) → sin doble emisión.

---

## 4. Notas

- **Sin env nuevo App-side** (reusa `NOON_WEBSITE_WEBHOOK_SECRET`).
- **Sin superficie cliente en el App** (§8.3 intacto); el portal (NoonWeb) pinta el estado.
- **Suspensión dura de acceso al workspace = diferida** (ADR-M1-6): M1 transporta + muestra el estado; ocultar contenido al `ended` se decide con owner+legal + T&C. El App es SoT y ya lleva el estado.
- La policy de staff-read in-app sobre `project_memberships` se **difirió** (detalle interno del App — no afecta el contrato ni el outbound; el pull se sirve con service_role).

---

## 5. Referencias

- Contrato congelado: `docs/handoffs/2026-06-22-app-to-noonweb-v3-membership-billing-cosign-response.md` + `...-amendment-resign.md`.
- NoonWeb amendment + arquitectura: `noon-web-main/docs/2026-06-22-noonweb-to-app-v3-membership-billing-amendment.md` / `...-v3-membership-m1-architecture.md`.
- App: ADR-046, spec `specs/v3-membership-billing-m1-app-side.md`, migración `supabase/migrations/0098_project_memberships.sql`, receptor `app/api/integrations/website/membership-lifecycle/route.ts`.
- Patrón de readiness/flip: B.5b (`ATTACHMENTS_ENABLED`).
