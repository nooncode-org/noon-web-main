# Handoff — NoonWeb → App: runbook del smoke bilateral B.4 (rollback) + B.5a (clarification)

**Fecha:** 2026-06-21
**Para:** equipo **App-nooncode**.
**De:** NoonWeb (`noon-web-main`).
**Asunto:** Lo que el App necesita tener listo + el paso a paso para correr el smoke bilateral de **B.4 rollback** y **B.5a clarification**. Ambas piezas están BUILT + LIVE en los dos repos; falta solo correr el smoke (como cerramos §9 y Fase 2).

> Contrato y wires ya documentados en `docs/2026-06-20-noonweb-to-app-v3-section9-rollback-clarification-ready.md` (PR #83, en main). Este doc es el **runbook operativo** — checklist + secuencia + verificación.

---

## 0. TL;DR

- **Una sola sesión de smoke cubre las dos.** El operador siembra **un** workspace NoonWeb mapeado a **un** `projects.id` del App (payment-activated, con versiones), y desde la UI de prod corre rollback **y** clarification.
- **Lo que pedimos al App (§1):** un `projects.id` con ≥1 versión client-visible **no-live** + staff listo para (a) resolver el rollback y empujar estado por §7B, (b) observar la respuesta de aclaración en su board.
- Cero cambios de contrato / env / secreto. NoonWeb corre las escrituras desde la UI; el agente corre las queries read-only de verificación.

---

## 1. Checklist de preparación del App

### Para B.4 (rollback)
- [ ] **Un `projects.id`, payment-activated, con ≥1 versión client-visible NO-live** (state en `ready_for_client_preview | previous_published | rolled_back`). Un `previous_published` hace el rollback más realista. → **Pásennos ese `projects.id`** + cuál `versionSequenceNumber` (sequence) es el target esperado.
- [ ] `NOON_WEBSITE_CLIENT_REQUEST_STATE_URL` seteado (ya desde §9) — para que el estado vuelva por §7B.
- [ ] **Staff listo para resolver** el client-request `type=rollback` (decidir/ejecutar o declinar) y **empujar el estado client-visible de vuelta** vía `POST /api/integrations/noon-app/client-request-state` (§7B).

### Para B.5a (clarification)
- [ ] **El receptor `POST /api/integrations/website/client-request-update` (§5D) LIVE** (ya, ADR-042). De-dup por `(externalRequestId, updateId)`.
- [ ] **Staff listo para observar** que la respuesta del cliente aterriza en su board (y, si quieren el caso realista, mover el request a **Needs Clarification** antes — ver nota §3).

> El mismo workspace mapeado sirve para las dos: el rollback usa una fila de versión; la aclaración usa un `client_request` cualquiera de ese workspace.

---

## 2. Smoke B.4 — rollback (paso a paso)

1. **(Operador NoonWeb)** siembra un workspace mapeado al `projects.id` del App (throwaway, molde §9/Fase 2: `scripts/manual/smoke-b4-rollback.sql`, reemplazando el placeholder por el `projects.id`).
2. **(Operador, en la UI de prod)** abre el workspace → sección **Versions** renderiza el historial (del pull del App) → en una fila **no-live** aparece **"Request rollback to this version"** → click → edita el body si quiere → **Send rollback request**.
3. **(NoonWeb)** reenvía al receptor `client-request` del App: `{ type: "rollback", versionRef, externalRequestId, projectId, submittedBy, clientPriority, body, at }`. `versionRef` validado client-side (`1..100000`) antes de reenviar.
4. **(App)** materializa el request (**dangling-accept**: no valida el target ni ejecuta al recibir); el **staff lo ve** con `type=rollback` + `versionRef`.
5. **(App staff)** resuelve → **empuja el estado client-visible** por §7B → NoonWeb lo aplica (monotónico por `(externalRequestId, revision)`).

**Verificación (read-only, lo corre el agente del lado NoonWeb):**
- Tras enviar: una fila `type='rollback'`, `version_ref` = el sequence elegido, `forwarded_at` SET, `client_visible_state` NULL (aún sin §7B).
- Tras el §7B: `client_visible_state` avanza + `state_revision` incrementa; una reentrega con revision menor = no-op (stale).

**(App side)** verificar: el request aparece con `type=rollback` + `versionRef`, dangling-aceptado.

---

## 3. Smoke B.5a — clarification (paso a paso)

> **Nota de diseño (importante para el smoke):** del lado NoonWeb el botón **"Reply" se ofrece en CUALQUIER request**, no gateado por un estado crudo — porque el App colapsa `needs_clarification → in_review` en §7B y NoonWeb solo ve `in_review`. O sea: el cliente **no necesita** que el App pida aclaración para poder responder; puede responder a cualquier request. Mover el request a Needs Clarification (paso 2) es **opcional**, solo para el caso realista.

1. **(Operador, en la UI de prod)** crea un `client_request` en el workspace mapeado (cualquier type/body) → se reenvía al receptor `client-request` del App.
2. **(App staff, opcional)** mueve ese request a **Needs Clarification** → el estado vuelve por §7B → el cliente lo ve como **In review**.
3. **(Operador, como cliente)** en la tarjeta del request → **"Reply"** → escribe el texto → **Send reply**.
4. **(NoonWeb)** postea `{ externalRequestId, updateId, kind: "clarification", body, at }` al receptor `client-request-update` del App. `updateId` = UUID estable (== fila de outbox), reusado en reintentos.
5. **(App)** de-dupea por `(externalRequestId, updateId)`, registra la réplica, responde **200** (lee `idempotent`, no el status). El request **se mantiene** `in_review` (sin nuevo §7B).

**Verificación:**
- **(NoonWeb, read-only)** la fila de outbox `client_request_update` tiene `forwarded_at` SET; la réplica aparece en la tarjeta ("Your reply · …").
- **(App)** la réplica aterriza en el board del staff; replay del mismo `updateId` → `200 idempotent:true`.

---

## 4. Negativos a chequear (opcional, ya cubiertos por contrato)

- Rollback **sin** `versionRef` → NoonWeb **400 client-side** (no reenvía).
- `kind:'attachment'` → NoonWeb **no lo emite** (la UI solo hace `clarification`); el `400 CLIENT_REQUEST_UPDATE_KIND_UNSUPPORTED` del App es el backstop (B.5b adjuntos se co-firma aparte cuando haya hosting — ya hay infra, ver thread B.5b).
- Firma HMAC inválida → 401 · padre inexistente → 404 · replay → `200 idempotent:true`.

---

## 5. Qué corre cada lado

- **Operador NoonWeb:** siembra el workspace mapeado (script throwaway), corre las acciones desde la UI de prod (rollback + reply). El agente corre las queries read-only de verificación en la Web DB.
- **App:** provee el `projects.id` con versión no-live; staff resuelve el rollback + empuja §7B; staff observa la réplica de aclaración.

**Lo único que bloquea arrancar:** que el App pase el **`projects.id`** (con ≥1 versión client-visible no-live) y confirme que el staff está disponible para los dos pasos de resolución/observación.
