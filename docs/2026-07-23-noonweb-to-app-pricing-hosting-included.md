# Handoff — NoonWeb → App: **cambio de precios (el hosting entra en la membresía)**

**Fecha:** 2026-07-23
**Para:** quien trabaje **App-nooncode** (dev o sesión de agente).
**De:** NoonWeb (`noon-web-main`).
**Asunto:** Cambiaron los 15 valores `monthly` de la tabla canónica. **Hay que aplicar el mismo cambio en el App, byte a byte.** Hasta que se aplique, los dos repos cotizan precios DISTINTOS al mismo cliente.

---

## 0. TL;DR

- **Todos los `monthly` suben $35.** Los `activation` **no cambian**.
- **Por qué:** la membresía **incluye hosting + base de datos** (modelo del owner). Su precio ahora lleva ese coste dentro.
- **Qué arregla:** las dos membresías más baratas ($25 y $32) estaban **por debajo** del hosting suelto ($35/mes) — el plan que da menos costaba más. Ahora toda membresía queda por encima.
- **Acción:** copiar `lib/maxwell/pricing-table.v1.json` **tal cual** desde este repo y ajustar `lib/maxwell/pricing.ts` para que coincida. El test de paridad de cada repo compara la tabla local **contra su propio JSON**, así que un JSON desactualizado en el App **pasa en verde igual** — por eso este aviso existe.
- **No es retroactivo:** las suscripciones de Stripe vivas conservan su precio. Esto solo afecta a propuestas NUEVAS.

---

## 1. La tabla nueva (los 15 `monthly` cambian; `activation` intacto)

| Categoría | Tier | activation | monthly ANTES | **monthly AHORA** |
|---|---|---|---|---|
| landing | low | 49 | 25 | **60** |
| landing | medium | 79 | 32 | **67** |
| landing | high | 129 | 49 | **84** |
| ecommerce | low | 79 | 39 | **74** |
| ecommerce | medium | 129 | 55 | **90** |
| ecommerce | high | 199 | 79 | **114** |
| webapp | low | 99 | 49 | **84** |
| webapp | medium | 179 | 69 | **104** |
| webapp | high | 279 | 109 | **144** |
| mobile | low | 129 | 49 | **84** |
| mobile | medium | 199 | 69 | **104** |
| mobile | high | 299 | 109 | **144** |
| saas_ai | low | 129 | 69 | **104** |
| saas_ai | medium | 229 | 99 | **134** |
| saas_ai | high | 349 | 149 | **184** |

El JSON canónico añade además dos campos nuevos: `revision` (`"2026-07-23-hosting-included"`) y `changelog`. **Cópienlos también** — el archivo debe quedar byte-idéntico, y `revision` está justo para que un gemelo desactualizado se note de un vistazo.

---

## 2. El contexto que explica el número

El owner fijó el **hosting suelto** (para el cliente de pago único que solo quiere su sitio en línea, sin desarrollo) en **$35/mes o $350/año**. El costeo detrás:

- **Vercel cobra por asiento, no por proyecto** → el coste marginal de un cliente más es ~$0.
- **Supabase cobra por proyecto** → $10/mes ($120/año) por cada cliente con base de datos.
- Coste real por cliente con base de datos: **$140–205/año** cargando los fijos.

Como la membresía **incluye** ese hosting, su precio tenía que llevarlo dentro. De ahí el +$35 uniforme.

---

## 3. Por qué no bastaba con bajar el hosting

Para no chocar nunca con el piso de la membresía ($25), el hosting tendría que bajar a ≤$19/mes = $190/año — **por debajo del coste** de un cliente con base de datos ($140–205/año), o sea perdiendo dinero con los clientes más pesados. Subir la membresía era la única salida que no rompía la cuenta.

---

## 4. Invariante que ahora está protegida

NoonWeb añadió a su test de paridad dos comprobaciones que **el App haría bien en replicar**:

1. **Toda membresía mensual > hosting mensual.** Si alguna vez vuelve a quedar por debajo, la oferta se vuelve irracional (el plan que contiene al otro cuesta menos).
2. **La membresía más barata × 12 > hosting anual.** El plan anual lleva descuento, así que es la barrera más difícil de superar.

Sin esas dos, cualquier retoque futuro de precios puede reintroducir la inversión sin que nadie lo note.

---

## 5. Referencias

- Tabla canónica: `lib/maxwell/pricing-table.v1.json` (gemelo en ambos repos).
- Tabla local NoonWeb: `lib/maxwell/proposal-rules.ts` → `PRICING_TABLE`.
- Tabla local App: `lib/maxwell/pricing.ts` (ACTIVATION / MEMBERSHIP).
- Precio y costeo del hosting: `lib/maxwell/hosting-billing.ts`.
- Tests: `tests/maxwell/pricing-parity.test.ts` (aquí) · `tests/server/maxwell/pricing-parity.test.ts` (App).
