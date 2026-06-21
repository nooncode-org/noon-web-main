# spec — v3 Membership billing (cumplir el modelo "Membresía" LOCKED)

## 1. Title and metadata

- **Iteración:** v3 Membership billing — implementar la modalidad de pago "Membresía" (activación + mensualidad recurrente) que el doc comercial LOCKED exige y el sistema ya advierte pero no cobra.
- **Fecha:** 2026-06-21
- **Autor:** los devs (NoonWeb)
- **Status:** Draft
- **Router mode:** New Build (cross-repo) — con un primer chunk de consistencia sobre lo existente.
- **Depth:** Full (afecta contratos, data flow, frontera cross-repo, billing).

---

## 2. Business objective

El doc `docs/maxwell/maxwell-commercial-constraints.md` (LOCKED, Fase 0, "no negociable") define **dos** modalidades principales: Pago único y **Membresía** (activación + mensualidad recurrente). Hoy el sistema **advierte** la membresía en cada propuesta (`prompts.ts:181`, con precios reales de `proposal-rules.ts`) pero **solo puede cobrar la activación** — el monthly nunca se colecta. Esta iteración existe para **cerrar la brecha entre el modelo documentado y lo cobrable**: que un cliente que elige Membresía sea efectivamente cobrado activación + mensualidad, y que el portal refleje su estado de membresía. El sistema deja de ofrecer un cobro que no puede ejecutar.

---

## 3. Scope — in

Esta iteración es un **paraguas que DEBE chunkearse** (ver §13). El alcance completo del modelo incluye:

- **Captura de modalidad:** persistir qué modalidad eligió el cliente (pago único / membresía / flexible) + el monthly aplicable, hoy ausente del data model (`proposal_request` solo guarda `approvedAmountUsd`).
- **Cobro recurrente (Stripe):** además de la activación one-time ya existente, una suscripción mensual real por el monthly del SKU (Stripe `mode:"subscription"` o suscripción separada).
- **Webhooks recurrentes:** manejar el ciclo de vida (`invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated|deleted`), hoy el webhook solo escucha `checkout.session.completed`.
- **Estado de membresía:** activo / past_due / cancelado + fin de período actual; quién es SoT se define cross-repo (ver §7/§10).
- **Indicador §8.2 en el portal:** el workspace cliente muestra plan + estado de membresía (el spec pide "membership or payment model indicators").
- **Self-manage (Fase 6b / Customer Portal):** que el cliente gestione/cancele su suscripción (`stripe.billingPortal`).
- **Frontera cross-repo:** wire NoonWeb↔App para el estado de membresía (el wallet es App-owned), co-firmado como §9/Fase 2/B.4.

---

## 4. Scope — out

- **Override del modelo (one-time only):** sacar la membresía contradiría el constraint LOCKED de Fase 0 — fuera de esta iteración; sería una decisión de owner aparte que edita el doc no-negociable.
- **Pago flexible (secundaria):** modalidad SECUNDARIA del doc; no entra hasta que membership esté resuelta.
- **Scope-eval / B.3 (§10 one-time vs membership para ejecución de requests):** mayormente App-side; depende de que el producto de membership exista. Se lista como chunk posterior, no en el alcance inmediato.
- **Lógica de earnings/wallet del lado App:** App-owned; NoonWeb no la construye.
- **Rediseño del pricing engine:** la tabla de 15 SKUs (`proposal-rules.ts`) ya tiene activation+monthly; no se re-modela.
- **Cambios al flujo de pago único existente:** se preserva intacto; la membresía se suma, no lo reemplaza.

---

## 5. Acceptance criteria

(Del modelo completo — se reparten por chunk en §13.)

1. El sistema **persiste** la modalidad elegida por el cliente y, si es membresía, el monthly del SKU (verificable en DB).
2. Un cliente que elige Membresía es **cobrado la activación Y la mensualidad recurrente** por Stripe (no manual), por los montos exactos del SKU (`proposal-rules.ts`).
3. El portal cliente (`/maxwell/workspace/[sessionId]`) **muestra el estado de membresía** (plan + activo/past_due/cancelado) — §8.2.
4. Un fallo de pago mensual sigue una **política explícita** (gracia / suspensión) sin romper el acceso de forma silenciosa.
5. El cliente puede **cancelar/gestionar** su membresía (Customer Portal) — Fase 6b.
6. El estado de membresía es **consistente cross-repo** (NoonWeb y App coinciden), vía un wire co-firmado.
7. El sistema **ya no advierte** una membresía que no puede cobrar (la brecha viva se cierra).

---

## 6. Affected files and modules

- **Pricing (sin cambio de lógica):** `lib/maxwell/proposal-rules.ts` (ya tiene `PRICING_TABLE` activation+monthly + `membershipRecommended`).
- **Propuesta / data model:** `lib/maxwell/repositories.ts` (`proposal_request`: solo `approvedAmountUsd` hoy → agregar modalidad + monthly + ids de Stripe sub/customer + estado) · migración nueva (espeja `20260511_012_stripe_checkout.sql`).
- **Checkout:** `app/api/maxwell/checkout/route.ts` (hoy `mode:"payment"` un line-item → rama membresía con activación + recurring).
- **Webhook:** `app/api/stripe/webhook/route.ts` (hoy solo `checkout.session.completed` → agregar invoice/subscription lifecycle).
- **Activación:** `lib/maxwell/payment-activation.ts` (`confirmProposalPayment` → manejar setup de membresía + renovaciones).
- **Wire cross-repo:** `lib/noon-app-integration.ts` (`buildWebsiteProposalPayload`/`sendPaymentConfirmedToNoonApp` → incluir modalidad/membership + un wire de estado de membresía nuevo).
- **Portal:** `app/[locale]/maxwell/workspace/[sessionId]/page.tsx` (+ componente indicador §8.2) y el pull de project-status (`lib/maxwell/project-status-*`).
- **Proposal UI/prompt:** `components/maxwell/public-proposal-payment.tsx` (selección de modalidad) · `lib/maxwell/prompts.ts` (ya advierte membership).
- **Customer Portal:** ruta nueva `app/api/maxwell/billing-portal` (Fase 6b).
- **Legal:** `docs/legal-source/terms-and-conditions.txt` (ya menciona memberships, línea 114 — revisar recurrencia/cancelación/refund).

---

## 7. Dependencies

| Dep | Tipo | Status | Impacto si falta | Owner |
|---|---|---|---|---|
| Receptor + wire de estado de membresía del App (quién es SoT) | contract | **NO construido** (membership "en gran parte SIN construir" App-side) | M1 bloqueado — sin esto NoonWeb no puede ser consistente con el wallet App-owned | App (co-firma) |
| Stripe subscription mode + webhooks recurrentes | external | Disponible (Stripe lo soporta) | Core de M1 | NoonWeb |
| Tabla de pricing activation+monthly | internal | **Construido** (`proposal-rules.ts`) | — | NoonWeb |
| Data model de modalidad/monthly/sub-state en `proposal_request`/workspace | data | **Ausente** (solo `approvedAmountUsd`) | No se puede ni capturar la elección | NoonWeb |
| Webhook suscrito a eventos invoice/subscription | infra | Hoy solo `checkout.session.completed` | Sin renovaciones/fallos | NoonWeb + operador (config Stripe) |
| Política dunning/refund/cancelación | contract (negocio) | **No definida** | Bloquea AC-4/AC-5 | Owner (+ legal) |
| Términos legales de membership recurrente | external/legal | Presente parcial (T&C línea 114) | Riesgo legal en recurrencia | Owner/legal |

---

## 8. Assumptions

- La membresía sigue siendo modelo válido (no se va a overridear el lock de Fase 0). Si el owner decide one-time-only, este spec se archiva.
- El monthly del SKU (`proposal-rules.ts`) es el precio recurrente real, no orientativo (lo asume el doc comercial: "valores separados y explícitos").
- El wallet/estado de membresía es **App-owned** (spec §2/§8.2/§10) → el patrón cross-repo será NoonWeb corre Stripe + reenvía eventos, App es SoT del estado, el portal lo lee por el pull (espejo de §9/Fase 2). A confirmar en co-diseño (OQ-2).
- Stripe permite `price_data` recurrente en `mode:"subscription"` → no hace falta pre-crear 15 Price objects.
- El flujo de pago único existente queda intacto.

---

## 9. Risks

| # | Riesgo | Prob | Impacto | Severidad | Mitigación |
|---|---|---|---|---|---|
| R1 | Construir infra recurrente pesada antes de demanda (0 workspaces pagos orgánicos hoy) | Alta | Medio (esfuerzo desperdiciado) | **Media** | Hacer M0 (consistencia) ya; **diferir M1** hasta señal de demanda real |
| R2 | Ambigüedad de quién es SoT del estado de membresía (Web vs App) → rework | Media | Alto | **Alta** | Co-diseño + co-firma con el App ANTES de construir M1 (como §9/Fase 2/B.4) |
| R3 | Edge cases de pago fallido (suspensión de workspace, gracia, dunning) | Alta | Alto (acceso del cliente + ingresos) | **Alta** | Política explícita en Architecture; apoyarse en reintentos de Stripe; no suspender silencioso |
| R4 | La brecha "advertir sin poder cobrar" persiste si no se hace M0 | Certeza | Medio (confusión/confianza del cliente) | **Media** | M0 la cierra (captura modalidad + interino manual explícito) |
| R5 | Modelar 15 SKUs mensuales en Stripe | Baja | Bajo | **Baja** | `price_data` recurrente dinámico en subscription mode |

---

## 10. Open questions

(Bloquean M1+; NO bloquean M0 si se decide arrancar por ahí. Las marcadas **[OWNER]** son decisión de negocio; **[APP]** son co-diseño cross-repo.)

- **OQ-1 [OWNER] ¿Cuándo?** Dado 0 demanda orgánica: ¿construir M1 (recurrente real) ya, o quedarse en M0 (membresía facturada manual/interino) hasta que haya pagos reales? Es la pregunta de "cuándo" que motivó este scope.
- **OQ-2 [APP] SoT del estado de membresía:** ¿App es dueño (NoonWeb corre Stripe + reenvía eventos) o NoonWeb posee el estado de billing? El spec apunta a App (wallet App-owned) — confirmar.
- **OQ-3 [OWNER] Modelo Stripe:** ¿un solo checkout `mode:"subscription"` con la activación como `add_invoice_items`, o dos pasos (activación one-time + suscripción separada)?
- **OQ-4 [OWNER] Dunning/fallo de pago:** ¿período de gracia? ¿se suspende el workspace? ¿a los cuántos fallos?
- **OQ-5 [OWNER/legal] Cancelación + refund:** ¿cancelación inmediata o fin-de-período? ¿ventana de refund de la activación? ¿de la mensualidad?
- **OQ-6 [PRODUCTO] ¿Quién/cuándo elige la modalidad?** ¿El cliente la elige en el checkout, o el PM la fija al aprobar la propuesta?
  - **(Verificado 2026-06-21):** la aprobación de la propuesta es **App-side** — `app/api/integrations/noon-app/proposal-review-decision/route.ts` es un **receptor** que trae **un solo `amount` (la activación, "the headline activation amount" textual), SIN modalidad ni monthly**; setea `approvedAmountUsd`. El **monthly es engine-derived** (`proposal-rules.ts`), nunca PM-aprobado, y el cliente hoy **no elige** modalidad (paga `approvedAmountUsd` por el Stripe one-time). → **M0 tiene un fork que BLOQUEA su diseño hasta decisión de owner:** (a) **cliente elige en checkout** con el monthly del engine = **NoonWeb-local** (rápido; el monthly no es PM-validado, pero el cobro recurrente es manual interino y el PM lo valida al facturar); (b) **auto desde la recomendación del engine** (sin elección explícita; el portal muestra el plan sugerido) = el más chico; (c) **extender la decisión del App** para llevar modalidad+monthly = PM-validado pero **cross-repo incluso en M0** (rompe el "M0 NoonWeb-only").

---

## 11. Recommended testing methodology

**Integration-first** para los flujos de Stripe/webhook (mockear Stripe; el repo ya testea `payment-activation` en estilo integración) + **TDD** para la lógica pura (resolución de modalidad, mapeo de montos activation/monthly, guardas de estado). Justificación: la corrección de billing es de forma "webhook → estado persistido", que se valida mejor por integración; la lógica de precios/estado es pura y se presta a TDD.

---

## 12. Definition of Done

(Para el modelo completo; cada chunk define el suyo en §13.)

- [ ] Modalidad + monthly persistidos y testeados.
- [ ] Cobro recurrente real funcionando E2E (smoke bilateral con el App, como §9).
- [ ] Webhooks recurrentes manejados + idempotentes.
- [ ] Estado de membresía consistente Web↔App (wire co-firmado).
- [ ] Indicador §8.2 en el portal.
- [ ] Política dunning/cancelación/refund implementada y documentada.
- [ ] Customer Portal (6b) operativo.
- [ ] T&C revisados para recurrencia.
- [ ] 4 gates verdes por PR; migraciones aplicadas+verificadas (patrón migración-primero).
- [ ] Changelog + memoria actualizados.

---

## 13. Chunking decision

**Chunking REQUERIDO** — el modelo completo es demasiado grande y cross-repo para una iteración. Slices verticales:

- **Chunk M0 — Consistencia / captura de modalidad (NoonWeb-mostly, chico).** Persistir modalidad elegida + monthly; si es membresía, cobrar la activación por el Stripe one-time existente y marcar la membresía como "recurrente pendiente" (interino: facturación manual del PM); mostrar el indicador §8.2 con el estado interino; incluir la modalidad en el `payment-confirmed` (aditivo). **Cierra la brecha viva sin Stripe recurrente.** Gating: resolver OQ-6 (quién elige modalidad) + OQ-1 (confirmar que arrancamos por acá). Completion = el sistema captura y muestra la modalidad y deja de advertir un cobro inejecutable.
- **Chunk M1 — Cobro recurrente real (cross-repo, PESADO).** Stripe subscription + webhooks recurrentes + estado de membresía + wire co-firmado con el App. **Bloqueado** por OQ-1/OQ-2/OQ-3/OQ-4 + co-firma del App. Completion = cobro recurrente E2E verificado (smoke bilateral).
- **Chunk M2 — Customer Portal (Fase 6b).** Self-manage/cancel. Bloqueado por M1.
- **Chunk M3 — Scope-eval §10 / B.3.** App distingue one-time vs membership para ejecución de requests; el portal lo refleja. Mayormente App-side. Bloqueado por M1.

Orden: M0 → (decisión owner OQ-1) → M1 → M2/M3.

---

## 14. Success criterion

Un cliente que elige **Membresía** es cobrado por el sistema la **activación más la mensualidad recurrente** por los montos exactos del SKU, el portal muestra su estado de membresía, y el sistema **deja de ofrecer una membresía que no puede cobrar** — cumpliendo el modelo LOCKED de `maxwell-commercial-constraints.md` §2.

---

## Analysis outcome

**NEEDS CHUNKING + NEEDS CLARIFICATION.** El modelo completo no es una iteración; debe chunkearse (M0–M3). M1+ está **bloqueado** por decisiones de owner (OQ-1/3/4/5) + co-diseño/co-firma con el App (OQ-2) — no puede ir a Architecture hasta resolverlas. **Sólo M0** podría avanzar a Architecture tras resolver OQ-6 + la confirmación de OQ-1 (¿arrancamos por consistencia interina?). Recomendación de los devs: dado R1 (0 demanda orgánica) + R2/R3 (peso y riesgo de lo recurrente), **hacer M0 ahora y diferir M1 hasta señal de demanda**, abriendo en paralelo el co-diseño de membership con el App (OQ-2) para no estar en cero cuando la demanda llegue.
