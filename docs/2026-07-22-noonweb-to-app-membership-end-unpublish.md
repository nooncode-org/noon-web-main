# Handoff — NoonWeb → App: **despublicar el sitio cuando la membresía termina**

**Fecha:** 2026-07-22
**Para:** quien trabaje **App-nooncode** (dev o sesión de agente).
**De:** NoonWeb (`noon-web-main`).
**Asunto:** El portal del cliente ya le **anuncia** que su sitio se apaga al terminar la membresía. Falta que el App lo **ejecute**. No hace falta cambiar el contrato: el wire ya lleva todo.

---

## 0. TL;DR

- **Política del owner (2026-07-22):** al terminar una membresía, el sitio del cliente **se apaga**. Una sola regla para todos — estático o con tráfico, sin excepciones por caso.
- **El mes ya pagado ES el periodo de gracia.** Paga el 15 de enero, cancela el 29 → servicio completo (hosting incluido) hasta el 15 de febrero. No hay gracia adicional después.
- **No se borra nada.** Reactivar devuelve el sitio tal cual estaba.
- **NoonWeb ya envió su parte** (main, commits `4374577` → `f6b57e3` → `30a80c3`): el portal pasa a solo lectura y muestra la fecha exacta de corte con estas palabras al cliente:
  - Durante el periodo pagado: *"Your site stays online until then — after that it goes offline until you renew."*
  - Al terminar: *"Your site is offline, but nothing was deleted… Reactivate and it comes back exactly as it was."*
- **Lo que pedimos:** que el App **despublique** el deployment al recibir `status: "ended"`, y lo **vuelva a publicar** al reactivar.
- **Sin cambios de contrato.** El receptor `membership-lifecycle` ya recibe el estado y la fecha. **4 preguntas abajo (§4).**

> Hoy el mensaje va por delante de la ejecución **a propósito**: el fallo inofensivo es que un sitio siga en línea más de lo anunciado; el fallo caro es que muera sin aviso. Pero mientras esto no se implemente, **le estamos prometiendo al cliente algo que no ocurre**.

---

## 1. Lo que el App ya recibe hoy (sin tocar nada)

`POST /api/integrations/website/membership-lifecycle` — el payload existente ya trae los tres datos necesarios:

```jsonc
{
  "external_session_id": "…",
  "external_subscription_id": "sub_…",
  "external_event_id": "evt_…",        // de-dupe (ya implementado)
  "membership": {
    "event_kind": "cancelled",
    "status": "ended",                  // ← ESTE es el disparador
    "current_period_end": "2026-02-15T…Z",
    "monthly_amount_usd": 200,
    "currency": "USD"
  },
  "created": 1771…                      // latest-wins (ya implementado)
}
```

Origen: `customer.subscription.deleted` en Stripe → NoonWeb reenvía `event_kind: "cancelled"` con `status: "ended"`.

---

## 2. ⚠️ La trampa: "cancelled" significa DOS cosas según el campo

La palabra `cancelled` aparece en el wire en dos sitios y **no quieren decir lo mismo**:

| Campo | Valor | Significado real | ¿Apagar? |
|---|---|---|---|
| `membership.status` | **`cancelled`** | Programada para terminar. **Sigue pagada y en servicio** hasta `current_period_end`. | **NO** |
| `membership.event_kind` | **`cancelled`** | La suscripción se borró en Stripe. Va siempre junto a `status: "ended"`. | Sí |

> **Regla única y segura: apagar solo si `membership.status === "ended"`.** No mires `event_kind`.

`status: "cancelled"` es justo el caso del cliente que pagó el 15 de enero y canceló el 29: **le quedan más de dos semanas pagadas**. Apagarle el sitio ahí es quitarle servicio que ya cobramos. El portal en ese estado sigue completamente funcional y solo muestra un aviso ámbar con la fecha. Hay un test que falla a propósito si alguien introduce ese error: `tests/maxwell/workspace-page.test.ts` → *"a membership set to end keeps working until the period closes"*.

Los otros dos estados tampoco apagan:
- **`past_due`** — Stripe está reintentando el cobro. El cobro está domiciliado, así que casi siempre se resuelve solo. Tiene su propio aviso en el portal; **no corta nada**.
- **`active`** — obvio, pero incluye el caso `cancel_at_period_end` recién pulsado (Stripe sigue diciendo `active` y nosotros reenviamos `event_kind: "updated"`, `status: "active"`).

En resumen: de los cuatro estados posibles, **solo uno apaga**.

---

## 3. Lo que pedimos al App

1. **Al recibir `status: "ended"`** → despublicar el deployment de ese proyecto. El visitante deja de ver el sitio.
2. **Conservar todo**: código, versiones, datos. Ventana de retención propuesta: **90 días** (§4, Q2).
3. **Al reactivar** (`status` vuelve a `active` tras un pago) → **re-publicar** el mismo deployment, sin rebuild ni pasos manuales. La promesa literal del portal es *"vuelve exactamente como estaba"*.
4. **Idempotencia**: `ended` puede llegar repetido (reintentos del webhook). Despublicar dos veces no debe fallar ni disparar efectos secundarios.

---

## 4. Preguntas abiertas (a co-firmar)

**Q1 — ¿Qué ve el visitante cuando el sitio está despublicado?**
NoonWeb propone: una página neutra de Noon con 404/410, sin exponer que fue por impago (es información del cliente, no de sus visitantes). ¿El App ya tiene una página así o hay que diseñarla?

**Q2 — ¿Cuánto se conserva antes de borrar de verdad?**
Propuesta: **90 días** desde `ended`, luego el App decide su política de purga. NoonWeb necesita el número para poder decírselo al cliente en el portal (hoy el mensaje dice "nada se borró" sin plazo). ¿Qué plazo puede sostener el App?

**Q3 — ¿La reactivación es automática?**
Cuando el cliente vuelve a pagar, `status: "active"` llega por el mismo wire. ¿El App puede re-publicar solo al recibirlo, o hace falta una acción del PM? Esto decide si el portal puede prometer "vuelve al instante" o tiene que decir "tu equipo lo restaura".

**Q4 — ¿Qué pasa con el dominio propio?**
Si el cliente conectó su dominio (`yourbrand.com`), al despublicar: ¿se libera, se conserva apuntando a la página neutra, o se desconecta? Afecta a lo que el portal debe advertir antes de que llegue la fecha.

---

## 5. Contexto y referencias

- Estado del portal: `app/[locale]/maxwell/workspace/[sessionId]/page.tsx` — `membershipEnding` (aviso ámbar con fecha) y `membershipEnded` (solo lectura).
- Vocabulario de estados: `lib/maxwell/membership-billing.ts` — `MembershipStatus` = `active | past_due | cancelled | ended`.
- Contrato del wire (sin cambios): `docs/2026-06-22-v3-membership-m1-architecture.md` C3 + la enmienda del 2026-06-22.
- El webhook que lo origina: `app/api/stripe/webhook/route.ts`, caso `customer.subscription.deleted`.

**Por qué esta política y no "los sitios estáticos se quedan":** el hosting es el argumento de renovación de la membresía, y regalar hosting al que cancela contradice el plan del cliente de pago único (a quien sí se le cobra dominio + hosting). Es además lo que hacen Webflow, Squarespace y Shopify: despublicar al vencer, conservar los datos, restaurar al reactivar.
