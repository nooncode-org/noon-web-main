# Handoff — App → NoonWeb: **sync de precios APLICADO** + 2 hallazgos del wire para el frente unpublish

**Fecha:** 2026-07-27
**Para:** quien trabaje **noon-web-main** (en especial los devs del frente unpublish/hosting).
**De:** App-nooncode.
**Responde a:** `docs/2026-07-23-noonweb-to-app-pricing-hosting-included.md` y la adenda `docs/2026-07-24-noonweb-to-app-onetime-hosting-same-wire.md`.

---

## 0. TL;DR

- **El sync de precios está HECHO** — App PR #298. Los dos repos vuelven a cotizar lo mismo.
- Las **2 invariantes** del test de paridad (membresía > hosting) están replicadas en el App.
- Al contrastar los dos repos encontramos **2 desajustes lógicos** que tocan al frente unpublish/hosting — ninguno urgente hoy (el switch está apagado), pero conviene resolverlos ANTES de encender `HOSTING_BILLING_ENABLED`.

---

## 1. Lo aplicado en el App (PR #298)

- `lib/maxwell/pricing-table.v1.json` copiado **byte-idéntico** desde este repo (verificado con `cmp`; `revision: "2026-07-23-hosting-included"` incluida).
- `lib/maxwell/pricing.ts` → tabla `MEMBERSHIP` con los 15 `monthly` nuevos; `ACTIVATION` intacta.
- `tests/server/maxwell/pricing-parity.test.ts` → replicadas las 2 invariantes: toda membresía mensual > hosting suelto ($35/mes) y la más barata ×12 > hosting anual ($350). Los precios de hosting van pinneados como literales en el test del App (el App no tiene `hosting-billing.ts`) — **si algún día cambian `HOSTING_MONTHLY_USD`/`HOSTING_YEARLY_USD`, avisen: hay que tocar ese test también**, como cualquier cambio de precios.

---

## 2. Hallazgo A — la metadata distintiva NO viaja por el wire

La adenda del 07-24 (§1) dice que la metadata de la suscripción (`payment_modality` / `billing_interval` / `hosting_price_usd`) "ya la reciben en el checkout/webhook" y separa membresía de hosting one-time. **En el código actual eso no es así para el wire de lifecycle:**

- Esa metadata vive en la **suscripción de Stripe** (la escribe `app/api/maxwell/checkout/route.ts`).
- Pero `forwardMembershipLifecycle` (`app/api/stripe/webhook/route.ts`) reenvía al App solo `metadata: { stripe_event_type }` — la metadata de la suscripción **no se copia al forward**.
- El App solo conoce la modalidad por el `payment-confirmed` inicial (`proposal.payment_modality`); en los eventos de lifecycle posteriores no puede distinguir.

Para la **acción** (despublicar en `ended`) da igual — la regla no ramifica, como dice la adenda. Pero si el App alguna vez necesita distinguir en el momento del evento (métricas, copy, auditoría), el wire no se lo da. **Fix barato si lo quieren:** en `forwardMembershipLifecycle`, volcar `subscription.metadata` al campo `metadata` del payload (el receptor del App ya lo acepta como passthrough libre — Zod sin `.strict()`).

## 3. Hallazgo B — el receptor del App etiqueta TODO como `membership`

`lib/server/projects/membership-lifecycle-repository.ts` (App) hardcodea `modality: 'membership'` en cada escritura de estado. Cuando llegue el primer evento de una suscripción de **hosting one-time** por este mismo wire, el App va a estampar `project_memberships.modality = 'membership'` en un proyecto que es one-time.

- No rompe la acción de unpublish (que mira `status`), pero **el dato almacenado queda mal** y cualquier lógica futura que lea `modality` heredará la mentira.
- Es trabajo **del lado App**, y cae natural en el frente unpublish que ya están trabajando. Si aplican el fix del Hallazgo A, el receptor puede derivar la modalidad de `metadata.payment_modality`; si no, del `payment-confirmed` ya persistido.

## 4. Orden sugerido

Ambos hallazgos son inertes mientras `HOSTING_BILLING_ENABLED = false`. La secuencia segura: fix A (Web, ~5 líneas) → fix B (App, dentro del trabajo unpublish) → verify de Stripe test del checkout (la que ya exige el comentario de `hosting-billing.ts`) → flip del switch.

---

## 5. Referencias

- App PR #298 (sync de precios + invariantes).
- Checkout hosting: `app/api/maxwell/checkout/route.ts` (metadata en la suscripción).
- Forward: `app/api/stripe/webhook/route.ts` → `forwardMembershipLifecycle`.
- Receptor App: `lib/server/projects/membership-lifecycle-repository.ts` (stateWrite → `modality`).
- Gemelo de este doc en App: `docs/handoffs/2026-07-27-app-to-noonweb-pricing-sync-applied-and-wire-findings.md`.
