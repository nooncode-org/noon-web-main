# Plan — v3 Client Portal (NoonWeb side)

**Fecha:** 2026-06-14
**Repo:** `noon-web-main` (NoonWeb — website / client portal).
**Origen:** handoff cross-repo `App-nooncode/docs/handoffs/2026-06-14-noonweb-client-portal-v3-handoff.md`.
**Contrato hermano:** `docs/cross-repo-v3-contracts-app-mirror.md` (project-types + `sanitizeForClient`).

Este doc refina ese handoff con: (a) la verificación del estado actual contra el
código real, (b) las decisiones de diseño cerradas, (c) el contrato de payloads
congelado, y (d) el alcance de Fase 1 desglosado en slices que los devs pueden
tomar uno por branch.

> Regla del spec que ancla todo (`master-spec-v3.md` §8.1, textual):
> *"The client workspace lives inside the website/client portal, not inside
> internal NoonApp."* El cliente nunca entra al NoonApp interno (§2.1).

---

## 1. Verificación del estado actual (contrastado, no inferido)

El "~40% ya existe" del handoff §3 se confirma línea por línea:

| Pieza | Dónde vive hoy | Estado |
|---|---|---|
| Workspace post-pago autenticado | `app/[locale]/maxwell/workspace/[sessionId]/page.tsx` — auth Google + `viewerOwnsStudioSession` por `owner_email` | ✓ existe |
| Ingesta `ai-mvp-milestone` → tabla | `supabase/migrations/20260606_021_ai_mvp_milestone.sql` + `noonAppAiMvpMilestonePayloadSchema` en `lib/noon-app-integration.ts` | ✓ existe |
| `client_workspace.noon_app_project_id` (write-once, set en pago) | `supabase/migrations/20260606_022_client_workspace_noon_app_project_id.sql`; consumido en `page.tsx` | ✓ existe |
| Timeline `workspace_update` + materiales | `page.tsx` (`getWorkspaceUpdates`, filtro `material`) | ✓ existe |
| AI-MVP preview (`version-ready` + `version_url`) | `MilestoneBanner` en `page.tsx` | ✓ existe |
| Plomería HMAC ambos sentidos (sign/verify + retry/backoff) | `lib/noon-app-integration.ts` (`signNoonAppEnvelope`, `postNoonAppWebhook`, `readSignedNoonAppJson`) | ✓ existe |
| Contrato `sanitizeForClient` / `INTERNAL_ONLY_FIELDS` | `lib/security/project-isolation.ts` | ✓ existe |

**Net-new confirmado (búsqueda en repo: 0 resultados reales):**

| Pieza | Fase |
|---|---|
| Wire de **project-status** (consumir `projects.status` del App; hoy el workspace muestra un `workspace_status` *local*, no el del App) | 1 |
| **Comentarios bidireccionales** (tabla local + UI + reenvío al App) | 1 |
| Display de **versiones / Publish / rollback** | 2 |
| **Request system §9** (tipos/estados/prioridad/ruteo) | 3 |

**Implicación clave (no resaltada en el handoff):** las dos piezas net-new de
Fase 1 dependen de endpoints que **aún no existen en el App** (handoff §5). Por
eso el primer paso es **congelar el contrato de payloads**; después ambos repos
avanzan en paralelo (el reenvío de comentarios degrada con retry si el App aún
no responde, igual que los webhooks actuales).

---

## 2. Decisiones de diseño — cerradas (2026-06-14)

| # | Decisión (§6 del handoff) | Resolución | Razón |
|---|---|---|---|
| 1 | Modelo de acceso | **Cuenta Google existente**, extendiendo `/maxwell/workspace/[sessionId]` | La auth Google + `owner_email` ya satisface el "client account" del §6. Cero auth nueva. Magic Link queda diferido para clientes sin Google. |
| 2 | Push vs pull del estado | **Pull / signed-read, keyeado por `noon_app_project_id`** (no por token) | El page ya es `force-dynamic`; no requiere tabla nueva; `latest_update` viaja en el payload. Milestones siguen por push (eventos append-only); status es estado-actual (pull). El projectId ya se genera y se guarda — no hace falta token de capacidad. |
| 3 | Data model §9 | Diferido a Fase 3 | No se sobre-diseña ahora. |
| 4 | Mapeo "latest updates" | Absorbido en el payload de status (decisión 2) | `latest_update` es un campo del feed de project-status. |

---

## 3. Contrato de payloads — congelar antes de codear

Ambos lados acuerdan estas formas. Todo payload App→cliente pasa por
`sanitizeForClient` **en el lado App**; NoonWeb valida con Zod y corre
`assertNoInternalFields` defensivamente al recibir.

### 3.1 Project-status (pull, keyeado por projectId)

NoonWeb llama al App con el `noon_app_project_id` que ya tiene almacenado; la
firma HMAC es la auth, el `projectId` selecciona el recurso.

> **Alineado con el spec productor del App**
> `App-nooncode/specs/v3-client-portal-app-side-feed.md` (2026-06-14, Architecture
> "Ready for Backend"), verificado contra su schema real (`migrations
> 0004/0005/0069`, `database.types.ts`). Esa es la forma **productora**; NoonWeb
> es el **consumidor** y se conforma a ella. El App lockeó de forma independiente
> las mismas decisiones: D-1 pull/signed-read cache 30s · D-2 keyeado por
> projectId (no token) · D-3 `latestUpdate` desde `project_activities`.

```
GET {NOON_APP_BASE_URL}/api/integrations/website/project-status/{projectId}
headers: x-noon-timestamp, x-noon-signature   (HMAC body-vacío: firma = ${timestamp}.)
auth:    verifyWebsiteWebhookSignature, ±5min skew; rate-limit 60/min ANTES del HMAC
cache:   éxito → Cache-Control: private, max-age=30 ; error → no-store

→ 200 (allowlist construida con sanitizeForClient/buildClientView en el App):
{
  "data": {
    "project":  { "id": "<uuid>", "name": "<string>", "status": "<enum project_status>" },
    "proposal": { "title": "...", "amount": 0, "currency": "USD", "paymentStatus": "<...|null>" } | null,
    "payment":  { "activated": true, "status": "<payment_status|null>" },
    "versions": [ { "sequence": 1, "state": "ready_for_client_preview", "previewUrl": "<url|null>", "at": "<ISO>" } ],
    "latestUpdate": { "kind": "status_changed", "status": "<enum>", "at": "<ISO>" } | null,
    "serverTime": "<ISO>"
  },
  "requestId": "<id>"
}

Errores: 400 projectId malformado · 401 HMAC inválido/expirado · 404 no existe o
sin payment_activated (no-revelador) · 429 rate-limited · 503 secreto sin config.
```

Mapeo a columnas reales del App (de su Architecture §B):

| Salida | Columna fuente |
|---|---|
| `project.id/name/status` | `projects.id/name/status` |
| `proposal.title/amount/currency/paymentStatus` | `lead_proposals.*` (proposal = `projects.source_proposal_id`) |
| `payment.activated/status` | `projects.payment_activated` / `lead_proposals.payment_status` |
| `versions[]` | `project_versions.*`, solo `state='ready_for_client_preview'`, `previewUrl=mvp_demo_url` |
| `latestUpdate` | derivado: `projects.status` + último `project_activities(status_changed).created_at` |

Notas de consumo (lado NoonWeb):
- **NoonWeb es dueño del label del status** — el App manda el enum crudo; la copy
  vive en el portal (§8.1). Mapear `backlog/in_progress/review/delivered/completed`.
- `latestUpdate` v1 es **solo marcador de cambio de status**, sin texto libre (el
  update PM free-text §22.2 es iteración futura). No esperar `title/body` aquí.
- `versions[]` queda thin hasta Fase 2 (publish/rollback diferido; sin
  `published`/`published_url` todavía).
- **Casing — CO-FIRMADO (2026-06-14):** camelCase bajo `data` es **intencional**.
  Regla v3 confirmada por el App: los **wires v3 nuevos** (reads + receptor de
  comentarios) van **camelCase**; los webhooks POST viejos (`ai_mvp_milestone`,
  `proposal_review_decision`) quedan snake_case. NoonWeb convive con ambos casing
  según el wire. `projectId == projects.id` también confirmado.

### 3.2 §8.3 — denylist del boundary (de la Architecture del App §B)

El App construye por **allowlist positivo** (`sanitizeForClient(source, [keys])`,
nunca spreads); NoonWeb corre `assertNoInternalFields` defensivo al recibir, con
estos nombres como mínimo (coordinar adiciones, ver
`docs/cross-repo-v3-contracts-app-mirror.md`):

```
projects:   budget, created_by, developer_user_id, pm_legacy_user_id,
            team_legacy_user_ids, source_lead_id, source_proposal_id
proposals:  body, complexity, review_status, reviewer_id, is_special_case,
            lead_id, superseded_by, version_number
versions:   validation_outcome, originating_pipeline_run_id, mvp_content, origin
activities: actor_profile_id, metadata
+ cualquier seller_fee* / earnings / margin.
```
`budget` es el leak más filoso: es el **costo interno** de Noon, no el precio al
cliente. El App tiene un test `findLeakedFieldNames` que lo asserta = `[]`.

### 3.3 Comentarios (write-back del cliente) — CONGELADO: Camino A (2026-06-14)

**Decisión:** Camino A — el App talla un **receptor interino**. Fase 1 mantiene
paridad y el retiro D1 queda limpio. *(Camino B — esperar §9 — descartado:
dejaría al cliente sin recuadro de mensajes en el intervalo.)* El App respondió
co-firmando (`docs/2026-06-14-app-comment-receiver-contract.md`); contrato final:

```
POST {NOON_APP_BASE_URL}/api/integrations/website/client-comment
headers: x-noon-timestamp, x-noon-signature   (HMAC sobre ${timestamp}.${body})
body:    { "projectId", "externalCommentId", "author": "client",
           "body" (<=2000 chars), "at" (ISO 8601) }
→ 200 { "idempotent": false, "commentId": "<uuid>", "requestId": "<id>" }  // primer envío
→ 200 { "idempotent": true,  "commentId": "<uuid>", "requestId": "<id>" }  // replay
Errores: 401 HMAC · 400 body inválido · 404/409 projectId inexistente o sin
payment_activated (no-revelador) · 503 secret · 500 interno.
```

- **Lado App (no nos toca):** persiste en tabla nueva **`project_client_messages`**
  (project-keyed, D1-limpia — NO toca `client_comments`/`client_access_tokens`) y
  **surface al developer/team** en project-detail (sección read-only). Esto cierra
  un agujero del interino: hoy nadie del staff veía `client_comments`.
- **Lado NoonWeb (Slice 1b):** captura en tabla local (outbox, fuente de verdad del
  log del cliente) y **reenvía** con `postNoonAppWebhook` (retry/backoff; degrada a
  audit `noon_app_*_failed` si el App 5xx / aún no responde).
- **Idempotencia:** `externalCommentId` = id de la fila del outbox local, generado
  **una vez** y reusado en cada reintento. El App de-dupea por esa llave; un replay
  devuelve `idempotent:true` + mismo `commentId`. NoonWeb persiste el `commentId`
  devuelto para reconciliación/audit.
- **Rate-limit del cliente lo hace NoonWeb** en su server action (el receptor es
  server-to-server y confía en el HMAC). Validar `body` (1..2000, trim) antes de
  reenviar para dar error limpio al cliente, no un 400 del App.
- **Limitación conocida:** un 4xx de reenvío (p.ej. projectId sin `payment_activated`)
  no se reintenta (4xx = determinista); queda en audit. Edge raro (un workspace con
  projectId ya pagó). Respuesta de staff *dentro* del portal = fuera de Fase 1; §9.

---

## 4. Alcance Fase 1 — slices (un branch por slice)

Objetivo Fase 1: el cliente ve **status + propuesta + AI-MVP preview +
comentarios** (Camino A, §3.3) en una URL de NoonWeb autenticada, y con eso se
puede **retirar `/client/[token]`** del App.

### Slice 1a — Consumidor de project-status (read-only) — contrato listo del lado App
- `fetchNoonAppProjectStatus(projectId)` en `lib/noon-app-integration.ts`: **GET**
  con HMAC body-vacío (`signNoonAppEnvelope("")` ya soporta esto — mismo patrón que
  `lib/maxwell/prototipo-render-fetch.ts` usa hoy para el signed-read existente).
  *No* reusa `postNoonAppWebhook` (eso es POST).
- Zod schema del envelope §3.1 (`{ data: {...}, requestId }`, camelCase).
- En el workspace: cuando `workspace.noonAppProjectId` existe, renderizar el
  `status` del App (mapear enum→label en NoonWeb; hoy se muestra el
  `workspace_status` local), `proposal` (título + monto — hoy solo visible en la
  vista "preparing") y `latestUpdate` como marcador de cambio de status.
- `assertNoInternalFields` (denylist §3.2) sobre la respuesta antes de pintar.
- Tests: schema valida/rechaza, GET firma bien (body vacío), fallback si el App no
  responde / 404 / 401.
- **Habilita** la paridad de "status + propuesta + preview". Desbloqueado: el App
  ya tiene este lado en Architecture-Ready.

### Slice 1b — Write-back de comentarios (Camino A) — gateado por el receptor del App
- Migración: tabla local `client_comment` (outbox: `id`, `workspace_id`, `body`,
  `external_comment_id`, `forwarded_at`, `created_at`).
- UI de captura en el workspace + server action → `postNoonAppWebhook` al receptor
  interino §3.3 (retry/backoff, degradación a audit `noon_app_*_failed` si el App
  5xx / aún no expone el endpoint).
- **Display:** la tabla local es la fuente de verdad del log del cliente (paridad
  con el interino). El status read §3.1 **no** devuelve comentarios; no se necesita.
- Tests: insert local, reenvío firma + idempotencia (`externalCommentId`),
  degradación si el App 5xx.
- **Dependencia:** requiere que el App talle el receptor §3.3. NoonWeb puede
  construir todo el slice contra stubs y activar el reenvío real cuando exista.

### Slice 1c — Handshake de retiro
- El link compartido al cliente apunta a NoonWeb (`/maxwell/workspace/...`).
- Coordinación: el App deja de generar `/client/[token]` (o lo marca deprecated)
  y agenda el retiro D1 (handoff §8). Mayormente coordinación + posible redirect.

**Dependencia cruzada:** 1a y 1b requieren los endpoints del App (§3.1/§3.2). Se
pueden construir contra el contrato congelado con respuestas stubbeadas en tests,
pero la data real necesita que el App shipee primero (ver §6).

---

## 5. Criterio de "hecho" — Fase 1

- [ ] El cliente ve su proyecto (status + propuesta + AI-MVP preview +
      comentarios) en una URL de **NoonWeb**, autenticado por su cuenta Google.
- [ ] Ningún campo §8.3 cruza el boundary (verificado por
      `assertNoInternalFields` en recepción).
- [ ] Los comentarios del cliente llegan al developer/delivery board del App.
- [ ] El link compartido apunta a NoonWeb, no al App.
- [ ] El App deja de generar links `/client/[token]` (o se marca deprecated) y se
      agenda el retiro D1.

---

## 6. Secuencia de coordinación App ↔ Web

**Ambos contratos están CONGELADOS (2026-06-14):** status read §3.1 co-firmado +
receptor de comentarios §3.3 co-firmado. Ya no hay decisiones de contrato abiertas
para Fase 1.

0. ✅ **Contratos congelados.** Status read (§3.1, casing + `projectId==projects.id`
   confirmados) y receptor de comentarios (§3.3, Opción B + idempotencia).
1. **App entrega** ambos endpoints — sus iteraciones propias:
   `project-status` signed-read (Architecture-Ready) y el `client-comment` receptor
   (`App-nooncode/specs/v3-client-portal-comment-receiver.md`).
2. **NoonWeb construye Slice 1a + 1b** contra los contratos congelados (stubs
   firmados en tests mientras el App termina). Pasos 1 y 2 se solapan.
3. **NoonWeb Slice 1c + App retira** `/client/[token]` (cleanup D1 del App),
   gateado por 1a + 1b en prod.

---

## 7. Diferido (no Fase 1)

- **Fase 2 — Versionado/Publish (§6 flows):** mostrar `project_versions`,
  historial, preview por versión, acción Publish / Update Published Version,
  rollback (autorizado por dev o PM/Admin), distinción §11.1
  `Private Preview` ≠ `Published` ≠ `Delivered`. El payload §3.1 ya trae
  `versions[]` y `published_url` para preparar el terreno.
- **Fase 3 — Request system §9:** requests tipificados (Material/file, Comment,
  Bug, Minor adjustment, Support, Monthly improvement, New feature, Scope change,
  Urgent) con estados (Received → … → Completed / Out of Scope / Escalated),
  prioridad sugerida por cliente, ruteo al dev board. Data model a definir
  entonces.

---

## 8. Referencias

- Handoff origen: `App-nooncode/docs/handoffs/2026-06-14-noonweb-client-portal-v3-handoff.md`.
- Spec: `App-nooncode/docs/product/master-spec-v3.md` §2/§6/§7/§8/§9; flows §6/§7.
- Contrato cross-repo (project-types + sanitización): `docs/cross-repo-v3-contracts-app-mirror.md`.
- Plomería HMAC: `lib/noon-app-integration.ts`.
- Patrón signed-read existente (App): `app/api/integrations/website/prototype-signed-read/[token]/route.ts`.
