# Handoff — App → NoonWeb: respuesta de co-firma del sistema de client-requests (§9)

**Fecha:** 2026-06-16
**Para:** equipo **NoonWeb** (`noon-web-main`) — dev o sesión de agente.
**De:** App-nooncode.
**En respuesta a:** `noon-web-main/docs/handoff-2026-06-16-client-requests-codesign-noonweb-response.md` (su co-firma de §9).
**Objetivo:** **congelar Q-1 / Q-2 / Q-4**, aceptar el refinamiento de monotonía (§2 de su doc), y **resolver las 4 asks-back + 2 confirm-asks** (§3 de su doc) para desbloquear el Architecture de ambos lados. Mismo patrón que el receptor de comentarios.

> Auto-contenido. Funda: `App-nooncode/docs/handoffs/2026-06-15-client-requests-codesign-app-web.md` (co-diseño origen del App) + su respuesta del 2026-06-16. Valores verificados contra el código real del App: receptor de comentarios `app/api/integrations/website/client-comment/route.ts` (+ schema `lib/server/projects/client-messages-repository.ts`), project-status read `lib/server/projects/client-status-read.ts`, vocabulario de enums `lib/projects/project-types.ts`, HMAC `lib/server/website-webhook-auth.ts`.

---

## 0. TL;DR

1. **Q-1 / Q-2 / Q-4 CONGELADOS** tal como los co-firmaron (incluida la afinación de wording del SoT). El App es system-of-record del **estado operativo**; NoonWeb posee **id + contenido + adjuntos + último estado client-visible** (proyección read-only que el App computa). Mirror/push en ambas direcciones. Envelope HMAC + camelCase + keying reusados.
2. **Refinamiento §2 ACEPTADO → `revision`** (contador monotónico por request, autoritativo del App, sin dependencia de relojes — el preferido de ustedes). El outbound lo lleva; NoonWeb descarta cualquier estado cuyo `revision` no avance.
3. **Las 4 asks-back resueltas** (§3 abajo): enum de 9 `type`, enum de 5 `clientPriority`, `versionRef` = `versionSequenceNumber`, `body` cap = **4000**.
4. **`submittedBy` = id opaco** del usuario cliente (minimización de datos — el App NO recibe ni almacena el `owner_email` en su store de requests). §4.
5. **Adjuntos (Q-5) y scope-eval (Q-8): dueño confirmado, forma diferida** a B.5 / B.3 — coincidimos en no sobre-diseñar v1. **B.1 sale sin adjuntos y sin versionRef.**
6. **Env del lado App:** una sola variable nueva, `NOON_WEBSITE_CLIENT_REQUEST_STATE_URL` (target del outbound). Sin secreto nuevo — reusamos `NOON_WEBSITE_WEBHOOK_SECRET`. Confirmado que su lado tampoco necesita env/secreto nuevo.

**Estado:** contrato **CONGELADO** para B.1 (inbound create + tabla mirror + dev-board read) y para el outbound de estado de B.2. Ambos repos pueden entrar a Architecture en paralelo.

---

## 1. Freeze de Q-1 / Q-2 / Q-4 (sin cambios respecto a su co-firma)

| # | Decisión congelada |
|---|---|
| **Q-1** | **App = estado operativo** (los 8 estados §9.4, clasificación, prioridad operativa, assignee, escalation log). **NoonWeb = `{id, contenido enviado, adjuntos, último estado client-visible recibido}`**; el estado client-visible que NoonWeb guarda es una **proyección read-only** que computa el App — NoonWeb nunca lo escribe ni lo deriva. "portal-owned" = fila/identidad/contenido de NoonWeb; "App system-of-record" = estado de trabajo del App. |
| **Q-2** | **Mirror en ambas direcciones.** Inbound (NoonWeb→App): NoonWeb empuja create/update con la maquinaria del outbox de comentarios (3 intentos, backoff 1s/2s ±20% jitter, retry solo en 5xx, degrada a audit). Outbound (App→NoonWeb): el App empuja el estado client-visible al receptor NUEVO de NoonWeb. Read-through descartado. |
| **Q-3** | NoonWeb mina un **UUID estable = id de su fila local** del request, reusado idéntico en cada reintento, nunca regenerado. El App lo guarda como `externalRequestId` **UNIQUE** (misma garantía de idempotencia que `externalCommentId`). |
| **Q-4** | **Envelope/casing/keying fijos:** mismo HMAC (`x-noon-timestamp` + `x-noon-signature`, ±5 min); **camelCase**; `projectId == projects.id == client_workspace.noon_app_project_id` (mismo keying que status y comentarios); `at` en ISO 8601 del cliente, **ordenar por server-`now()` del receptor**; idempotencia inbound por `externalRequestId` (+ `updateId` en updates). **+ refinamiento §2 + asks-back §3.** |

---

## 2. Refinamiento de monotonía (su §2) — ACEPTADO: `revision`

El App agrega **`revision`** al payload outbound: un **entero monotónico por `externalRequestId`**, autoritativo del App, que **avanza en cada cambio de estado client-visible** (1, 2, 3, …). No depende de relojes (mejor que `stateChangedAt` para el guard que ustedes pidieron). NoonWeb **descarta** cualquier update cuyo `revision` no sea estrictamente mayor que el último aplicado para ese request → idempotente + monótono, sin posibilidad de "regresar" el estado que ve el cliente ante una reentrega tardía del ledger durable (ADR-027).

**Shape outbound congelado (B.2):**
```
POST {NOON_WEBSITE_CLIENT_REQUEST_STATE_URL}
  {
    externalRequestId,                 // UUID minado por NoonWeb (Q-3)
    clientVisibleState,                // uno de los 5 (§3.5)
    revision,                          // entero monotónico por request (App-authoritative)
    at                                 // ISO 8601, informativo
  }
→ client-safe ONLY (sin classification reason / operational priority / escalation notes — §8.3)
```

> El outbound es B.2. Se congela ahora para que NoonWeb pueda tallar su receptor nuevo contra stubs firmados; el App no lo construye hasta B.2.

---

## 3. Respuestas a las 4 asks-back (§3 de su doc)

### 3.1 — Enum de los 9 `type` (canónicos, `snake_case` minúscula)

Vocabulario cross-repo compartido (declárenlo de su lado igual que `project-types`). 1:1 con master-spec-v3 §9.1:

| Canónico (wire) | §9.1 |
|---|---|
| `material` | material / file |
| `comment` | comment / clarification |
| `bug` | bug / problem |
| `adjustment` | minor adjustment |
| `support` | support |
| `improvement` | monthly improvement |
| `feature` | new feature |
| `scope_change` | scope change |
| `incident` | urgent / critical incident |

> `comment` es intencional: empata con el `type=comment` al que folded el receptor de comentarios (Q-7, B.6).

### 3.2 — Enum de `clientPriority` (canónicos, minúscula)

`critical · high · normal · low · backlog` (los 5 de §9.6).

> **Informativo:** es lo que **declara el cliente**. Por §9.6 la **prioridad operativa la decide Noon** (campo interno aparte, nunca cruza). NoonWeb valida que el valor enviado esté en este set. (Ajustamos su propuesta de 4 hacia los 5 del contrato.)

### 3.3 — `versionRef` = `versionSequenceNumber`

El project-status read **no expone un UUID de versión** al cliente; expone `version_sequence_number` (+ `mvp_demo_url` + `created_at`) de las versiones en `ready_for_client_preview`. O sea, **el único identificador de versión que ya cruza la frontera del cliente es el número de secuencia por proyecto.**

→ `versionRef` = ese mismo **`versionSequenceNumber`** que NoonWeb ya recibe en `project-status.versions[].version_sequence_number`. NoonWeb lo reusa directo; el App resuelve `(projectId, versionSequenceNumber)` → la fila `project_version` internamente. **Ningún UUID interno de versión cruza.**

> El version-linking es **B.4**. **B.1 omite `versionRef`.** Se congela la fuente del id ahora para que NoonWeb no tenga que mapear nada después.

### 3.4 — Cap de `body` = 4000

`body: string`, **trim + `min(1) max(4000)`**. (El receptor de comentarios usa 2000; un request es un registro operacional de primera clase —feature, scope change— que justifica más texto, y 4000 sigue siendo un bound seguro.) NoonWeb valida `1..4000` con trim en su server action **antes** de reenviar, para que el cliente reciba un error limpio en vez de un 400 del App.

---

## 4. Confirm-asks (§3.5–3.6 de su doc)

- **3.5 — Campo de orden:** **`revision`** aceptado (§2 arriba). Confirmado.
- **3.6 — `submittedBy` = id opaco.** NoonWeb manda un **id estable y opaco** del usuario cliente (su user id), **no el `owner_email`**. Minimización de datos: el App no duplica el email del cliente en su store de requests; si el staff necesita la identidad humana, se resuelve vía el linkage proyecto→cliente que el App ya tiene. El id opaco distingue **qué** usuario envió cuando la cuenta es compartida (contrato `client-requests.md`, campo `submitter`).

---

## 5. Confirmaciones del resto de asks (sin cambios respecto a su doc)

- **Q-5 (adjuntos):** dueño = NoonWeb (hostea); el App guarda **id estable de adjunto**, no signed URL crudo. **Forma diferida a B.5; B1 sale sin adjuntos (`attachments?[]` omitido).** Anotado: NoonWeb no tiene storage de adjuntos hoy → net-new de su lado.
- **Q-6 (8→client-visible):** el **App colapsa 8→5 server-side**; **solo los 5 client-safe cruzan el wire**: `received · in_review · in_progress · completed · under_internal_review` (los operativos —incl. `escalated`→`under_internal_review`— nunca cruzan). La **tabla de colapso exacta es App-interna y se finaliza en B.2**; el enum de 5 queda fijo ahora para que NoonWeb arme su allowlist Zod + `assertNoInternalFields` + el mapping 5→copy. (B.1 solo emite `received`, pero no emite hasta B.2.)
- **Q-7 (folding):** coexistir → backfill `type=comment` → retirar el receptor plano en B.6. NoonWeb mergea su outbox de comentarios (Slice 1b) como ladrillo interino. Confirmado.
- **Q-8 (scope-eval §10):** dueño = App; **forma diferida a B.3.** Hasta que exista membership, el App evalúa **solo one-time** (degradación segura). Cómo se surface "requiere nueva propuesta" se co-diseña en B.3.
- **Q-9 (canales):** v1 = `user_notifications` (staff) del lado App + display in-portal del lado NoonWeb; email al cliente gateado por `MAXWELL_LIFECYCLE_EMAILS`. Política de canales = decisión aparte.
- **Q-10 (pre-payment auth):** 100% NoonWeb (cliente autenticado + proyecto `payment_activated`). El receptor del App mantiene su gate `payment_activated` + 404 no-revelador como defensa en profundidad.

---

## 6. Shape inbound congelado (B.1) — resumen para que tallen su outbox

```
POST /api/integrations/website/client-request            # crear (B.1)
  {
    externalRequestId,        // UUID minado por NoonWeb (Q-3), UNIQUE, reusado en reintentos
    projectId,                // == projects.id == client_workspace.noon_app_project_id
    submittedBy,              // id opaco del usuario cliente (§4)
    type,                     // uno de los 9 (§3.1)
    clientPriority,           // uno de los 5 (§3.2), informativo
    body,                     // string, trim, 1..4000 (§3.4)
    at                        // ISO 8601 del cliente; el App ordena por server-now()
    // versionRef?            // = versionSequenceNumber — DIFERIDO a B.4 (omitir en B.1)
    // attachments?[]         // DIFERIDO a B.5 (omitir en B.1)
  }
→ idempotente por externalRequestId; gate payment_activated; 404 no-revelador (paridad con el receptor de comentarios).

POST /api/integrations/website/client-request-update     # aclaración / adjunto (DIFERIDO a B.5)
  { externalRequestId, updateId, kind: 'clarification'|'attachment', body?|attachment?, at }
→ idempotente por (externalRequestId, updateId).
```

---

## 7. Secuencia (post-freeze)

1. **Co-diseño: CERRADO.** Q-1/Q-2/Q-4 congelados; asks-back resueltas (§3–§4).
2. **App:** entra a **Architecture de B.1** (tabla mirror `client_requests` + inbound `client-request` create + dev-board read en Received) contra este contrato congelado. *(Nota de secuencia App-side: el operador decidió pausar después de este freeze; B.1 Architecture arranca en una sesión posterior.)*
3. **NoonWeb (en paralelo):** merge del outbox de comentarios (Slice 1b, interino) → receptor outbound nuevo `POST /api/integrations/noon-app/client-request-state` + outbox de requests + UI de submission tipada, contra stubs firmados hasta que los endpoints del App estén en prod.
4. **B.2…B.6** en secuencia (state machine + outbound de estado, scope-eval §10, version-linking, clarification round-trip + adjuntos, retiro del receptor plano), cada uno re-entrando Analysis/Architecture según haga falta.

---

## 8. Referencias

- Co-diseño origen (App): `App-nooncode/docs/handoffs/2026-06-15-client-requests-codesign-app-web.md` (= `noon-web-main/docs/handoff-app-2026-06-15-client-requests-codesign.md`).
- Co-firma de NoonWeb: `noon-web-main/docs/handoff-2026-06-16-client-requests-codesign-noonweb-response.md`.
- Analysis App-side (perímetro + 6 chunks): `App-nooncode/specs/v3-client-requests-system.md`.
- Contrato de entidad: `App-nooncode/docs/contracts/client-requests.md`; version-linking: `App-nooncode/docs/contracts/project-versions.md`.
- Receptor de comentarios (primer ladrillo del inbound): `App-nooncode/specs/v3-client-portal-comment-receiver.md` + `App-nooncode/docs/integrations/cross-repo-webhook-v1.md` §5B.
- Master-spec: `docs/product/master-spec-v3.md` §9 / §10 / §22 / §11; flows §7.
