# Handoff — NoonWeb → App: co-diseño de **membership billing** (cobro recurrente, M1)

**Fecha:** 2026-06-21
**Para:** quien trabaje **App-nooncode** (dev o sesión de agente).
**De:** NoonWeb (`noon-web-main`).
**Asunto:** Abrir el co-diseño del **cobro recurrente de membresía** (modalidad "Membresía" del doc comercial LOCKED). NoonWeb ya construyó el **chunk M0** (captura de modalidad, sin cobro recurrente); este doc pide co-firma de la frontera cross-repo para **M1** (cobro recurrente real).

> Spec completo del lado NoonWeb: `noon-web-main/specs/2026-06-21-v3-membership-billing.md` (chunks M0-M3, riesgos, decisiones de owner). Este handoff es la parte cross-repo.

---

## 0. TL;DR

- **Membresía es modelo LOCKED** (`maxwell-commercial-constraints.md` §2 + master-spec §10.2): activación + mensualidad recurrente. Hoy **solo se cobra la activación**; la mensualidad nunca se cobró (se difirió a propósito del lanzamiento Stripe — "Out Of Scope: Subscriptions or memberships").
- **NoonWeb construyó M0** (PR #93): captura la **modalidad elegida** por el cliente + el **monthly** (engine-derived) en el checkout, lo muestra en el portal (§8.2), y lo **manda aditivo al App** en `payment-confirmed`. **Sin Stripe recurrente** — la mensualidad se factura **manual** (PM) por ahora.
- **M1 = cobro recurrente real**, y **NO es NoonWeb-only**: el spec asigna el **wallet/estado de membresía al App** (§2/§8.2/§10); NoonWeb es dueño del Stripe checkout/webhook. → hace falta **co-diseño + co-firma** (molde §9/Fase 2/B.4).
- **Secuencia propuesta:** M1 se **difiere hasta que haya demanda real** (hoy 0 workspaces pagos orgánicos), pero **co-diseñamos ahora** para no arrancar en cero cuando llegue. **6 preguntas abajo (§4).**

---

## 1. Qué cambia YA con M0 (lo que el App empieza a recibir)

NoonWeb agrega **2 campos aditivos + nullable** al payload de handoff (`buildWebsiteProposalPayload`, que alimenta `inbound-proposal` y **`payment-confirmed`**):

```jsonc
"proposal": {
  "title": ..., "body": ..., "amount": ..., "currency": ...,
  "payment_modality": "one_time" | "membership" | null,   // NUEVO — elegido por el cliente al pagar
  "monthly_amount_usd": <number|null>                      // NUEVO — el monthly del SKU (engine-derived)
}
```

- En `inbound-proposal` vienen **null** (la modalidad se elige después, al pagar).
- En **`payment-confirmed`** vienen **seteados** cuando el cliente eligió en el checkout.
- **Aditivo:** el App puede ignorarlos hoy (no rompe nada). **Útil ahora:** registrar qué plan eligió el cliente para la facturación manual de la mensualidad + para cuando llegue M1.
- **El monto cobrado por Stripe NO cambia** en M0: sigue siendo la **activación** (PM-aprobada, `mode:"payment"`). La mensualidad NO se cobra todavía.

**Confirmá (C-M0):** ¿el receptor `payment-confirmed` del App tolera estos 2 campos aditivos (los persiste o los ignora sin romper)?

---

## 2. La frontera cross-repo para M1 (cobro recurrente)

El spec asigna el **wallet/estado de membresía al App**; NoonWeb es dueño del **Stripe** (checkout + webhooks) y del **portal cliente**. La forma que NoonWeb propone (a co-firmar):

- **NoonWeb corre Stripe:** crea la suscripción (`mode:"subscription"` con la activación como add-on, o suscripción separada), recibe los **webhooks recurrentes** (`invoice.paid`/`invoice.payment_failed`/`customer.subscription.updated|deleted`).
- **NoonWeb reenvía el ciclo de vida al App** (wire saliente nuevo, molde `payment-confirmed`/§9): "membership activa / renovó / falló / canceló" + período actual.
- **El App es SoT del estado de membresía** (vive en el wallet): activo / past_due / cancelado / fin-de-período. El App lo expone **sanitizado en el project-status pull** (§8.2), y NoonWeb lo pinta en el portal (igual que status/versions/requests hoy).
- **NoonWeb NO duplica el estado** del wallet — solo opera Stripe y reenvía eventos. (Espejo de la decisión de Fase 2 Publish: el App es SoT, NoonWeb opera la acción.)

Esto mantiene el invariante del spec (el cliente vive en NoonWeb; el wallet es interno del App) y reusa los patrones cross-repo ya probados.

---

## 3. Lo que queda fuera de M1 (chunks posteriores)

- **M2 — Customer Portal (Fase 6b):** self-manage/cancelación (`stripe.billingPortal`). Depende de M1.
- **M3 — scope-eval §10 / B.3:** el App distingue one-time vs membership para ejecución de requests (hoy degrada a one-time). Mayormente App-side; depende de que exista el producto de membership.

---

## 4. Preguntas de co-diseño (para co-firma del App)

- **Q-M-1 (SoT del estado):** ¿el App es dueño del estado de membresía (NoonWeb corre Stripe + reenvía eventos), como en §2? ¿O preferís otro reparto?
- **Q-M-2 (transporte del estado):** ¿el estado de membresía viaja en el **project-status pull** existente (campo aditivo sanitizado, §8.2) para que el portal lo lea? ¿O un wire nuevo?
- **Q-M-3 (modelo Stripe):** ¿un solo checkout `mode:"subscription"` con la activación como `add_invoice_items`, o activación one-time + suscripción separada? (Afecta el `payment-confirmed`.)
- **Q-M-4 (dunning/fallo de pago):** política ante `invoice.payment_failed` — ¿gracia? ¿se suspende el acceso al workspace? ¿a los cuántos fallos? ¿quién decide?
- **Q-M-5 (cancelación + refund):** ¿inmediata o fin-de-período? ¿ventana de refund de activación/mensualidad? ¿quién aprueba?
- **Q-M-6 (env/secreto):** ¿se necesita algún env/secreto nuevo de algún lado para el wire de estado de membresía, o reusamos `NOON_WEBSITE_WEBHOOK_SECRET` como el resto?

---

## 5. Secuencia + próximo paso

- **Ahora:** M0 vive (tras aplicar la migración 029 + mergear PR #93). El App empieza a recibir `payment_modality`/`monthly_amount_usd` en `payment-confirmed` → puede registrar el plan elegido para la facturación manual interina.
- **M1 (recurrente):** **diferido hasta señal de demanda** (0 workspaces pagos orgánicos hoy). Pero **co-firmemos §4** para tener el contrato listo.
- **Pendiente App:** responder C-M0 (tolera los 2 campos aditivos) + Q-M-1..6.
- **Pendiente NoonWeb:** con la co-firma, dimensionar M1 (Stripe subscription + webhooks recurrentes + wire de estado) cuando se levante el diferimiento.
