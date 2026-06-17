# Handoff — Co-design: v3 Client-Request System (§9) — App ↔ NoonWeb

**Fecha:** 2026-06-15
**Para:** equipos **NoonWeb** (`noon-web-main`) y **App** (`App-nooncode`).
**De:** App-nooncode (system-analysis). Input: `App-nooncode/specs/v3-client-requests-system.md`.
**Objetivo:** **abrir el co-diseño** del sistema §9 de client-requests. NO es un contrato congelado — es la agenda de decisiones que ambos repos tienen que co-firmar **antes** de que cualquiera entre a Architecture. (Mismo patrón que el receptor de comentarios: el App propone, NoonWeb confirma/ajusta, congelamos, construimos en paralelo.)

> Auto-contenido. Funda: `App-nooncode/docs/contracts/client-requests.md` + master-spec-v3 §9/§10/§22/§11.

---

## 0. TL;DR

1. §9 reemplaza el buzón plano de comentarios por un **request tipado con estado** (9 tipos, 8 estados, prioridad operativa, scope-eval, escalación, version-linking). Un comentario pasa a ser un request `comment/clarification`.
2. La entidad es **portal-owned (NoonWeb)** pero **el trabajo pasa en el App** (dev board, §11). Eso fuerza un **wire bidireccional** y una decisión de **source-of-truth**.
3. **Propuesta del App (a co-firmar):** NoonWeb es dueño del **contenido enviado** + la **proyección client-visible**; el App es dueño del **estado operativo** (clasificación/estado/asignación). NoonWeb **empuja** (mirror) cada request al App; el App **devuelve** los cambios de estado client-visible.
4. 10 asks abajo (§5). Las que **bloquean Architecture**: Q-1 (SoT), Q-2 (mirror vs read-through), Q-4 (shapes del wire).

---

## 1. El problema de diseño (por qué necesita co-diseño)

`client_request` es **portal-owned y project-scoped** (`client-requests.md`). Pero los consumidores primarios son **del lado App**: el developer/team asignado clasifica, prioriza, ejecuta y completa en el dev board (§9.2/§11), con oversight de PM/Admin (§9.3). Entonces:

- El cliente **envía** desde el portal (NoonWeb) → el request nace en **Received**.
- El **trabajo y las transiciones de estado** pasan en el App.
- El portal tiene que **mostrar** el estado client-visible (§22.2: received / in progress / completed).

⇒ Hace falta decidir **quién es dueño de qué** y **cómo viaja la info en ambas direcciones**.

## 2. Propuesta de modelo (App propone — NoonWeb co-firma)

| Concern | Dueño propuesto |
|---|---|
| `request id` (identidad) | **NoonWeb** mina el id; el App guarda `external_request_id` (UNIQUE), como `external_comment_id` |
| Contenido enviado por el cliente (texto, tipo declarado, prioridad declarada, adjuntos) | **NoonWeb** (source) |
| **Estado operativo** (los 8 estados §9.4, clasificación, operational priority, assignee, escalation log) | **App** (system of record) |
| Proyección **client-visible** del estado (lenguaje simple, Escalated → "Under internal review") | **NoonWeb** (renderiza, desde lo que el App emite) |
| Scope-eval §10 (one-time vs membership, scope decision basis) | **App** (tiene proposal/payment data) |
| Almacenamiento de adjuntos | **NoonWeb** (storage); el App guarda **punteros**, no hostea archivos |

**Regla direccional (evita loops de estado, R-1):** el **inbound** trae **contenido** (crear/aclarar/adjuntar); el **outbound** lleva **estado client-visible**. El estado operativo nunca lo escribe NoonWeb; el contenido enviado nunca lo reescribe el App.

## 3. El wire bidireccional (borrador — a co-diseñar en detalle, Q-4)

Mismo envelope HMAC que todos los wires (`NOON_WEBSITE_WEBHOOK_SECRET`, `x-noon-timestamp` + `x-noon-signature`, ±5min, idempotencia por id estable). camelCase (familia v3).

**Inbound (NoonWeb → App)**
```
POST /api/integrations/website/client-request           # crear
  { externalRequestId, projectId, submittedBy, type, clientPriority, body, at, attachments?[], versionRef? }
POST /api/integrations/website/client-request-update     # aclaración del cliente / adjunto nuevo
  { externalRequestId, kind: 'clarification'|'attachment', body?|attachment?, at }
→ idempotente por externalRequestId (+ updateId); gate payment_activated; 404 no-revelador.
```

**Outbound (App → NoonWeb)** — riding el ledger durable + cron retry (ADR-027)
```
POST {NOON_WEBSITE_CLIENT_REQUEST_STATE_URL}             # cambio de estado client-visible
  { externalRequestId, clientVisibleState: 'received'|'in_review'|'in_progress'|'completed'|'under_internal_review', at }
→ client-safe ONLY (sin classification reason / operational priority / escalation notes — §8.3).
```

> El receptor de comentarios actual (`POST /api/integrations/website/client-comment` → `project_client_messages`) **es el primer ladrillo del inbound**: evoluciona a `client-request` con `type='comment'`. Folding en B.6 (Q-7).

## 4. Cómo se mapea a chunks (build en paralelo, como el receptor)

- **B.1** — inbound create + tabla mirror `client_requests` + dev-board read (Received). *(El App lo puede construir contra este contrato propuesto mientras NoonWeb arma su lado.)*
- **B.2** — state machine (§9.4) en el dev board + outbound de estado client-visible + activity log (§22.1).
- **B.3** — scope-eval (§10) + escalación (§9.3) a PM/Admin.
- **B.4** — version-linking (request ↔ `project_version`).
- **B.5** — Needs-Clarification round-trip + adjuntos.
- **B.6** — retiro del receptor interino (fold `project_client_messages`).

## 5. Asks a NoonWeb (confírmenlos / ajústenlos — esto desbloquea Architecture)

| # | Ask | Propuesta App |
|---|---|---|
| **Q-1** 🔴 | **Source of truth del estado** | App = estado operativo; NoonWeb = contenido + proyección client-visible |
| **Q-2** 🔴 | **Transporte: mirror (push) vs read-through** | Mirror — NoonWeb empuja create/update; el App materializa local |
| **Q-3** | Identidad del request | NoonWeb mina `request id`; App guarda `external_request_id` UNIQUE |
| **Q-4** 🔴 | **Shapes del wire** (inbound create/update + outbound state) | Borrador §3 — co-diseñar campos |
| **Q-5** | Adjuntos: storage + referencia | NoonWeb hostea; App guarda puntero (signed URL / id) |
| **Q-6** | Mapeo de los 8 estados → lenguaje client-visible | App manda canónico; NoonWeb mapea para display |
| **Q-7** | Folding del receptor de comentarios | Coexistir → backfill `type=comment` → retirar (B.6) |
| **Q-8** | Dueño del scope-eval §10 | App (tiene proposal/payment); NoonWeb muestra el resultado. Definir shape de membership cuando exista |
| **Q-9** | Scope de canales de notificación (contract OPEN Q9) | v1: reusar `user_notifications`; política de canales → decisión aparte |
| **Q-10** | Re-confirmar pre-payment auth | 100% de NoonWeb (request solo en proyecto activado + cliente autenticado) |

🔴 = bloquea Architecture.

## 6. Dependencia importante que NoonWeb debe saber

El **scope-eval §10** (one-time vs membership) depende de data de **membership que está en gran parte SIN construir** del lado App. Hasta que el producto de membership exista, el App evalúa **solo one-time** (degradación segura). La escalación §9.3 "requires new proposal" usa el flujo de propuestas existente, no se reconstruye acá.

## 7. Secuencia

1. **Co-diseño (este doc):** NoonWeb responde Q-1…Q-10. Congelamos Q-1/Q-2/Q-4.
2. **App:** Architecture de B.1 contra el contrato congelado → build (inbound + mirror + dev-board read), en paralelo con NoonWeb.
3. **NoonWeb:** UI de submission + materialización del request + consumidor del outbound de estado.
4. Chunks B.2…B.6 en secuencia, cada uno re-entrando Analysis/Architecture según haga falta.

## 8. Referencias

- App Analysis (este input): `App-nooncode/specs/v3-client-requests-system.md`.
- Contrato de entidad: `App-nooncode/docs/contracts/client-requests.md` (+ OPEN markers Q2/Q5 ya resueltos: portal=NoonWeb, pre-payment auth=NoonWeb).
- Master-spec: `docs/product/master-spec-v3.md` §9 / §10 / §22 / §11; flows §7 (Client request flow).
- Sibling: `docs/contracts/project-versions.md` (version-linking).
- Receptor interino (primer ladrillo del inbound): `App-nooncode/specs/v3-client-portal-comment-receiver.md` + cross-repo `docs/integrations/cross-repo-webhook-v1.md` §5B.
- Wire cross-repo: `App-nooncode/docs/integrations/cross-repo-webhook-v1.md` (acá aterrizan las nuevas secciones bidireccionales).
