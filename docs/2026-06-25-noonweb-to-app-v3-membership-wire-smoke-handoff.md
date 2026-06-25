# Handoff — NoonWeb → App: smoke del **wire de membership** (M1) con eventos sintéticos

**Fecha:** 2026-06-25
**De:** equipo NoonWeb (`noon-web-main`).
**Para:** App-nooncode.
**Contexto:** `MEMBERSHIP_BILLING_ENABLED` ya está **flipeado a `true` en `main`** (PR #98 merged, deploy de prod live). Antes del smoke completo con Stripe real (que requiere acceso a la cuenta de Stripe y queda para una sesión aparte), los devs quieren **verificar el wire NoonWeb → receptor del App** ahora, aprovechando que el equipo del App está disponible.

---

## 0. TL;DR — qué pedimos

1. Mapear **nuestros external ids** (abajo) a un **proyecto de prueba descartable** del lado del App (su `website_inbound_links` o equivalente), porque en este smoke **no** hubo un `payment-confirmed` real que cree el mapeo.
2. Decirnos **a qué host** apunta el receptor que van a mirar (prod o staging) → NoonWeb setea `NOON_APP_BASE_URL` a ese host para la corrida.
3. Mirar el receptor `POST /api/integrations/website/membership-lifecycle` + `project_memberships` mientras NoonWeb dispara los eventos, y confirmar las aserciones de §4.
4. Cleanup de ambos lados al terminar.

---

## 1. Alcance (qué verifica este smoke y qué NO)

Es un smoke **sintético**: NoonWeb postea a su propio webhook eventos de Stripe **firmados** (sin tocar Stripe), y eso dispara el forward `membership-lifecycle` al receptor **real** del App.

**Solo** se pueden disparar sintéticamente los 2 event kinds que llevan el objeto subscription **inline** (no gatillan `stripe.subscriptions.retrieve`):

- `customer.subscription.deleted` → `event_kind: cancelled`, `status: ended`
- `customer.subscription.updated` → `event_kind: updated`, `status` mapeado del `subscription.status`

**✅ Verifica:** el wire NoonWeb→receptor (firma HMAC, URL, shape del payload) + el comportamiento del receptor: **de-dup por `external_event_id`**, **latest-wins por `created`**, mapeo a `project_memberships`, y rechazo de firma inválida.

**❌ NO verifica** (necesita una suscripción real de Stripe → sesión con acceso a Stripe): `activated`, `renewed`, `payment_failed`. Esos hacen un `retrieve` real a la subscription, así que un sub id sintético no sirve. Quedan para el smoke con Stripe.

---

## 2. External ids a mapear (lado App)

NoonWeb sembró una proposal "membership" de prueba con estos ids. El receptor del App correlaciona por estos campos (vía `website_inbound_links`, fallback por `external_subscription_id`):

| Campo | Valor |
|---|---|
| `external_session_id` | `smoke-mem-001` |
| `external_proposal_id` | `smoke-mem-prop-001` |
| `external_subscription_id` | `sub_smoke_mem_001` |

Mapear cualquiera de estos (o los necesarios) a un **proyecto de prueba descartable**. Sin el mapeo, el receptor responde 404 no-revelador (no encuentra el proyecto).

---

## 3. Payload que emite NoonWeb (el wire, sin cambios respecto al contrato congelado)

Mismo transporte que `payment-confirmed`/§9 (HMAC `${timestamp}.${body}`, headers `x-noon-timestamp` / `x-noon-signature`, ventana ±5 min, secret `NOON_WEBSITE_WEBHOOK_SECRET`). Cuerpo:

```json
{
  "external_source": "noon_website",
  "external_session_id": "smoke-mem-001",
  "external_proposal_id": "smoke-mem-prop-001",
  "external_subscription_id": "sub_smoke_mem_001",
  "external_event_id": "evt_smoke_…",
  "membership": {
    "event_kind": "cancelled",
    "status": "ended",
    "current_period_end": "2026-07-25T…Z",
    "monthly_amount_usd": 69,
    "currency": "USD"
  },
  "created": 1750000000
}
```

- `external_event_id` = el `evt_…` del evento Stripe (estable entre re-entregas → clave de de-dup).
- `created` = unix seconds del evento (clave de latest-wins).
- `monthly_amount_usd` = **dólares enteros** (no minor units).
- **No** viaja `metadata` en este forward.

Mapeo evento sintético → wire:

| Evento sintético | `event_kind` | `status` |
|---|---|---|
| `customer.subscription.deleted` | `cancelled` | `ended` |
| `customer.subscription.updated` (sub `past_due`) | `updated` | `past_due` |
| `customer.subscription.updated` (sub `active`) | `updated` | `active` |

---

## 4. Secuencia + aserciones (a confirmar del lado App)

NoonWeb dispara, en este orden (cada comando imprime el `evt_…` y el HTTP del webhook):

| # | Acción NoonWeb | Aserción App (en `project_memberships` del proyecto de prueba) |
|---|---|---|
| 1 | `deleted` | Estado → **`ended`** (de `cancelled`). |
| 2 | `updated:past_due` | Estado → **`past_due`** (de `updated`). |
| 3 | **Replay**: mismo `external_event_id` 2 veces | **Idempotente** — el 2º no re-aplica (de-dup por `external_event_id`). |
| 4 | **Reorder**: `updated:active` (`created` nuevo), luego `updated:past_due` (`created` más viejo) | **Latest-wins** — queda **`active`**, NO retrocede a `past_due`. |
| 5 | `deleted --bad` (firma corrupta) | NoonWeb responde **400** y **no forwardea** → el App **no recibe nada**. |

> Nota: como el orden 1 deja la membresía en `ended`, para los pasos 2-4 puede convenir re-sembrar o que el App acepte transiciones desde `ended` (el wire es state-only y el App es SoT — su política de transición manda). Coordinamos en vivo el orden que les sirva para observar limpio.

---

## 5. Cleanup

- **NoonWeb:** borra el seed (`scripts/manual/smoke-membership-wire.sql` → `DELETE FROM studio_session WHERE id = 'smoke-mem-001';`, cascada borra la proposal).
- **App:** borrar el `website_inbound_links` de prueba + la fila `project_memberships` sintética del proyecto descartable.

---

## 6. Lo que queda pendiente tras este smoke

El smoke con **Stripe real** (suscripción real del checkout + Test Clock) sigue pendiente para una sesión con acceso a Stripe. Ese es el que verifica de forma definitiva que los **4 eventos** (`invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`) están suscritos y que Stripe los entrega, más los kinds `activated`/`renewed`/`payment_failed` end-to-end.
