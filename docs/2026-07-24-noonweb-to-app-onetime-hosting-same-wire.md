# Adenda — NoonWeb → App: **el one-time sin renovar llega por el MISMO wire**

**Fecha:** 2026-07-24
**Para:** quien trabaje **App-nooncode** (dev o sesión de agente).
**De:** NoonWeb (`noon-web-main`).
**Extiende:** `docs/2026-07-22-noonweb-to-app-membership-end-unpublish.md` (el handoff del despublicado). Léanla junto a esta.

---

## 0. TL;DR

- Desde que existe el **hosting anual del cliente one-time** (post-2026-07-22), el despublicado que les pedimos cubre **DOS planes, no uno**: la membresía que termina **y** el hosting que no se renueva.
- **Cero cambio de contrato.** El hosting es una suscripción de Stripe con la misma forma Opción A de la membresía (solo `interval: "year"`), así que sus eventos llegan por el mismo webhook y se reenvían por el mismo `membership-lifecycle`.
- **La regla no cambia:** `membership.status === "ended"` → despublicar. Ahora ese `ended` puede significar "el one-time no renovó su hosting". La acción es **idéntica** — no hace falta ramificar.
- Hoy **no llega nada** de esto: `HOSTING_BILLING_ENABLED` sigue apagado en NoonWeb. Esta adenda aterriza ANTES de encenderlo, para que el caso no los sorprenda.

---

## 1. Cómo distinguirlos (solo si les interesa — la acción es la misma)

La metadata de la suscripción (que ya reciben en el checkout/webhook) los separa:

| Campo | Membresía | Hosting one-time |
|---|---|---|
| `payment_modality` | `"membership"` | `"one_time"` |
| `billing_interval` | — | `"year"` o `"month"` |
| `hosting_price_usd` | — | `"350"` / `"35"` |

---

## 2. Tres detalles del wire que conviene saber

1. **`monthly_amount_usd` llega en `0`** para una suscripción de hosting (el campo es mensual-shaped y el proposal one-time no tiene mensualidad). Es **informativo**: las earnings se acreditan 1× en la activación vía `payment-confirmed`, igual que siempre — nada que hacer con ese 0.
2. **El primer año va incluido** en el precio del build → la suscripción de hosting nace con un **trial de 365 días** (`status` de Stripe = `trialing`). Nuestro mapeo ya lo traduce a `"active"` en el wire, así que verán una suscripción activa normal; el primer cobro real llega al año.
3. **Reactivación = igual que la membresía:** vuelve a pagar → `status: "active"` por el mismo wire → republicar de inmediato (la decisión Q3 del handoff original aplica tal cual).

---

## 3. Lo que sigue igual del handoff original

Retención 12 meses · página neutra al visitante · reactivación inmediata · y la **única pregunta que sigue abierta es la Q4a**: al despublicar, ¿el dominio se queda sirviendo la página neutra o se suelta? (También sigue pendiente de su lado el sync de precios del handoff `2026-07-23-...-pricing-hosting-included.md`.)
