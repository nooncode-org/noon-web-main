# Handoff — NoonWeb → App: co-firma del sistema de client-requests (§9)

**Fecha:** 2026-06-16
**Para:** equipo **App-nooncode** — dev o sesión de agente.
**De:** NoonWeb (`noon-web-main`).
**En respuesta a:** `docs/handoff-app-2026-06-15-client-requests-codesign.md` (co-diseño §9).
**Objetivo:** responder las **10 asks** (§5 del doc del App), **congelar Q-1 / Q-2 / Q-4**, y mandar **1 refinamiento** + **4 asks-back** que desbloquean el Architecture de NoonWeb. Mismo patrón que el receptor de comentarios: el App propone, NoonWeb confirma/ajusta, congelamos, construimos en paralelo.

> Auto-contenido. Verificado contra el código real de NoonWeb: HMAC en `lib/noon-app-integration.ts`, receptores inbound en `app/api/integrations/noon-app/*`, sanitizer en `lib/security/project-isolation.ts`, keying en `client_workspace.noon_app_project_id`.

---

## 0. TL;DR

1. **Modelo de ownership ACEPTADO** con una afinación de wording que cierra la tensión "portal-owned" vs "App system-of-record" (Q-1).
2. **Mirror/push en ambas direcciones CONFIRMADO** (Q-2). El inbound reusa la maquinaria del outbox de comentarios; el outbound aterriza en un **receptor NUEVO** de NoonWeb.
3. **Envelope / HMAC / camelCase / keying CONFIRMADO** (Q-4) — reutilizamos toda la plomería existente, **sin secreto ni env nuevo** del lado de NoonWeb.
4. **1 refinamiento que sí pedimos cambiar:** el estado outbound necesita un **guard de monotonía** (el retry durable puede reentregar un estado viejo después de uno nuevo). Detalle §2.
5. **4 asks-back** que NoonWeb necesita para tallar su lado: enum de `type`, enum de `clientPriority`, definición de `versionRef`, cap de `body`. Detalle §3.
6. **Q-5 (adjuntos) y Q-8 (scope-eval):** confirmamos **dueño**, diferimos la **forma** a B.5 / B.3 para no sobre-diseñar v1.
7. **Secuencia de 1b:** NoonWeb mergea su outbox de comentarios como el **ladrillo interino** y lo folded a `type=comment` cuando §9 B.1 aterrice (Q-7).

**Freeze propuesto:** Q-1, Q-2, Q-4 (con el refinamiento §2 + los asks-back §3 resueltos).

---

## 1. Respuestas a las 10 asks

| # | Ask | NoonWeb | Detalle |
|---|---|---|---|
| **Q-1** 🔴 | Source of truth del estado | **CONFIRMADO** (afinando wording) | App = dueño del **estado operativo** (los 8 estados §9.4, clasificación, prioridad operativa, assignee, escalation log). NoonWeb = dueño de `{id, contenido enviado, adjuntos, y el último estado **client-visible** recibido}`. El estado client-visible que NoonWeb guarda es una **proyección read-only** que computa el App; NoonWeb nunca lo escribe ni lo deriva. Eso resuelve la tensión: "portal-owned" = NoonWeb posee la **fila/identidad/contenido**; "App system-of-record" = App posee el **estado de trabajo**. |
| **Q-2** 🔴 | Mirror (push) vs read-through | **CONFIRMADO — mirror en ambas direcciones** | **Inbound** (NoonWeb→App): NoonWeb empuja create/update con la **misma maquinaria** del outbox de comentarios (`postNoonAppWebhook`: 3 intentos, backoff 1s/2s ±20% jitter, retry solo en 5xx, degrada a audit). **Outbound** (App→NoonWeb): App empuja el estado client-visible a un **receptor NUEVO** de NoonWeb (§4). Read-through queda descartado: NoonWeb no expone read endpoint y acoplaría el dev-board del App a la disponibilidad de NoonWeb. |
| **Q-3** | Identidad del request | **CONFIRMADO** | NoonWeb mina un UUID estable = **id de la fila local del request**, reusado **idéntico** en cada reintento, nunca regenerado. El App lo guarda como `externalRequestId` UNIQUE. Misma garantía de idempotencia que `externalCommentId` hoy. |
| **Q-4** 🔴 | Shapes del wire | **CONFIRMADO** envelope/casing/keying **+ 1 refinamiento + 4 asks-back** | Ver §2 (refinamiento) y §3 (asks-back). Lo que ya queda fijo: camelCase; `projectId == projects.id == client_workspace.noon_app_project_id` (mismo keying que status y comentarios); `at` en ISO 8601 del cliente, **ordenar por server-`now()` del receptor** (igual que comentarios §2.2); idempotencia inbound por `externalRequestId` (+ `updateId` en updates). |
| **Q-5** | Adjuntos: storage + referencia | **CONFIRMADO dueño; forma diferida a B.5** | NoonWeb hostea. **Aviso:** NoonWeb **no tiene storage de adjuntos hoy** → es net-new (bucket Supabase Storage + upload en el workspace autenticado). Pedimos que el App guarde un **id estable de adjunto**, **no** un signed URL crudo (los signed URLs caducan); cuando el App necesite los bytes, los pide vía un signed-read de NoonWeb (que tallamos en B.5). **B.1 sale sin adjuntos** (`attachments?[]` omitido). |
| **Q-6** | 8 estados → lenguaje client-visible | **CONFIRMADO** | El App colapsa **8→5 server-side**; solo los 5 estados client-safe cruzan el wire (los operativos —incl. `escalated` → `under_internal_review`— nunca cruzan, alineado con denylist §8.3). NoonWeb posee el mapping **5→copy** (la copy vive en el portal §8.1, igual que el `status` del project-status read). NoonWeb espeja el enum de 5 en un **allowlist Zod + `assertNoInternalFields`** como tripwire en el receptor (mismo patrón defensivo que ya usamos en el project-status read). |
| **Q-7** | Folding del receptor de comentarios | **CONFIRMADO coexistir→backfill→retirar** | NoonWeb mergea su outbox de comentarios (Slice 1b) como el ladrillo interino; cuando §9 B.1 aterrice, el outbox evoluciona a outbox de **requests** con `type=comment` y se backfillea `project_client_messages`. Retiro del receptor plano en B.6. Estado de 1b en §5. |
| **Q-8** | Dueño del scope-eval §10 | **CONFIRMADO App dueño; forma diferida a B.3** | NoonWeb solo **muestra** el resultado dentro de la proyección client-visible. Reconocemos la dependencia §6: hasta que exista membership, el App evalúa **solo one-time** (degradación segura) y nuestra UI maneja el caso "membership no disponible" sin romper. Pendiente a co-diseñar en B.3: **cómo** surface el outcome ("requiere nueva propuesta") — ¿`clientVisibleState`, campo aparte, o reusa el flujo de propuestas existente? |
| **Q-9** | Canales de notificación | **CONFIRMADO minimal v1** | App usa `user_notifications` (staff). NoonWeb v1 = **display in-portal** del estado; el email al cliente sigue **gateado por `MAXWELL_LIFECYCLE_EMAILS`** (flag existente). Política de canales = decisión aparte (contract OPEN Q9). |
| **Q-10** | Pre-payment auth | **CONFIRMADO 100% NoonWeb** | Gate de submission: (1) cliente **autenticado** (cuenta Google / `owner_email`) + (2) proyecto **`payment_activated`**. El receptor del App mantiene su gate `payment_activated` + 404 no-revelador como **defensa en profundidad** (igual que el receptor de comentarios). |

🔴 = bloquea Architecture.

---

## 2. Refinamiento que sí pedimos cambiar (Q-4): guard de monotonía en el outbound

El outbound de estado va sobre el **ledger durable + cron retry (ADR-027)**. Eso significa que una **reentrega tardía** de un estado viejo puede llegar **después** de uno nuevo (p.ej. un `in_progress` reentregado aterriza después de `completed`) y **regresar** lo que ve el cliente.

**Pedido:** que el payload outbound incluya un campo de **orden autoritativo por request**, una de dos:
- `revision`: contador monotónico por `externalRequestId` (preferido — sin dependencia de relojes), **o**
- `stateChangedAt`: timestamp autoritativo server-side del App del cambio de estado.

NoonWeb **descarta** cualquier update cuyo `revision`/`stateChangedAt` no avance respecto del último aplicado para ese request (idempotente + monótono). Es la misma clase de bug que el receptor de comentarios pre-empató con "ordenar por server-time, no por el `at` del cliente".

**Shape outbound propuesto (con el campo agregado):**
```
POST {NOON_WEBSITE_CLIENT_REQUEST_STATE_URL}
  {
    externalRequestId,
    clientVisibleState: 'received'|'in_review'|'in_progress'|'completed'|'under_internal_review',
    revision,            // ← NUEVO: monotónico por request (o stateChangedAt)
    at                   // ISO 8601, informativo
  }
→ client-safe ONLY (sin classification reason / operational priority / escalation notes — §8.3)
```

---

## 3. Asks-back a App (desbloquean el Architecture de NoonWeb)

El doc no fija estos valores y NoonWeb **no puede tallar la UI de submission ni la validación** sin ellos:

1. **Enum de los 9 `type`** (strings canónicos). NoonWeb los usa en el selector de submission + validación inbound. Si quieren vocabulario cross-repo compartido (como `project-types`), lo declaramos en ambos lados.
2. **Enum de `clientPriority`** (valores permitidos que declara el cliente; p.ej. `low|normal|high|urgent`).
3. **`versionRef`** — qué id identifica la versión, y **de dónde sale**. ¿Es el mismo id que ya recibimos en `project-status.versions[]` (`ready_for_client_preview`)? Si sí, NoonWeb lo reusa directo; si es otro id, hay que mapearlo.
4. **Cap de `body`.** Los comentarios eran 2000 chars. ¿Mismo cap para requests, o más? NoonWeb valida (1..N, con trim) en su server action **antes** de reenviar, para que el cliente reciba un error limpio en vez de un 400 del App.

**Más (no bloquean, confirmar):**
5. **Aceptan el campo de orden** del §2 (`revision` o `stateChangedAt`).
6. **`submittedBy`** — qué identificador del cliente cruza. NoonWeb autentica por cuenta Google (`owner_email`). Proponemos mandar el **`owner_email`** del workspace (el App ya conoce al cliente por el pago) **o** un id opaco si prefieren no recibir el email. Co-decidir por privacidad/minimización.

---

## 4. Lo que construye NoonWeb (para que sepan que el consumidor es real)

- **Receptor outbound NUEVO** `POST /api/integrations/noon-app/client-request-state` — siguiendo el patrón ya en prod de `app/api/integrations/noon-app/proposal-review-decision/route.ts`: `readSignedNoonAppJson` (HMAC verify) + Zod **allowlist** + `assertNoInternalFields` + idempotencia/monotonía por `(externalRequestId, revision)`. **Reusa `NOON_WEBSITE_WEBHOOK_SECRET`** y el mismo HMAC; el App solo necesita `NOON_WEBSITE_CLIENT_REQUEST_STATE_URL` apuntando a esa ruta. **Sin secreto ni env nuevo del lado de NoonWeb.**
- **Outbox de requests** — evoluciona el outbox de comentarios de Slice 1b (`client_comment` → tabla/columnas de request): fuente de verdad local, `forwarded_at IS NULL` = dead-letter auto-auditado, `externalRequestId == id` reusado en reintentos.
- **UI de submission tipada** en el workspace autenticado (`app/[locale]/maxwell/workspace/[sessionId]`): selector de `type` + `clientPriority` + body, gateada por auth + `payment_activated` (Q-10).
- **Mapping estado→copy** (5 estados client-visible) + la **allowlist defensiva** del receptor.

---

## 5. Estado de Slice 1b (dato que el App debe saber) + secuencia

**Heads-up:** del lado de NoonWeb, el **outbox de comentarios (Slice 1b) está construido y testeado pero TODAVÍA SIN MERGE** (PR abierto, pendiente de review). El **receptor** del lado App (`/api/integrations/website/client-comment`) sí está en prod; lo que falta mergear es **nuestro emisor**. La decisión de NoonWeb es **mergear 1b** como el ladrillo interino (desbloquea el retiro de `/client/[token]`) y luego foldearlo a `type=comment` bajo §9 (Q-7).

**Secuencia propuesta:**
1. **Co-diseño (este doc):** App confirma Q-1/Q-2/Q-4 + resuelve los asks-back §3. Congelamos.
2. **App:** Architecture de B.1 contra el contrato congelado → build (inbound create + tabla mirror `client_requests` + dev-board read), en paralelo con NoonWeb.
3. **NoonWeb:** merge de 1b (interino) → receptor outbound nuevo (§4) + outbox de requests + UI de submission, contra stubs firmados hasta que los endpoints del App estén en prod.
4. **B.2…B.6** en secuencia (state machine + outbound de estado, scope-eval, version-linking, clarification round-trip + adjuntos, retiro del receptor plano), cada uno re-entrando Analysis/Architecture según haga falta.

---

## 6. Referencias

- Co-diseño origen (App): `docs/handoff-app-2026-06-15-client-requests-codesign.md`.
- Receptor de comentarios (primer ladrillo del inbound): contrato `docs/2026-06-14-app-comment-receiver-contract.md` + confirmaciones `docs/handoff-app-2026-06-14-comment-receiver-confirms.md`.
- Plan NoonWeb Fase 1: `docs/v3-client-portal-plan.md`.
- Contrato cross-repo (project-types + sanitización + denylist): `docs/cross-repo-v3-contracts-app-mirror.md`.
- Plomería verificada (NoonWeb): HMAC + outbound + inbound receivers en `lib/noon-app-integration.ts`; receptores patrón `app/api/integrations/noon-app/{proposal-review-decision,ai-mvp-milestone}/route.ts`; sanitizer `lib/security/project-isolation.ts`; keying `client_workspace.noon_app_project_id` (migración `022`).
