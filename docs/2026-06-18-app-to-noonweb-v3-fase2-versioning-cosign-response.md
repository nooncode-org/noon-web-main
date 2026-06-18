# Handoff — App → NoonWeb: respuesta de co-firma de v3 Fase 2 (Versionado: Publish + Rollback)

**Fecha:** 2026-06-18
**Para:** equipo **NoonWeb** (`noon-web-main`) — dev o sesión de agente.
**De:** App-nooncode.
**En respuesta a:** `noon-web-main/docs/handoff-2026-06-17-v3-fase2-versioning-codesign.md`.
**Objetivo:** **co-firmar el transporte (Ask #1)** y **resolver Q-A..Q-F** para congelar el
contrato cross-repo de Fase 2 (Publish + Rollback) y desbloquear Architecture de ambos
lados. Mismo patrón que el co-diseño de §9 (client-requests).

> Auto-contenido. Valores verificados contra el código real del App: pull productor
> `lib/server/projects/client-status-read.ts:169-183`, sanitizer
> `lib/server/projects/client-status-view.ts`, receptor patrón
> `app/api/integrations/website/client-request/route.ts`, HMAC
> `lib/server/website-webhook-auth.ts`, modelo de versión actual
> `supabase/migrations/0069_project_versions.sql`. Spec: `docs/product/master-spec-v3.md`
> §20 (20.1–20.8) + flows §6.

---

## 0. TL;DR — dos asks resueltos

1. **Ask #1 (transporte): CO-FIRMADO.** Extendemos el `versions[]` del project-status
   read existente (NO un push `version-available` nuevo). Encaja con "App = SoT de estado
   operativo" (§9), un único read productor, y pull = estado-actual. Forma congelada en §2.
2. **Q-A..Q-F: RESUELTAS.** El punto crítico (Q-A) lo resuelve el propio spec y **separa
   autoridad**: **Publish = cliente** (§20.2); **Rollback = staff** (dev-autorizado /
   PM/Admin ejecuta; §20.7). No es la dicotomía binaria del handoff — son dos autoridades
   distintas.

**Decisión de alcance del MVP (owner/operador, 2026-06-18):** en el MVP el **rollback lo
ejecuta staff DENTRO del App**; el estado resultante se refleja en el siguiente pull.
**NoonWeb NO construye UI de rollback en el MVP** (solo Publish + display). El "cliente
*solicita* rollback" se **difiere** y luego se pliega al sistema §9 client-requests con
`versionRef` (B.4) — no entra a este contrato. Satisface el owner-lock (la capacidad de
rollback existe y es client-visible) con la mínima superficie cross-repo.

**Estado:** contrato **CONGELADO** para Fase 2 MVP (pull extendido + receptor `version-action`
solo-`publish` + rollback staff-side App-interno). Ambos repos pueden entrar a Architecture
en paralelo.

---

## 1. Q-A — Autoría (el spec ya la resuelve; separa autoridad)

NoonWeb planteó Q-A como binaria ("¿cliente publica/rollback, o lo decide dev/PM?"). El
master spec distingue **las dos acciones** y les asigna autoridad distinta:

| Acción | Autoridad | Evidencia |
|---|---|---|
| **Publish** | **cliente** (self-service desde el portal) | §20.2 "the client can choose to publish… Public publishing is client-controlled. It is not automatic by default." |
| **Rollback** | **staff** (cliente puede *solicitar*; dev-autorizado / PM/Admin *ejecuta/controla*) | §20.7 ("client can request rollback; developer authorized can execute if permitted; PM/Admin can execute/control rollback; all rollback events must be logged"); flows §6; `docs/contracts/project-versions.md:32,68,75` |

→ **Publish:** NoonWeb construye UI de acción → outbound `version-action {publish}` → el App
ejecuta (mueve el puntero publicado) e idempotentemente confirma. El cliente permanece en
NoonWeb (boundary intacto: clientes son exclusivamente NoonWeb); el estado operativo lo posee
el App (§9 Q-1).

→ **Rollback (MVP):** el App lo ejecuta **server-internamente por staff** (dev/PM/Admin), lo
**registra** (§20.7 / §22.1) y el nuevo estado se refleja en `publishedSequence` + el `state`
por versión del pull (§2). **No cruza el wire en el MVP.** Tomar el bullet "client can
publish/rollback" literalmente (auto-ejecutar rollback con autoridad de cliente) rompería
§20.7 — por eso se rechaza un `version-action {rollback}` ejecutable desde NoonWeb.

> **Diferido (no en este contrato):** "cliente solicita rollback" se pliega al sistema §9
> client-requests + `versionRef` (B.4) cuando haya demanda. No requiere endpoint nuevo: es un
> `client_request` contra una versión.

---

## 2. Ask #1 + Q-B — Transporte: CO-FIRMADO (extender `versions[]` del pull)

Confirmamos **extender el project-status signed-read** (el mismo signed-read que ya sirve a
Slice 1a) en vez del push `version-available` del master spec §20. Razón: es estado-actual
(pull encaja), hay un único read productor (`client-status-read.ts`), y el consumidor de
NoonWeb ya es forward-compat.

**Forma congelada del 200** (camelCase, todo por `sanitizeForClient` / allowlist positiva de
`client-status-view.ts` — ningún campo §8.3 cruza):

```jsonc
"data": {
  "project":  { "id", "name", "status" },
  "proposal": { "title", "amount", "currency", "paymentStatus" } | null,
  "payment":  { "activated", "status" },
  "versions": [
    {
      "sequence": 1,
      "state": "ready_for_client_preview" | "published" | "previous_published" | "rolled_back",
      "previewUrl": "<url|null>",
      "at": "<ISO>",
      "published": false              // NUEVO — conveniencia, === (state === 'published')
    }
  ],
  "publishedSequence": 2 | null,      // NUEVO — qué sequence está publicada (null si ninguna)
  "publishedUrl": "<url|null>",       // NUEVO — URL pública client-facing actual
  "latestUpdate": { "kind": "status_changed", "status", "at" } | null,
  "serverTime": "<ISO>"
}
```

Notas de la forma (refinamiento sobre la propuesta D-1 de NoonWeb):
- **Agregamos un `state` client-visible por versión** (no solo el booleano `published`) para
  que Slice 2a pueda renderizar el historial ("Published" / "Previous Published" /
  "Rolled Back" / preview) sin inferir. Es una **allowlist** con default neutral, mismo patrón
  F-2 que `CLIENT_VISIBLE_PROJECT_STATUSES`: cualquier estado interno (`draft`) o no mapeado
  **nunca** cruza. `published` (booleano) se mantiene por conveniencia para consumo simple.
- `publishedUrl` es a nivel proyecto (una URL pública; apunta a la sequence en `published`).
  El `previewUrl` por versión sigue siendo el artefacto de preview (`mvp_demo_url`).
- Ningún campo §8.3 (`validation_outcome`, `originating_pipeline_run_id`, `mvp_content`,
  `origin`, `rollback_reason`, comp/earnings/margin) cruza — NoonWeb corre
  `assertNoInternalFields` + allowlist al recibir (defensa en profundidad bilateral).
- **`versionRef = versionSequenceNumber`** (ya congelado en §9 B.4): la identidad de versión
  cross-repo es la sequence, nunca un UUID interno.

---

## 3. Q-F — Receptor `version-action` (solo `publish` en el MVP)

```
POST /api/integrations/website/version-action            # publish (cliente, MVP)
  {
    "action": "publish",
    "projectId",                 // == projects.id == client_workspace.noon_app_project_id
    "versionSequenceNumber",     // la versión que el cliente eligió publicar
    "externalActionId",          // UUID minado por la fila outbox de NoonWeb, reusado en cada retry → idempotencia
    "at"                         // ISO 8601 del cliente; informativo, el App ordena por server now()
  }
→ 200 { "idempotent": false|true, "publishedSequence", "publishedUrl", "requestId" }
```

- **Idempotencia** por `externalActionId` (app-level UNIQUE; mismo molde que `externalRequestId`
  / `externalCommentId`). Replay del mismo id devuelve el estado resultante con
  `idempotent: true`.
- **Divergencias deliberadas** (idénticas al receptor de comentarios / client-request — NO
  "normalizar"): body **flat** (no `{ data: … }`) y **HTTP 200** tanto en first-write como en
  replay (no 201-on-create).
- **HMAC:** mismo envelope (`x-noon-timestamp` + `x-noon-signature`, ±5 min) y mismo secreto
  `NOON_WEBSITE_WEBHOOK_SECRET`. **Sin secreto nuevo.**
- **Gates** (todos devuelven códigos limpios para que el cliente reciba un error legible, y un
  404 no-revelador para existencia/activación, paridad con los receptores existentes):
  - `payment_activated` requerido (defensa en profundidad; el gate primario de auth de cliente
    es 100% NoonWeb — §9 Q-10).
  - **Project type ∈ {web, web-app}** (Q-C). Otros types → rechazo limpio (no publicable en MVP).
  - **Versión publicable:** `versionSequenceNumber` debe existir y estar en estado publicable
    (`ready_for_client_preview`+, i.e. pasó validación §20.8). Draft/inexistente → rechazo limpio.
- **`rollback` NO es una acción de este receptor en el MVP** (Q-A). Si llega `action:"rollback"`,
  se rechaza (no implementado en MVP). El rollback es App-interno por staff (§1).

---

## 4. Resto de respuestas

### Q-C — Project types
**Publish aplica solo a `web` / `web-app` en el MVP** (§20.2 + `project-versions.md:30`
"website / web app project types only"). Los otros 6 types → fase posterior (best-applicable
preview/demo/review mode, §18 "Only web/web app projects should expose client-controlled
Publish"). El receptor rechaza publish para types no-web (gate arriba).

### Q-D — Modelo de publicación (decisión del App — somos SoT)
**Ni `version_publications` (tabla nueva) ni un puntero en `projects` como SoT.** El estado de
publicación vive **en la propia `project_versions`** (la entidad que el contrato
`project-versions.md` ya define con el lifecycle completo):
- Se ensancha el `state` CHECK (hoy `draft|ready_for_client_preview`) para sumar
  `client_preview | published | previous_published | rolled_back | delivered_version`.
- Se agregan columnas: `published_url`, `published_at`, `previous_published_from_version_id`,
  `rollback_reason` (interno, nunca client-facing).
- El **historial "quién/cuándo"** (publish/rollback) va al **log de actividad existente**
  (`project_activities`, §22.1 ya lista "client published/updated public version" y "rollback").
- Un puntero denormalizado opcional en `projects` (`published_version_sequence_number`,
  `published_url`) es solo **caché de lectura**, no SoT.

Razón: una sola fuente de verdad por versión (evita una tabla paralela que duplicaría estado y
podría divergir), y empata 1:1 con el lifecycle ya contratado. **Para NoonWeb es transparente**
— solo consume el pull (§2) + la respuesta del receptor (§3); no le importa la tabla.

> Nota App-side (no afecta a NoonWeb): el `ALTER … state CHECK` / `ALTER TABLE` sobre
> `project_versions` cae en la trampa de privilegios de `noon_migrator` ("must be owner of
> table/type") — se aplica como `postgres` + insert manual al ledger. Se resuelve en
> Architecture/Infra del App.

### Q-E — Semántica de rollback
- Rollback = **mover el puntero publicado a una sequence anterior**, **atómico** (una
  transacción): la `published` actual → `previous_published` (o `rolled_back` si es retiro sin
  reemplazo), la sequence destino → `published`. Logged (§20.7).
- **Idempotente** a nivel de ejecución (re-ejecutar el mismo rollback es no-op si el estado ya
  es el destino).
- **Versiones no republicables:** solo las que pasaron validación (`ready_for_client_preview`+)
  son publicables; `draft` / validación fallida no. Una `rolled_back` sí puede re-publicarse
  (permanece en el historial).
- En el MVP esto lo dispara **staff en el App** (no cruza el wire). Se refleja en
  `publishedSequence` + `state` por versión del pull.

---

## 5. Qué construye cada lado (post-freeze)

**App (Fase 2 MVP):**
1. Capa de publicación sobre `project_versions` (Q-D) — migración (state CHECK + columnas) +
   repo/servicio que ejecuta publish/rollback atómicos y loguea a `project_activities`.
2. Pull extendido (§2) por `sanitizeForClient` — `state` por versión + `published` +
   `publishedSequence`/`publishedUrl`.
3. Receptor `POST /api/integrations/website/version-action` solo-`publish` (§3), molde del
   receptor `client-request`.
4. UI staff App-interna para ejecutar rollback (dev/PM/Admin) + reflejarlo.

**NoonWeb (en paralelo):**
- **Slice 2a — Display de versiones** (historial + preview por versión + marca "Published" /
  "Previous Published" usando el `state` por versión) sobre el `versions[]` del pull. No depende
  del App; ya construible.
- **Slice 2b — Publish:** UI de acción gateada (solo web/web-app) + server action que persiste
  outbox local y reenvía firmado al receptor §3 (molde de `submit-request.ts` de §9),
  idempotente con dead-letter; consume `publishedUrl`/`publishedSequence` del pull para mostrar
  el estado publicado.
- **Sin Slice 2c (rollback) en el MVP** — NoonWeb no construye UI de rollback (Q-A / decisión de
  alcance). Diferido a §9 client-requests + `versionRef` (B.4) si hay demanda.

NoonWeb construye contra el contrato congelado con stubs firmados en tests hasta que el App
despliegue (como §9).

---

## 6. Env / secretos
**Cero env/secreto nuevo del lado App.** El receptor `version-action` es **inbound**
(NoonWeb→App) y reusa `NOON_WEBSITE_WEBHOOK_SECRET`; no hay nuevo target outbound (el estado se
sirve por el pull ya existente). Confirmen que su lado tampoco necesita env nuevo.

---

## 7. Secuencia (post-freeze)
0. **Co-diseño: CERRADO.** Ask #1 co-firmado; Q-A..Q-F resueltas (§1–§4).
1. **App:** Architecture de Fase 2 MVP (modelo Q-D + pull extendido §2 + receptor §3 +
   rollback staff-side) contra este contrato congelado.
2. **NoonWeb (en paralelo):** Slice 2a (display) — no depende del App. Luego 2b (publish)
   contra stubs firmados hasta que el App despliegue. Pasos 1 y 2 se solapan.
3. **Diferido (post-MVP):** client-request de rollback → §9 + `versionRef` (B.4);
   *Private Preview* y *Update Published Version* (owner-lock: fuera de Fase 2).

---

## 8. Cierre — preguntas, respuestas y estado

| # | Pregunta | Resuelta |
|---|---|---|
| **Q-A** | Autoría | **Publish = cliente** (§20.2); **Rollback = staff** (§20.7). MVP: rollback App-interno, NoonWeb sin UI de rollback. Client-request de rollback diferido a §9+B.4. |
| **Q-B** | Transporte | **Co-firmado:** extender `versions[]` del pull (§2). + `state` por versión. |
| **Q-C** | Project types | Solo `web`/`web-app` en MVP; otros 6 → fase posterior. |
| **Q-D** | Modelo | Estado en `project_versions` (state CHECK + columnas) + audit en `project_activities`; puntero en `projects` = solo caché. (App-SoT.) |
| **Q-E** | Rollback | Mover puntero publicado, atómico + idempotente; solo versiones validadas son publicables; ejecuta staff (MVP). |
| **Q-F** | `version-action` shape | `{action:"publish", projectId, versionSequenceNumber, externalActionId, at}`, idempotente por `externalActionId`, body flat + 200 first/replay, HMAC reusado. `rollback` no cruza en MVP. |

**Estado: contrato CONGELADO para Fase 2 MVP. Ambos repos entran a Architecture en paralelo.**

---

## 9. Referencias
- Handoff que responde: `noon-web-main/docs/handoff-2026-06-17-v3-fase2-versioning-codesign.md`.
- Diseño NoonWeb: `noon-web-main/docs/2026-06-17-v3-fase2-versioning-publish-design.md`.
- Spec: `docs/product/master-spec-v3.md` §20 (20.1–20.8), §21, §22.1; flows §6.
- Contrato de entidad: `docs/contracts/project-versions.md` (lifecycle + autoría de rollback).
- Pull productor + sanitizer: `lib/server/projects/client-status-read.ts`,
  `lib/server/projects/client-status-view.ts`.
- Receptor patrón: `app/api/integrations/website/client-request/route.ts`; HMAC:
  `lib/server/website-webhook-auth.ts`.
- Modelo de versión actual: `supabase/migrations/0069_project_versions.sql`.
- Precedente de co-firma (§9): `App-nooncode/docs/handoffs/2026-06-16-app-to-noonweb-client-requests-cosign-response.md`.
- Identidad de versión cross-repo: `versionSequenceNumber` (congelado en §9 B.4).
