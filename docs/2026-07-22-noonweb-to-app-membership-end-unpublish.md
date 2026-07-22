# Handoff — NoonWeb → App: **despublicar el sitio cuando la membresía termina**

**Fecha:** 2026-07-22
**Para:** quien trabaje **App-nooncode** (dev o sesión de agente).
**De:** NoonWeb (`noon-web-main`).
**Asunto:** El portal del cliente ya le **anuncia** que su sitio se apaga al terminar la membresía. Falta que el App lo **ejecute**. No hace falta cambiar el contrato: el wire ya lleva todo.

---

## 0. TL;DR

- **Política del owner (2026-07-22):** al terminar una membresía, el sitio del cliente **se apaga**. Una sola regla para todos — estático o con tráfico, sin excepciones por caso.
- **El mes ya pagado ES el periodo de gracia.** Paga el 15 de enero, cancela el 29 → servicio completo (hosting incluido) hasta el 15 de febrero. No hay gracia adicional después.
- **Se conserva todo 12 meses** desde el corte (decisión del owner, 2026-07-22). Reactivar dentro de esa ventana devuelve el sitio tal cual estaba.
- **NoonWeb ya envió su parte** (main, commits `4374577` → `f6b57e3` → `30a80c3`): el portal pasa a solo lectura y muestra la fecha exacta de corte con estas palabras al cliente:
  - Durante el periodo pagado: *"Your site stays online until then — after that it goes offline until you renew."*
  - Al terminar: *"Your site is offline, but nothing was deleted… Reactivate and it comes back exactly as it was."*
- **Lo que pedimos:** que el App **despublique** el deployment al recibir `status: "ended"`, y lo **vuelva a publicar** al reactivar.
- **Sin cambios de contrato.** El receptor `membership-lifecycle` ya recibe el estado y la fecha.
- **§4:** tres decisiones ya tomadas por Noon — página neutra al visitante · retención 12 meses · **reactivación inmediata** — y **dos preguntas concretas** para vosotros: cuánto tarda de verdad la reactivación, y si al despublicar el dominio se suelta (si se suelta, la página neutra no llega a verse).

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
2. **Conservar todo**: código, versiones, datos. Ventana de retención: **12 meses** desde `ended` (§4, Q2).
3. **Al reactivar** (`status` vuelve a `active` tras un pago) → **re-publicar el mismo deployment, de inmediato y en el propio handler** — sin rebuild, sin cola diaria, sin revisión manual. La promesa literal del portal es *"vuelve exactamente como estaba"*, y el cliente que acaba de pagar mira su web en ese momento.
4. **Mantener el dominio enganchado** mientras está apagado, sirviendo la página neutra (§4 Q4a). Soltarlo rompe la Q1 sin que nadie se entere.
5. **Idempotencia**: `ended` puede llegar repetido (reintentos del webhook). Despublicar dos veces no debe fallar ni disparar efectos secundarios.

---

## 4. Decisiones tomadas y preguntas abiertas

Q1 y Q2 ya están decididas por el owner de Noon (no hay que debatirlas, solo confirmar que el App puede sostenerlas). Q3 y Q4 son las que dependen de vuestra infraestructura y **necesitamos vuestra respuesta**.

**Q1 — Qué ve el visitante: página NEUTRA (DECIDIDO, no es pregunta).**
El owner decidió (2026-07-22): una página sobria de Noon, del tipo *"esta web no está disponible ahora mismo"*, que **NO revela que hubo un impago**.

> El razonamiento importa para no erosionarlo luego: el visitante es **cliente de nuestro cliente**. Que se entere de que su proveedor dejó de pagar lo humilla delante de su propia gente y nos lo va a cobrar a nosotros. La información de pago es del cliente, no de sus visitantes. Por eso también se descartó la variante "¿es tuya esta web? reactívala aquí": recupera algún cliente, pero a cambio publica su impago a todo el que pase.

Lo que sí necesitamos del App: **(a)** ¿existe ya esa página o hay que diseñarla?, y **(b)** ¿con qué código responde? (NoonWeb sugiere **410 Gone** sobre 404: le dice a Google que la retire del índice sin marcar el dominio como roto, y revierte limpio al republicar).

**Q2 — Retención: 12 meses (DECIDIDO, no es pregunta).**
El owner fijó **12 meses desde `ended`** (2026-07-22). El portal ya se lo dice al cliente con esas palabras: *"your project, conversation and files stay saved for 12 months"*. Lo que sí necesitamos del App:
- **(a)** ¿Puede sostener ese plazo para el deployment y sus datos, o su infraestructura purga antes por su cuenta? Si purga antes, el portal está mintiendo y hay que corregirlo.
- **(b)** ¿Quién ejecuta el borrado a los 12 meses — el App, NoonWeb, o cada uno lo suyo? Hoy **nadie lo hace**: el plazo está anunciado pero no implementado. Es deuda conocida, no un olvido.

**Q3 — Reactivación INMEDIATA (requisito, ya no es pregunta).**
Decisión del owner (2026-07-22): cuando el cliente vuelve a pagar, **la web tiene que volver a estar en línea al momento**, sin que nadie de Noon toque un botón. El `status: "active"` llega por el mismo wire, así que el App tiene el disparador; lo que pedimos es que republique **en el propio handler**, no en una cola diaria ni con revisión manual.

Lo único que necesitamos saber: **¿cuánto tarda de verdad** desde que entra el webhook hasta que la web responde? Si son segundos, el portal se lo dice al cliente tal cual ("vuelve al instante"). Si son minutos, el portal tiene que decir "en unos minutos" — preferimos prometer de menos que quedar mal.

**Q4 — El dominio: son DOS casos distintos, y solo uno es vuestro.**

**(a) El dominio lo compró el cliente fuera** (GoDaddy, Namecheap…) y lo apuntó a nosotros — hoy el único caso real (el botón *"Add existing"* del portal). No es nuestro, **no se toca nunca**. Pero ojo con una cosa: **la página neutra de la Q1 solo aparece si el dominio sigue enganchado a nuestra infraestructura.** Si al despublicar el App lo desasocia, el visitante no ve la página de Noon: ve un error crudo del hosting, o la página de otro. Eso tumbaría en silencio la decisión de la Q1. **La pregunta concreta: ¿despublicar suelta el dominio, o lo mantiene sirviendo la página neutra?** Necesitamos lo segundo.

**(b) El dominio lo compramos nosotros** — el botón *"Buy"* del portal, **hoy sin lógica** (`workspace-add-domain.tsx`: front only, la compra por API del registrador está por construir). Cuando exista, Noon paga la renovación anual y aparece un riesgo que no tiene el caso (a): si dejamos de renovar, **el dominio caduca y se lo puede quedar cualquiera**. El cliente pierde su dirección de marca para siempre y nos la va a reclamar a nosotros, con razón, porque lo teníamos nosotros. Renovar a un cliente que ya no paga cuesta unos ~12 $/año; perderle el dominio no se arregla con dinero. **No hay que decidir esto todavía** — se decide cuando se construya la compra, y queda anotado aquí para que nadie lo construya sin darse cuenta.

---

## 5. Contexto y referencias

- Estado del portal: `app/[locale]/maxwell/workspace/[sessionId]/page.tsx` — `membershipEnding` (aviso ámbar con fecha) y `membershipEnded` (solo lectura).
- Vocabulario de estados: `lib/maxwell/membership-billing.ts` — `MembershipStatus` = `active | past_due | cancelled | ended`.
- Contrato del wire (sin cambios): `docs/2026-06-22-v3-membership-m1-architecture.md` C3 + la enmienda del 2026-06-22.
- El webhook que lo origina: `app/api/stripe/webhook/route.ts`, caso `customer.subscription.deleted`.

**Por qué esta política y no "los sitios estáticos se quedan":** el hosting es el argumento de renovación de la membresía, y regalar hosting al que cancela contradice el plan del cliente de pago único (a quien sí se le cobra dominio + hosting). Es además lo que hacen Webflow, Squarespace y Shopify: despublicar al vencer, conservar los datos, restaurar al reactivar.
