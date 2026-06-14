# Handoff — NoonWeb v3 Client Portal (cross-repo build spec)

**Fecha:** 2026-06-14
**Para:** quien trabaje el repo **NoonWeb** (`noon-web-main`) — dev o sesión de agente.
**De:** App-nooncode (donde vive el master-spec v3 + la data del proyecto).
**Objetivo:** construir el **client portal v3** en NoonWeb para poder retirar el portal interino `/client/[token]` del App (deuda ADR-010 / D1).

> Este doc es auto-contenido: trae las refs del spec, el estado actual de ambos repos, el alcance a construir, y el contrato cross-repo. No necesitas leer el repo del App para empezar.

---

## 0. TL;DR

- **El client portal es una superficie de NoonWeb**, no del App. Es regla dura del spec (no inferencia): `master-spec-v3.md` §8.1.
- NoonWeb **ya tiene el embrión** (`/maxwell/workspace/[sessionId]`: auth Google + ingesta de milestones). Falta crecerlo al alcance §8.2 + §9.
- El **App es dueño de la verdad del proyecto** y la **emite sanitizada**; NoonWeb la muestra. Los **requests del cliente (§9)** se capturan en NoonWeb y se rutean al developer board del App.
- Cuando NoonWeb shipee el portal §8.2/§9, el App **retira** `/client/[token]` + `/api/client/*` + `client_access_tokens`/`client_comments`.

---

## 1. Fuente de verdad (corpus v3)

| Doc | Secciones relevantes |
|---|---|
| `App-nooncode/docs/product/master-spec-v3.md` | §2 (separación), §6 (auth antes de pagar), §7 (activación), **§8 (client portal/workspace)**, **§9 (client requests)** |
| `App-nooncode/docs/product/master-spec-v3-flows.md` | §6 (portal & versioning flow), §7 (client request flow) |
| `noon-web-main/docs/cross-repo-v3-contracts-app-mirror.md` | vocabulario project-types + `sanitizeForClient`/`INTERNAL_ONLY_FIELDS` |

**La regla que ancla todo (§8.1, textual):** *"The client workspace lives inside the website/client portal, not inside internal NoonApp."* §3.2 lo vuelve una separación que no se puede romper.

---

## 2. Asignación de responsabilidades (hard rule)

| | NoonWeb (website / client portal) | NoonApp (interno) |
|---|---|---|
| Dueño de | client account, auth, vista **client-facing** del proyecto, requests del cliente | el proyecto interno, developer board, ejecución, versiones, wallet, **data compartida** |
| Spec | §2.1, §8.1 | §2.2, §2.3 |
| Conexión | **shared backend/project data** — App emite, NoonWeb consume (§2.3) | |

El cliente **nunca** entra al NoonApp interno (§2.1).

---

## 3. Estado actual — punto de partida (NO reconstruir)

### NoonWeb ya tiene (~40%)
- `app/[locale]/maxwell/workspace/[sessionId]` — **superficie post-pago autenticada** (Google/NextAuth, gateada por `studio_session.owner_email`).
- Ingesta del webhook **`ai-mvp-milestone`** del App → tabla `ai_mvp_milestone` (`started`/`version-ready`/`escalated` + `version_url`).
- Vínculo al proyecto del App: `client_workspace.noon_app_project_id` (write-once, seteado al confirmar pago).
- Timeline `workspace_update` (updates creados por staff) + materiales.
- Flujo pre-pago cliente: `/maxwell/proposal/[token]` y `/maxwell/prototipo/[token]` (token de capacidad, anónimo).

### El App ya provee
- Verdad del proyecto: `projects` (status, payment_activated), `lead_proposals` (título, monto, payment_status), `project_versions`.
- Wires salientes **ya vivos**: `ai-mvp-milestone` (emite `version-ready` + `mvp_demo_url`) y `proposal-review-decision`. Ledger con retry + HMAC (`outbound_webhook_events`).
- Patrón **signed-read** ya probado: `GET /api/integrations/website/prototype-signed-read/[token]` (HMAC + timestamp, ±5min) — plantilla para un futuro `project-status` signed-read.
- Contrato de sanitización: `sanitizeForClient` / `INTERNAL_ONLY_FIELDS` (ambos lados).

---

## 4. Qué tiene que construir NoonWeb (el gap)

### 4.1 Superficie + acceso
- **Opción A (recomendada):** extender `/maxwell/workspace/[sessionId]` para que sea el portal completo, y que el link compartido apunte ahí.
- **Opción B:** ruta nueva `/portal/[projectId]` (o `/portal/[token]`).
- **Acceso (§6):** el cliente tiene **client account** + auth (Google / Email Magic Link). NoonWeb ya tiene Google. Decisión de diseño: ¿se mantiene auth de cuenta, o se acepta un **token firmado por el App** para acceso sin login? (ver §6 de decisiones abiertas).

### 4.2 Debe mostrar (§8.2) — mapeado a la fuente de datos del App

| Campo del portal (§8.2) | Fuente (App) | Cómo llega a NoonWeb |
|---|---|---|
| project summary / nombre | `projects.name` | webhook push o signed-read |
| current visible status | `projects.status` (`backlog/in_progress/review/delivered/completed`) | **NUEVO** wire de status |
| approved proposal | `lead_proposals` (título, monto) | ya disponible / signed-read |
| first AI-MVP preview | `project_versions.mvp_demo_url` | **ya llega** vía `ai-mvp-milestone` `version-ready` |
| public link si publicado | flujo Publish (§6) | **NUEVO** (estado de publish) |
| versions + history | `project_versions` | **NUEVO** wire de versiones |
| client requests + statuses | sistema §9 | **NUEVO** (NoonWeb captura) |
| materials/files | upload del cliente | **NUEVO** en NoonWeb |
| latest updates | updates del proyecto (App) | push/signed-read |
| comments / communication | `client_comments` (App) ↔ NoonWeb | **NUEVO** bidireccional |
| payment/membership | `payments` / `lead_proposals.payment_status` | push/signed-read |

### 4.3 NO debe exponer (§8.3) — guardarraíl
Nunca mostrar: comp del seller, earnings del dev, margen de Noon, notas internas/escalación/riesgo, data privada de PM/Admin. **Mecanismo:** todo payload App→cliente pasa por `sanitizeForClient` y `assertNoInternalFields` (campos en `INTERNAL_ONLY_FIELDS` se eliminan antes de cruzar el boundary). Ambos repos mantienen su propio denylist; coordinar adiciones.

### 4.4 Versionado / Publish (§6 flows)
- Mostrar versiones (`project_versions`), historial, preview por versión.
- Acción **Publish** / **Update Published Version** para proyectos web/web-app.
- Distinción §11.1: `Private Preview` ≠ `Published` ≠ `Delivered`.
- Rollback (autorizado por dev o PM/Admin).

### 4.5 Sistema de client requests (§9) — el sucesor de los "comentarios"
- **Estados:** Received, In Review, Needs Clarification, Queued, In Progress, Completed, Out of Scope, Escalated (este último mostrable como "Under internal review").
- **Tipos:** Material/file, Comment/clarification, Bug, Minor adjustment, Support, Monthly improvement, New feature, Scope change, Urgent/critical.
- **Prioridad:** Critical/High/Normal/Low/Backlog (el cliente sugiere; Noon define la real).
- **Ruteo (§9.2):** request → **developer/team asignado** (directo, no por PM por default) → clasificación → ejecución o escalación. PM/Admin intervienen en los casos §9.3.
- Regla §9.1: todos los requests entran; la ejecución depende de scope/membership/prioridad/capacidad.

### 4.6 Comentarios bidireccionales
Tabla nueva en NoonWeb + reenvío al App (para que el equipo de delivery los vea en su board). Es la pieza más nueva junto al §9.

---

## 5. Contrato cross-repo — qué agrega el App (lo hace el lado App)

Estas son adiciones del lado App, sin cambios de schema (las tablas ya existen). Las puede tomar una sesión en App-nooncode:

1. **Feed de estado/versiones del proyecto** — una de:
   - **(A) push:** nuevo endpoint `project-status` en el ledger saliente (mismo HMAC + retry), disparado al cambiar status/versión/update.
   - **(B) pull:** `GET /api/integrations/website/project-status/[token]` espejando `prototype-signed-read` (HMAC+timestamp, cache 30s).
2. **Receptor de requests (§9)** — `POST /api/integrations/website/client-request` (HMAC) que inserta el request en el developer board del App con su tipo/estado.
3. **Receptor de comentarios** — inbound de comentarios del cliente → `client_comments` (o su sucesor) para que delivery los siga viendo.
4. **Sanitización** — `sanitizeForClient` aplicado a todo payload saliente client-facing (ya existe el helper).

> Sketch de payload (status): `{ event: "project_status", project_id, name, status, payment_status, latest_update, versions: [{id, label, preview_url, published}], published_url|null, at }` — todos pasados por `sanitizeForClient`.

---

## 6. Decisiones de diseño abiertas (las define NoonWeb)

1. **Modelo de acceso:** ¿client account (Google/Magic Link, §6) o token firmado por App? El spec pide client account; el más simple para v1 podría ser reusar el token + auth existente.
2. **Push vs pull** para el estado del proyecto (push = realtime, pull = signed-read on-demand). El App soporta ambos; NoonWeb elige.
3. **Data model de §9** (requests) en NoonWeb: tabla(s) de requests + estados + tipos.
4. **Mapeo §8.2 "latest updates":** hoy el App lo guarda en el token row; en v3 debería venir de updates del proyecto. Definir el wire.

---

## 7. Fases sugeridas (para shipear incremental)

- **Fase 1 — Portal MVP (paridad + en NoonWeb):** status + propuesta + AI-MVP preview + comentarios, dentro del workspace autenticado. Con esto **ya se puede retirar `/client/[token]`** del App (paridad funcional alcanzada en el lado correcto).
- **Fase 2 — Versionado/Publish (§6):** versiones, historial, Publish/Update, rollback.
- **Fase 3 — Request system completo (§9):** requests tipificados con estados/prioridad ruteados al dev board.

---

## 8. Retiro en el App (D1) — gated en Fase 1+

Cuando NoonWeb tenga al menos la Fase 1 en prod, el App retira (iteración de cleanup con su propio análisis/testing):
- `app/client/[token]/page.tsx`
- `app/api/client/route.ts`, `app/api/client/resolve/route.ts`, `app/api/client/comments/route.ts`
- RPCs `resolve_client_token` / `revoke_client_token` / `rotate_client_token` / `touch_client_token`
- Tablas `client_access_tokens` / `client_comments` (evaluar retención antes de drop)
- Cron `cleanup-revoked-tokens`
- UI de generación del link en `app/dashboard/projects/page.tsx`

---

## 9. Criterio de "hecho" (Fase 1)

- [ ] El cliente ve su proyecto (status + propuesta + AI-MVP preview + comentarios) en una URL de **NoonWeb**, autenticado.
- [ ] Ningún campo §8.3 cruza el boundary (verificado por `assertNoInternalFields`).
- [ ] Los comentarios del cliente llegan al developer board / delivery del App.
- [ ] El link compartido al cliente apunta a NoonWeb, no al App.
- [ ] El App deja de generar links `/client/[token]` (o se marca deprecated) y se agenda el retiro D1.

---

## 10. Referencias rápidas

- Spec portal: `master-spec-v3.md` §8 / §9; flows §6 / §7.
- Boundary: `master-spec-v3.md` §2; ADR-010 (App).
- Contrato cross-repo: `noon-web-main/docs/cross-repo-v3-contracts-app-mirror.md`.
- Patrón signed-read existente: `App/app/api/integrations/website/prototype-signed-read/[token]/route.ts`.
- Ledger saliente + HMAC: `App/lib/server/website-integration.ts`, `master spec` de wires en `App/docs/integrations/cross-repo-webhook-v1.md`.
