# Handoff — NoonWeb → App: **Hallazgo A arreglado** (la metadata del plan ya viaja por el wire)

**Fecha:** 2026-07-27
**Para:** quien trabaje **App-nooncode**, frente unpublish/hosting.
**De:** NoonWeb (`noon-web-main`).
**Responde a:** `docs/2026-07-27-app-to-noonweb-pricing-sync-applied-and-wire-findings.md`.

---

## 0. TL;DR

- **Hallazgo A: arreglado.** `forwardMembershipLifecycle` ya reenvía la metadata que identifica el plan. Podéis derivar la modalidad **del propio evento** de lifecycle.
- Gracias por pillarlo: nuestro handoff del 07-24 afirmaba que ya la recibíais y **no era cierto**. Ese documento queda corregido con una nota.
- **Ojo, no volcamos el blob entero** — solo tres claves, ver §2. Si necesitáis alguna más, pedidla.
- Queda vuestro **Hallazgo B** (el receptor estampa `modality: 'membership'` en todo). Con esto ya podéis derivarla del evento.

---

## 1. Qué cambió

`app/api/stripe/webhook/route.ts` → `forwardMembershipLifecycle` recibe ahora la metadata de la suscripción y la incluye en el `metadata` del payload. Antes iba solo `{ stripe_event_type }`.

Aplica a **los dos** orígenes del forward: la activación (`checkout.session.completed` en modo suscripción) y los eventos posteriores (`customer.subscription.*`, `invoice.*`).

## 2. Qué llega exactamente

```jsonc
"metadata": {
  "stripe_event_type": "customer.subscription.deleted",
  "payment_modality": "one_time",   // "membership" | "one_time"
  "billing_interval": "year",       // SOLO en suscripción de hosting
  "hosting_price_usd": "350"        // SOLO en suscripción de hosting
}
```

- **`payment_modality`** va en toda suscripción creada por el checkout actual.
- **`billing_interval` / `hosting_price_usd`** existen solo en una suscripción de hosting, así que **su presencia es en sí misma la señal** — no hace falta comparar strings.
- Suscripciones **antiguas** (creadas antes de que el checkout escribiera esa metadata) llegarán sin estas claves: el campo simplemente no aparece. Tratad la ausencia como "no sé", no como membresía.

**Por qué no el blob entero:** el resto de la metadata de la suscripción es el `public_token` de la propuesta, `amount_usd`/`monthly_amount_usd` (que el payload ya lleva en `monthly_amount_usd`) e ids internos. Volcarlo todo enviaría el token público y, además, cualquier clave que añadamos al checkout en el futuro sin haberlo decidido. Si os hace falta otra, decidnos cuál y la añadimos explícitamente.

## 3. Cobertura

`tests/maxwell/stripe-webhook-membership.test.ts` — 4 tests nuevos: membresía reenvía `payment_modality`; hosting reenvía intervalo + precio; **el resto de la metadata NO se reenvía** (afirma que el token público no viaja); y una suscripción sin esas claves no rompe el forward. Comprobados por mutación (revertir el fix tumba 3).

## 4. Lo que sigue

Vuestro orden sugerido se mantiene, con A ya tachado:

1. ~~Fix A (Web)~~ ✅ hecho aquí.
2. **Fix B (App)** — derivar `modality` de `metadata.payment_modality` en `membership-lifecycle-repository.ts` en vez de hardcodear `'membership'`.
3. Verify en Stripe test del checkout de hosting (que el build se cobre hoy y el hosting $0 el primer año).
4. Flip de `HOSTING_BILLING_ENABLED`.

**Dato que pedisteis:** los precios del hosting viven en `lib/maxwell/hosting-billing.ts` (`HOSTING_MONTHLY_USD = 35`, `HOSTING_YEARLY_USD = 350`). Si cambian, avisamos para que toquéis también los literales de vuestro `pricing-parity.test.ts`.
