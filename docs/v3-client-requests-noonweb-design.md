# NoonWeb — Diseño de §9 (client-requests), lado web

**Fecha:** 2026-06-17
**Estado:** diseño contra contrato **CONGELADO**. Pendiente de confirmación antes de implementar Slice A.
**Funda:** los tres handoffs del co-diseño §9 (en este mismo commit-base):
`docs/handoff-app-2026-06-15-client-requests-codesign.md` (apertura del App) ·
`docs/handoff-2026-06-16-client-requests-codesign-noonweb-response.md` (co-firma NoonWeb) ·
`docs/handoff-app-2026-06-16-client-requests-cosign-response.md` (freeze del App).
**Plan padre:** `docs/v3-client-portal-plan.md`. **Mirror de contratos cross-repo:** `docs/cross-repo-v3-contracts-app-mirror.md`.

> Este doc describe **solo el lado NoonWeb** del sistema §9. El estado operativo (dev board, los 8 estados, clasificación, escalación, scope-eval) vive en el App y no se modela acá.

---

## 0. TL;DR

1. NoonWeb posee `{ id, contenido enviado, último estado client-visible recibido }`; el App posee el **estado operativo** y **computa** la proyección client-visible que nos empuja. Es el ownership congelado de Q-1.
2. Tabla local **NUEVA** `client_request` (no se extiende `client_comment` de 1b — coexisten hasta el fold de B.6).
3. Dos mitades, dos slices: **A = write path** (submission → outbox → forward al App), **B = read-back** (receptor del estado client-visible + display).
4. **Cero env/secreto nuevo** del lado NoonWeb: reusa `NOON_APP_BASE_URL` + `NOON_WEBSITE_WEBHOOK_SECRET` + la maquinaria HMAC/retry existente.
5. `submittedBy` se **deriva** como id opaco (los devs NO tienen un id de usuario estable hoy — el auth JWT solo lleva el email).

---

## 1. Contrato congelado (recap de lo que cruza el wire)

Envelope HMAC compartido (`x-noon-timestamp` + `x-noon-signature`, ±5 min), **camelCase** (familia v3), `projectId == projects.id == client_workspace.noon_app_project_id`.

**Inbound — NoonWeb → App (B.1, los devs EMITEN):**
```
POST {NOON_APP_BASE_URL}/api/integrations/website/client-request
  { externalRequestId, projectId, submittedBy, type, clientPriority, body, at }
  // versionRef OMITIDO en B.1 (diferido a B.4) · attachments OMITIDO (diferido a B.5)
→ idempotente por externalRequestId
```

**Outbound — App → NoonWeb (B.2, los devs RECIBEN):**
```
POST /api/integrations/noon-app/client-request-state
  { externalRequestId, clientVisibleState, revision, at }
→ client-safe ONLY · idempotente + monótono por (externalRequestId, revision)
```

**Vocabularios congelados:**
- `type` (9, snake_case): `material · comment · bug · adjustment · support · improvement · feature · scope_change · incident`.
- `clientPriority` (5): `critical · high · normal · low · backlog`.
- `clientVisibleState` (5): `received · in_review · in_progress · completed · under_internal_review`.
- `body`: trim, `1..4000`.

---

## 2. Modelo de datos: tabla NUEVA `client_request`

Espeja las convenciones de la migración `20260615_023_client_comment_outbox.sql`: TEXT PK + FK a `client_workspace`, `TIMESTAMPTZ`, RLS deny-by-default + grant a `service_role`, self-register en `schema_migrations`, additive y reversible (`DROP TABLE`).

```sql
CREATE TABLE IF NOT EXISTS client_request (
  id                    TEXT PRIMARY KEY,          -- = externalRequestId minado por NoonWeb, reusado en reintentos
  client_workspace_id   TEXT NOT NULL REFERENCES client_workspace(id) ON DELETE CASCADE,

  -- CONTENIDO (NoonWeb-owned, inmutable tras el create):
  type                  TEXT NOT NULL,
  client_priority       TEXT NOT NULL,
  body                  TEXT NOT NULL,
  submitted_by          TEXT NOT NULL,             -- id opaco del usuario (ver §5)

  -- OUTBOX del create (forward a /client-request del App):
  external_request_id   TEXT NOT NULL,             -- == id; clave de idempotencia del App
  forwarded_at          TIMESTAMPTZ,               -- NULL = dead-letter auto-auditado

  -- PROYECCIÓN client-visible (App-owned; la escribe SOLO el receptor outbound, §4):
  client_visible_state  TEXT,                      -- NULL hasta el 1er push del App
  state_revision        INTEGER NOT NULL DEFAULT 0,-- guard de monotonía; 0 = sin push aún
  state_updated_at      TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL,

  CONSTRAINT client_request_external_id_key UNIQUE (external_request_id),
  CONSTRAINT client_request_body_len_check  CHECK (char_length(body) BETWEEN 1 AND 4000),
  CONSTRAINT client_request_type_check      CHECK (type IN (
    'material','comment','bug','adjustment','support','improvement','feature','scope_change','incident')),
  CONSTRAINT client_request_priority_check  CHECK (client_priority IN (
    'critical','high','normal','low','backlog')),
  CONSTRAINT client_request_state_check     CHECK (client_visible_state IS NULL OR client_visible_state IN (
    'received','in_review','in_progress','completed','under_internal_review'))
);

CREATE INDEX IF NOT EXISTS idx_client_request_workspace
  ON client_request (client_workspace_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_client_request_unforwarded
  ON client_request (created_at) WHERE forwarded_at IS NULL;
```

**La partición de columnas ES el ownership de Q-1.** Los devs escriben el bloque "contenido" una vez en el create y nunca más; el bloque "proyección" lo escribe **solo** el receptor outbound (§4). Por eso `client_visible_state` arranca **NULL** y no `'received'`: la UI mapea NULL → copy "Received" como *display default* (mismo criterio que el fallback de Slice 1a a `workspace_status`), sin que NoonWeb "escriba" ni "derive" un estado que es del App.

**Por qué tabla nueva y no extender `client_comment`:** Q-7 fijó coexistir → backfill `type=comment` → retirar el receptor plano en B.6. `client_comment` (1b) sigue siendo la fuente del log de comentarios hasta ese fold; `client_request` es la entidad de §9.

---

## 3. Slice A — write path (fundacional)

Molde **idéntico** a `app/[locale]/maxwell/workspace/[sessionId]/_actions/submit-comment.ts` (1b):

1. **Migración** `024_client_request` (§2).
2. **Repos** en `lib/maxwell/repositories.ts`: `createClientRequest` / `markClientRequestForwarded` / `getClientRequestsByWorkspace`.
3. **Enums + payload builder** en `lib/maxwell/client-requests.ts` (const + Zod de los 3 vocabularios) y `buildClientRequestPayload(...)` en `lib/noon-app-integration.ts`.
4. **Server action** `_actions/submit-request.ts`: `auth()` → re-derivar viewer → `viewerOwnsStudioSession` → validar `type`/`clientPriority`/`body 1..4000` local (cliente recibe error limpio, no un 400 del App) → rate-limit per-client → **persist** (la fila es la fuente de verdad) → **forward best-effort** vía `postNoonAppWebhook("/api/integrations/website/client-request", ...)` (degrada a dead-letter sin romper la acción) → `revalidatePath`.
5. **UI tipada** en el workspace autenticado: selector `type` + `clientPriority` + textarea `body`, gateada por auth + `payment_activated` (Q-10).

**Buildable + unit-testeable ya.** El forward en vivo degrada (dead-letter, `forwarded_at IS NULL`) hasta que el App despliegue su receptor B.1; el smoke bilateral en vivo se hace cuando ese endpoint esté en prod.

---

## 4. Slice B — read-back + display

1. **Receptor** `app/api/integrations/noon-app/client-request-state/route.ts` — patrón de `proposal-review-decision/route.ts`: `runtime="nodejs"`, `dynamic="force-dynamic"`, `readSignedNoonAppJson(request, schema)` (HMAC verify) + **Zod allowlist camelCase** + `assertNoInternalFields` sobre el body crudo (tripwire §8.3) + **guard de monotonía**: aplicar solo si `revision > state_revision`; si no, no-op idempotente (200). 404 no-revelador si el `externalRequestId` no existe.
   > Ojo: este receptor es **camelCase** (familia v3), a diferencia de sus hermanos snake_case (`proposal-review-decision`, `ai-mvp-milestone`).
2. **Repo** `applyClientRequestState(externalRequestId, { clientVisibleState, revision, at })` con el guard de monotonía a nivel SQL (`WHERE state_revision < $revision`).
3. **Mapping 5→copy** (la copy vive en el portal, igual que el `status` de 1a) + display de la lista de requests del cliente en el workspace.

**Receptor 100% unit-testeable contra stubs firmados ya** (es nuestro). El smoke en vivo necesita el emisor B.2 del App. El App solo necesita `NOON_WEBSITE_CLIENT_REQUEST_STATE_URL` apuntando a esta ruta (env App-side, no nuestra).

---

## 5. Decisión: `submittedBy` = id opaco derivado (HMAC)

**Hallazgo:** el auth de NoonWeb es JWT + Google y el token/session **solo lleva `email` / `name` / `picture`** (`auth.ts`) — no hay `user.id`, no se propaga el `sub` de Google, no hay tabla de usuarios. El único identificador estable del cliente hoy es el email. El contrato fijó `submittedBy` = **id opaco, NO el email** (minimización: el App no duplica el email del cliente en su store de requests).

**Decisión:** los devs derivan el id opaco como **`HMAC-SHA256(email_normalizado, NOON_WEBSITE_WEBHOOK_SECRET)`** (hex). Propiedades:
- **Estable:** mismo email → mismo id, siempre (idempotencia del request por usuario en cuenta compartida).
- **Opaco / no reversible:** los emails son low-entropy; el pepper (el secreto compartido) evita el ataque de diccionario que tendría un `sha256(email)` pelado.
- **Sin tocar auth ni tabla nueva.** El App lo guarda tal cual; si el staff necesita la identidad humana, la resuelve por el linkage proyecto→cliente que el App ya tiene del pago.

Helper en `lib/maxwell/client-requests.ts` (`deriveSubmitterId(email)`), reusando el patrón HMAC ya presente en `lib/noon-app-integration.ts`.

---

## 6. Secuencia y dependencias

1. **Este spec** → confirmación.
2. **Slice A** (write path) en su branch/PR. Buildable ya; live smoke diferido.
3. **Slice B** (receptor + display) en su branch/PR. Receptor testeable contra stubs ya.
4. **Smoke bilateral en vivo** cuando el App despliegue su B.1 (create) y su B.2 (state push). *El App pausó su B.1 Architecture a una sesión posterior (nota del operador en el freeze) — no bloquea construir nuestro lado.*

**Fuera de scope (diferido por contrato):** adjuntos (Q-5 → B.5), version-linking `versionRef` (B.4), scope-eval §10 (Q-8 → B.3), retiro del receptor plano de comentarios + backfill (Q-7 → B.6).

---

## 7. Gates y disciplina

Cada slice de código pasa las 4 gates (eslint + `tsc --noEmit` + vitest + `next build`) antes de PR. Una branch = un slice = un PR; los PR quedan abiertos para review del partner. Las migraciones se aplican a la DB de Web solo tras review (el operador corre las escrituras a prod).
