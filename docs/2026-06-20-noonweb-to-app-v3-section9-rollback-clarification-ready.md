# Handoff — NoonWeb → App: B.4 `rollback` + B.5a `clarification` están BUILT + LIVE — listos para el smoke bilateral

**Fecha:** 2026-06-20
**Para:** equipo **App-nooncode**.
**De:** NoonWeb (`noon-web-main`).
**En respuesta a:** `App-nooncode/docs/handoffs/2026-06-20-app-to-noonweb-v3-section9-rollback-and-clarification-ready.md` (copia en `noon-web-main/docs/2026-06-20-app-to-noonweb-v3-section9-rollback-and-clarification-ready.md`).
**Estado:** ambas piezas del lado NoonWeb **CONSTRUIDAS, mergeadas a `main` y DESPLEGADAS en prod.** Cero cambios de contrato; cero env/secreto nuevo. Este doc responde los 4 confirm-asks (§2.9 del App) y lista lo que el App debe preparar para el smoke bilateral.

---

## 0. TL;DR

- **B.4 rollback — ACTIVADO.** El botón "Solicitar rollback a esta versión" (en filas de versión no-live) emite un client-request `type=rollback` + `versionRef`. Migraciones **025** (`version_ref`) + **026** (CHECK con el 10º valor `rollback`) aplicadas+verificadas en la Web prod DB; gate `ROLLBACK_REQUEST_ENABLED=true`.
- **B.5a clarification — CABLEADO.** La respuesta del cliente a un request se postea a `POST /api/integrations/website/client-request-update` (§5D). Migración **027** (outbox `client_request_update`) aplicada+verificada.
- Todo contra el contrato co-firmado; sin cambios de shape. 4 gates verdes; deploy de prod ✅. El path de *referencia* (`versionRef` en cualquier type) ya estaba live desde B.4.

---

## 1. Lo que NoonWeb produce en el wire (para que el App lo verifique)

### 1.1 client-request `rollback` (§5C)

```
{ externalRequestId, projectId, submittedBy, type: "rollback", clientPriority, body, versionRef, at }
```

- `versionRef` **REQUERIDO** cuando `type=rollback`; validado client-side (`Number.isInteger && 1..100000`) **antes** de reenviar (los devs no reenvían un rollback malformado). Opcional/informativo en los otros 9 types (omitido del wire cuando es null).
- Es **suggest-not-force**: los devs entienden que el App **no** valida el target ni ejecuta al recibir (dangling-accept), y **no** esperan un rechazo server-side por target inválido. El filtro UI (botón solo en versiones no-live) es convención de presentación.

### 1.2 client-request-update `clarification` (§5D)

```
{ externalRequestId, updateId, kind: "clarification", body, at }
```

- **SIN `projectId`** (el App resuelve por el `externalRequestId` del padre).
- `updateId` = **UUID estable** minteado por NoonWeb (== el id de la fila de outbox), reusado verbatim en reintentos → el App de-dupea por `(externalRequestId, updateId)`.
- `body` trim 1..4000. NoonWeb lee el flag `idempotent` de la respuesta, no el status (200 en ambos).
- Persist-then-forward: la fila local es el registro durable + el dead-letter (`forwarded_at IS NULL`).

---

## 2. Respuesta a los confirm-asks (§2.9)

- **OQ-1 — `updateId`:** NoonWeb mintea **UUID v4** (== id de su fila de outbox). Cae dentro de `text` 1..255 → **sin cambio del lado App.** ✅
- **OQ-2 — sin `projectId`:** confirmado — NoonWeb **no** manda `projectId` en `client-request-update`; depende de la resolución por el padre. No necesitamos el cross-check defensivo por ahora. ✅
- **OQ-4 — nombre `updateId` en la respuesta:** OK tal cual; NoonWeb decide por el flag `idempotent` y loguea `updateId` para auditoría. ✅
- **OQ-8 — adjuntos (B.5b):** **diferido también del lado NoonWeb** (sin file-hosting aún). NoonWeb solo emite `kind:'clarification'`; co-firmamos el sub-shape de la referencia de adjunto cuando tengamos hosting. Hasta entonces el `400 CLIENT_REQUEST_UPDATE_KIND_UNSUPPORTED` del App es el backstop correcto. ✅

---

## 3. Lo que el App debe preparar para el smoke bilateral (§3)

Con un workspace NoonWeb mapeado a un proyecto `payment_activated` (los devs siembran el workspace mapeado, script throwaway como §9/Fase 2, y corren las acciones desde la UI de prod):

- **Rollback:** un `projects.id` con **≥1 versión client-visible no-live** (state en `ready_for_client_preview | previous_published | rolled_back`) para que la fila de versión muestre el botón. **Pásennos el `projects.id`.** Un `previous_published` hace el rollback más realista.
- **Aclaración:** con un `client_request` existente en ese proyecto, el **staff lo mueve a Needs Clarification**; luego el cliente responde desde el portal.
- Confirmar `NOON_WEBSITE_CLIENT_REQUEST_STATE_URL` seteado (ya desde §9).

---

## 4. Plan de smoke (espejo del §3 del App)

- **Rollback:** enviar `type=rollback` + `versionRef` desde la fila de versión → el App lo materializa, el staff lo ve, el estado vuelve por §7B (mismas 5 estados client-visible).
- **Aclaración:** responder a un request que el staff movió a Needs Clarification → `200`, el App registra + lo devuelve a In Review; el estado client-visible se mantiene `in_review` (esperado — sin nuevo §7B).
- **Negativos:** rollback sin `versionRef` → NoonWeb 400 client-side (no reenvía); `kind:'attachment'` → NoonWeb no lo emite (la UI solo hace clarification), el App 400 es el backstop; firma mala → 401; padre inexistente → 404; replay → `200 idempotent:true`.

---

## 5. Referencias (NoonWeb, ya en `main`)

- Migraciones: `supabase/migrations/20260620_025_client_request_version_ref.sql`, `…_026_client_request_rollback_type.sql`, `…_027_client_request_update.sql`.
- Vocabulario + gate: `lib/maxwell/client-requests.ts` (`rollback` 10º type, `ROLLBACK_REQUEST_ENABLED`, `isValidVersionRef`, `VERSION_REF_MIN/MAX`).
- Wire: `lib/noon-app-integration.ts` (`buildClientRequestPayload` con `versionRef`, `buildClientRequestUpdatePayload`).
- Acciones: `app/[locale]/maxwell/workspace/[sessionId]/_actions/submit-request.ts` (rollback), `…/_actions/submit-request-update.ts` (clarification).
- UI: `…/_components/version-rollback-button.tsx`, `…/_components/request-box.tsx` (afford "Reply").
- Contrato del App: `docs/2026-06-20-app-to-noonweb-v3-section9-rollback-and-clarification-ready.md` (§5C/§5D/§7B).
