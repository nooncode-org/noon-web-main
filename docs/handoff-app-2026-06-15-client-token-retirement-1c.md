# Handoff App ↔ NoonWeb — Retiro de `/client/[token]` (v3 Client Portal, Slice 1c)

**Fecha:** 2026-06-15
**Repos:** `noon-web-main` (NoonWeb) ↔ `App-nooncode` (NoonApp interno).
**Origen:** `docs/v3-client-portal-plan.md` §4 (Slice 1c) y §5 (criterio de "hecho" Fase 1).
**Estado:** propuesta de coordinación, pendiente de co-firma del lado App.

Slice 1c cierra Fase 1 del client portal: retirar el portal interino
`/client/[token]` del App (deuda ADR-010 / D1) ahora que el cliente ve
**status + propuesta + AI-MVP preview + comentarios** en una URL autenticada de
NoonWeb.

---

## 1. Estado verificado (qué ya está hecho)

| Pieza | Estado |
|---|---|
| Slice 1a — consumidor de `project-status` | **MERGED a `main`** (PR #67), en prod NoonWeb |
| Slice 1b — outbox + write-back de comentarios | **PR #68** abierto (en review); migración `023` aplicada+verificada en la DB de Web |
| Smoke bilateral en vivo (1a + 1b) | **✅ ALL PASS (2026-06-15)** contra `https://nooncode-app-pi.vercel.app`, projectId `b5df21a8-b2bf-422b-831b-ac4170bed411` (payment_activated). 1a: `200`, status `backlog`, propuesta 79 USD, `latestUpdate` no-null, **sin fugas §8.3**. 1b: `idempotent:false` + commentId; replay `idempotent:true` con **mismo commentId** (persistió en `project_client_messages`). |
| Link compartido apunta a NoonWeb | **Ya se cumple** (ver §3) |

---

## 2. Lado NoonWeb — sin código pendiente para 1c (verificado)

- El único link que NoonWeb comparte con el cliente es su propio workspace:
  `buildWorkspaceUrl()` → `/{locale}/maxwell/workspace/{sessionId}`
  (`lib/maxwell/public-url.ts`), usado en el email "Workspace ready" (B8 #3).
- Búsqueda en el repo: **NoonWeb no genera ningún link a `/client/[token]`** del
  App. Las únicas apariciones de `/client/` son la ruta del webhook receptor
  `/api/integrations/website/client-comment` y comentarios.
- Por tanto el criterio §5 "el link compartido apunta a NoonWeb, no al App"
  **ya está satisfecho**. 1c en el lado NoonWeb es coordinación, no código.

---

## 3. Lado App — acciones propuestas (los devs del App)

1. **Dejar de generar `/client/[token]` nuevos.** El canal de entrega del link
   al cliente pasa a ser NoonWeb (ver §4).
2. **Deprecar la ruta `/client/[token]` existente.** Dos opciones:
   - **A (preferida si es viable):** redirect (302) a la URL del workspace de
     NoonWeb. Requiere que el App pueda resolver la URL del workspace — ver la
     pregunta abierta en §4.
   - **B (fallback):** página "este enlace se mudó" con CTA / instrucción de
     revisar el email de Noon. Cero dependencia de datos cruzados.
3. **Agendar el retiro D1** (hard-remove de la ruta + limpieza de las tablas
   interinas `client_access_tokens` / `client_comments`) **solo después** de
   confirmar el nuevo canal en prod y una ventana de observación (§5).

> Nota: el receptor nuevo `project_client_messages` (migración App `0076`) y el
> `project-status` signed-read ya conviven con el portal interino — el retiro no
> rompe nada nuevo, solo elimina el camino viejo.

---

## 4. Pregunta abierta de coordinación — ¿cómo recibe el cliente el link?

Hoy, en el flujo nuevo, **NoonWeb entrega la URL del workspace en su email
"Workspace ready"** (B8 #3), disparado al confirmarse el pago.

- Ese email está **gateado por `MAXWELL_LIFECYCLE_EMAILS=1`** en NoonWeb
  (`lib/maxwell/lifecycle-emails.ts`, `isLifecycleEmailsEnabled()`). Si el flag
  está OFF en prod, el email **no se envía** y el cliente no recibe el link.
- La URL del workspace se construye con el **`sessionId` de NoonWeb**
  (`/{locale}/maxwell/workspace/{sessionId}`), **no** con el `projectId` del App.
  El App no tiene hoy ese `sessionId`, así que **no puede construir la URL por su
  cuenta** sin que NoonWeb se lo pase.

**Recomendación:** que NoonWeb sea el canal (opción 4-A abajo). Entonces el App
no necesita el `sessionId` ni construir links — solo deja de emitir los suyos.

| Opción | Quién entrega el link | Requisito |
|---|---|---|
| **4-A (preferida)** | NoonWeb, vía su email "Workspace ready" | `MAXWELL_LIFECYCLE_EMAILS=1` en prod NoonWeb |
| 4-B | El App sigue entregando el link, pero apuntando al workspace de NoonWeb | NoonWeb debe pasarle el `sessionId` (no existe wire hoy → trabajo extra) |

---

## 5. Precondiciones antes de cortar `/client/[token]` (gating)

- [x] Slice 1a en prod (PR #67 merged).
- [ ] Slice 1b en prod (**PR #68 mergeado**) — pendiente.
- [x] Migración `023` aplicada + verificada en la DB de Web.
- [x] Smoke bilateral 1a + 1b verde (2026-06-15).
- [ ] **Canal de entrega del link confirmado** (§4): `MAXWELL_LIFECYCLE_EMAILS=1`
  en prod NoonWeb, o acuerdo explícito de canal alterno.
- [ ] Ventana de observación con ambos caminos vivos (sugerido: unos días).

> Recordatorio operativo: en la DB de Web hoy hay **0 workspaces con
> `noon_app_project_id`** — todavía no fluyó un proyecto pagado real Web→App por
> esta instancia. Conviene validar el camino del email "Workspace ready" con un
> pago real (o de prueba) antes de cortar el portal interino.

---

## 6. Secuencia propuesta

1. Mergear **PR #68** (1b) → 1a + 1b en prod NoonWeb.
2. Confirmar `MAXWELL_LIFECYCLE_EMAILS=1` en prod NoonWeb (o acordar canal §4-B).
3. Validar el camino completo con un pago real/de prueba (status + comentarios +
   recepción del link por email).
4. App: deja de generar `/client/[token]`; aplica redirect/deprecación (§3.2).
5. Ventana de observación (ambos caminos vivos).
6. **D1:** App hard-remove de la ruta + limpieza de tablas interinas.

---

## 7. Evidencia / referencias

- Smoke bilateral 2026-06-15: ver §1 (1a `200` sanitizado + 1b idempotente).
  Quedó un comentario marcado `[smoke]` en `project_client_messages` del App
  (`commentId 982bc302-6992-4d8f-8201-5507921eea71`) — inofensivo, se puede
  ignorar/borrar.
- Plan maestro: `docs/v3-client-portal-plan.md` (§4 slices, §5 criterio, §6 secuencia).
- Contratos congelados: `docs/cross-repo-v3-contracts-app-mirror.md`,
  `docs/2026-06-14-app-comment-receiver-contract.md`.
- Observación menor (no bloquea): el `cache-control` observado del
  `project-status` fue `private, max-age=30` (sin el `stale-while-revalidate=60`
  del código productor del App) — cosmético, el consumidor NoonWeb no lo usa;
  posible build del App algo anterior o normalización de CDN.

---

## 8. Co-firma

- **NoonWeb (los devs):** lado Web verificado sin código pendiente para 1c; el
  link ya apunta al workspace. A la espera de que el App confirme §3–§6.
  _Co-firmado: ____________ (fecha ____)_
- **App (los devs):** confirma opción de entrega del link (§4), plan de
  deprecación de la ruta (§3.2) y fecha tentativa de retiro D1.
  _Co-firmado: ____________ (fecha ____)_
