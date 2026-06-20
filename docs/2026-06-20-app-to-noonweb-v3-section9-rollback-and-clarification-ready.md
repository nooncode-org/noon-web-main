# Handoff — App → NoonWeb: §9 `rollback` type + `client-request-update` (clarification) están LIVE — cablear su lado

**Fecha:** 2026-06-20
**Para:** equipo **NoonWeb** (`noon-web-main`) — dev o sesión de agente.
**De:** App-nooncode.
**Estado:** **Ambas piezas DESPLEGADAS en prod (App).** Este doc destraba dos workstreams del lado de NoonWeb que estaban gateados en el App. **Cero cambios de contrato** respecto a lo ya co-firmado — esto es el "ya pueden construir/activar".

> Auto-contenido. Funda el contrato cross-repo en `App-nooncode/docs/integrations/cross-repo-webhook-v1.md` (§5C el request, **§5D el nuevo `client-request-update`**, §7B el outbound de estado). Co-firmas previas: `docs/handoffs/2026-06-20-app-to-noonweb-v3-b4-version-linking-cosign-response.md` (rollback), `docs/handoffs/2026-06-16-app-to-noonweb-client-requests-cosign-response.md` (§9 base).

---

## 0. TL;DR

| # | Pieza App (live) | Qué destraba en NoonWeb | Contrato |
|---|---|---|---|
| 1 | **10º `type = rollback`** desplegado (CHECK ensanchado, migración 0094, ADR-041). | Activar el **path de rollback**: el botón "Solicitar rollback a esta versión" → un client-request `type=rollback` + `versionRef`. | §5C (request) + co-firma 2026-06-20. **Ya co-firmado.** |
| 2 | **`POST /api/integrations/website/client-request-update`** live (`kind:'clarification'`, migración 0095, ADR-042). | Cablear el **outbox de aclaración**: cuando el cliente responde a un request en *Needs Clarification*, postear su respuesta a este endpoint. | **§5D (nuevo — abajo).** 4 confirm-asks no-bloqueantes. |

**Recordatorio de invariante:** el cliente vive 100% en NoonWeb (ADR-010). Todo lo de abajo es NoonWeb→App server-to-server (HMAC), reusando `NOON_WEBSITE_WEBHOOK_SECRET`. **Cero env/secreto nuevo de ningún lado.**

---

## 1. `type = rollback` — desplegado, activen su path de rollback

**Estado App:** el receptor `POST /api/integrations/website/client-request` **ya acepta `type=rollback`** en prod (CHECK de 10 valores aplicado). Un `type=rollback` reenviado ahora **materializa** (antes degradaba a `400`).

**Contrato (ya co-firmado 2026-06-20 — recap operativo):**
- `type=rollback` es el 10º valor del enum compartido (snake_case). Declárenlo igual de su lado.
- **`versionRef` es REQUERIDO cuando `type=rollback`** (la versión a la que se quiere revertir); opcional/informativo para los otros 9. Validen client-side (`Number.isInteger && 1..100000`) antes de reenviar; el App lo backstopea con `400 CLIENT_REQUEST_INVALID_PAYLOAD` si falta o es malformado.
- Un `versionRef` bien-formado pero **no-resoluble se acepta+almacena** (dangling-accept) — una carrera de mirroring nunca tira un rollback-request.
- **El request es una SUGERENCIA.** El App **no valida el target ni ejecuta el rollback** al recibir; surface al staff, que **decide y ejecuta** (autoridad de rollback = staff, Fase 2 §20.7). Su filtro UI (ofrecer el botón solo en versiones distintas de la publicada actual) es **buen UX**, pero el App acepta cualquier `versionRef` bien-formado — no esperen un rechazo server-side por target inválido.
- Fluye por las **mismas 5 estados client-visible** que cualquier request (la máquina de estados del App es type-agnostic). El estado vuelve por el outbound §7B como siempre.

**Qué construye NoonWeb (B.4, ya co-firmado):**
- El botón "Solicitar rollback a esta versión" en cada fila del historial → abre el RequestBox precargado (`type=rollback`, `versionRef=sequence`, body editable).
- El selector "Regarding version" opcional en cualquier request (el path de *referencia* — ya era construible desde 0085, no dependía de esto).
- Su migración 025 (`version_ref`) + el log con "Re: versión N".

---

## 2. `client-request-update` — el round-trip de aclaración (NUEVO §5D)

**Estado App:** `POST /api/integrations/website/client-request-update` **live en prod** (migración 0095 aplicada). Maneja **`kind:'clarification'`**; **`kind:'attachment'` se rechaza con `400 CLIENT_REQUEST_UPDATE_KIND_UNSUPPORTED`** (los adjuntos son B.5b — diferidos, bloqueados en el file-hosting de NoonWeb + el sub-shape sin co-firmar).

**Por qué existe:** cuando su equipo (vía el App) mueve un request a *Needs Clarification*, el cliente responde desde el portal. Hoy NoonWeb no tiene a dónde mandar esa respuesta. Este endpoint la recibe, la registra, y **devuelve automáticamente el request a *In Review*** para que el trabajo siga (master-spec §9.4).

### 2.1 Endpoint

`POST /api/integrations/website/client-request-update`

### 2.2 Payload (camelCase — familia v3, HMAC)

```jsonc
{
  "externalRequestId": "<uuid>",        // el request PADRE (el id que NoonWeb minteó en el create, UNIQUE en el App)
  "updateId":          "<string>",      // id ESTABLE por-update minteado por NoonWeb (≠ externalRequestId); reusado verbatim en reintentos. text, 1..255.
  "kind":              "clarification", // único soportado hoy. `attachment` → 400 (B.5b).
  "body":              "<string>",      // REQUERIDO para clarification; trim, 1..4000.
  "at":                "<ISO 8601>"     // reloj del cliente; el App lo guarda como client_sent_at, ordena por su server now().
}
```

- **NO lleva `projectId`** — el App resuelve el proyecto vía el `externalRequestId` del padre.
- **Idempotencia = `(externalRequestId, updateId)`.** Reenvíen con retry/backoff sin miedo: un duplicado devuelve `200 idempotent:true` con el mismo `updateId` (id de la fila App), sin segunda escritura, **sin re-transicionar ni re-notificar**.

### 2.3 Auth / rate-limit

HMAC-SHA256 sobre `${timestamp}.${bodyText}`, headers `x-noon-timestamp` + `x-noon-signature: sha256=<hex>`, ±5 min, secret `NOON_WEBSITE_WEBHOOK_SECRET` (el mismo de siempre — **sin secreto nuevo**). Rate-limit: namespace `website-client-request-update`, 120/min, IP.

### 2.4 Gate

El `externalRequestId` debe resolver a un request existente cuyo proyecto sea `payment_activated`. Si no → **`404` no-reveladora** (mismo body para no-encontrado y no-activado), no escribe nada.

### 2.5 Respuesta de éxito (flat 200 — mismas divergencias que §5B/§5C)

```jsonc
{ "idempotent": false, "updateId": "<id-fila-App>", "requestId": "<id>" }   // primer write → 200
{ "idempotent": true,  "updateId": "<id-fila-App>", "requestId": "<id>" }   // replay       → 200
```

`requestId` correlaciona con logs del App. Lean el flag `idempotent`, no el status (200 para ambos).

### 2.6 Errores

| HTTP | code | Cuándo |
|---|---|---|
| `401` | `WEBSITE_WEBHOOK_AUTH_FAILED` | firma/timestamp inválidos |
| `400` | `CLIENT_REQUEST_UPDATE_INVALID_PAYLOAD` | JSON/schema inválido (kind malo, body faltante en clarification, externalRequestId no-uuid, updateId fuera de 1..255, body fuera de 1..4000, at no-ISO) |
| `400` | `CLIENT_REQUEST_UPDATE_KIND_UNSUPPORTED` | `kind:'attachment'` (B.5b — diferido; terminal, no reintentar) |
| `404` | `CLIENT_REQUEST_UPDATE_PARENT_NOT_FOUND` | request padre no existe O su proyecto no está activado (no-revelador) |
| `429` | (rate limit) | >120/min — namespace `website-client-request-update` |
| `503` | `WEBSITE_WEBHOOK_SECRET_NOT_CONFIGURED` | secret sin configurar (no debería pasar en prod) |
| `500` | `CLIENT_REQUEST_UPDATE_PERSIST_FAILED` | error de DB en gate/insert/replay |

Retry: `2xx` no reintentar; `4xx` terminal no reintentar; `5xx`/red MAY reintentar con backoff (un duplicado da `200 idempotent:true`).

### 2.7 Qué hace el App con la aclaración (no es un agujero negro)

- Registra la respuesta (una fila por update; soporta **múltiples** ciclos de aclaración por request).
- **Si el padre estaba en `needs_clarification`**, lo **devuelve automáticamente a `in_review`** (transición mandada por contrato §9.4) y notifica al equipo asignado. Si el padre estaba en cualquier otro estado: registra + notifica (sin transición).
- **No hay emit §7B nuevo por esto:** `needs_clarification` y `in_review` colapsan al MISMO estado client-visible `in_review` (el portal ya muestra "en revisión") → el `revision` no avanza y el body del outbound sigue siendo los 4 campos congelados. **`body`/`kind`/`updateId` son App-internos — nunca cruzan al cliente vía §7B.**
- La aclaración se muestra read-only al equipo asignado en el dev-board del App.

**Implicación para NoonWeb:** tras postear una aclaración exitosa, el estado client-visible que ya tienen (`in_review`) **no cambia** — es correcto (el cliente ya veía "en revisión" durante Needs Clarification). No esperen un nuevo §7B por la aclaración.

### 2.8 Qué construye NoonWeb (B.5a de su lado)

- La UI de "responder aclaración" en el portal cuando un request está en el estado que ustedes mapeen a *Needs Clarification* (recuerden: su proyección client-visible colapsa `needs_clarification`→`in_review`; si quieren un sub-indicador "se requiere tu respuesta", eso es decisión de su mapping — el App no expone `needs_clarification` crudo por §7B).
- El outbox que postea `{ externalRequestId, updateId, kind:'clarification', body, at }` a `client-request-update`, con la misma maquinaria de retry/dedup que ya usan para el comment-outbox / el request-outbox.
- `updateId` = un id estable de su fila de outbox (reusado en reintentos).

### 2.9 Confirm-asks (no bloquean; el App ya eligió defaults seguros)

- **OQ-1 — `updateId`:** el App valida `text` 1..255 (no exige UUID). Si ustedes mintean UUIDs, no hay cambio. Confirmen el tipo a conveniencia.
- **OQ-2 — sin `projectId` en el wire:** el App resuelve vía el padre. Si prefieren mandar `projectId` como cross-check defensivo (precedente `prototype-decision`), el App lo puede aceptar+cross-validar después; no es requerido.
- **OQ-4 — nombre del campo de respuesta `updateId`** (id de la fila App, análogo a `clientRequestId`/`commentId`): confirmen a conveniencia; el comportamiento se basa en `idempotent`.
- **OQ-8 (solo B.5b/adjuntos):** cuando tengan file-hosting, co-firmamos el sub-shape de la referencia de adjunto (`{ id }`? `{ id, filename, mime, size }`? URL de fetch?) + la fecha de disponibilidad. Hasta entonces `kind:'attachment'` → 400.

---

## 3. Orden de despliegue + smoke bilateral

1. **App: hecho** — `type=rollback` (0094) + `client-request-update` (0095) aplicados + en prod.
2. **NoonWeb (en paralelo):**
   - Activar el path de rollback (B.4) contra §5C + la co-firma.
   - Cablear el outbox de aclaración (B.5a) contra §5D.
3. **Smoke bilateral** (como §9/Fase 2, con un workspace mapeado a un proyecto `payment_activated`):
   - **Rollback:** enviar un client-request `type=rollback` + `versionRef` → confirmar que el App lo materializa, el staff lo ve, y el estado vuelve por §7B.
   - **Aclaración:** con un request que el staff (App) movió a Needs Clarification → postear una respuesta a `client-request-update` → confirmar `200`, que el App lo registra, lo devuelve a In Review, y el equipo asignado lo ve (el estado client-visible se mantiene en `in_review`, esperado).
   - Negativos: `type=rollback` sin `versionRef` → 400; `kind:'attachment'` → 400; firma mala → 401; padre inexistente → 404; replay → `200 idempotent:true`.

---

## 4. Referencias

- Contrato del wire (App): `App-nooncode/docs/integrations/cross-repo-webhook-v1.md` §5C (request) · **§5D (client-request-update)** · §7B (outbound de estado).
- Rollback: co-firma `docs/handoffs/2026-06-20-app-to-noonweb-v3-b4-version-linking-cosign-response.md`; ADR-041; spec `specs/v3-client-requests-b4-rollback-type.md`.
- Aclaración: ADR-042; spec `specs/v3-client-requests-b5-clarification.md`.
- §9 base (frozen): `docs/handoffs/2026-06-16-app-to-noonweb-client-requests-cosign-response.md`.
