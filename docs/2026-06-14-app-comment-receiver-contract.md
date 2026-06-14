# Handoff — App → NoonWeb: client-comment receiver (response to co-sign Ask #2)

**Fecha:** 2026-06-14
**Para:** quien trabaje **NoonWeb** (`noon-web-main`) — dev o sesión de agente.
**De:** App-nooncode, en respuesta a `noon-web-main/docs/handoff-app-2026-06-14-client-portal-v3-cosign.md` §2.
**Objetivo:** cerrar el contrato del **receptor de comentarios interino** (Camino A) para que NoonWeb construya su **Slice 1b** en paralelo.

> Auto-contenido. El App scopeó esto en `App-nooncode/specs/v3-client-portal-comment-receiver.md`.

---

## 0. TL;DR

1. **Receptor aceptado tal cual lo propusieron** (Camino A). Contrato exacto en §1 — construyan Slice 1b contra esto.
2. **El App eligió Opción B** (tabla sucesora project-keyed `project_client_messages`), NO modificar `client_comments`. Transparente para NoonWeb — la entrada sigue siendo `projectId`.
3. **Novedad relevante para su UX:** el App **sí va a surfacear** los mensajes al developer/team asignado (sección read-only en project-detail), porque el spec (§9.2) exige que el mensaje del cliente *llegue al equipo*. Hoy `client_comments` no lo veía nadie del staff; lo arreglamos. Detalle §2.
4. **Recordatorio:** el §6A project-status read ya quedó **co-firmado** (camelCase intencional + `projectId == projects.id`). Ese contrato no cambia.

---

## 1. Contrato del receptor (construyan Slice 1b contra esto)

```
POST /api/integrations/website/client-comment
headers:
  x-noon-timestamp: <unix seconds>
  x-noon-signature: sha256=<HMAC(NOON_WEBSITE_WEBHOOK_SECRET, "${timestamp}.${body}")>
body (JSON):
  {
    "projectId":        "<uuid>",   // = projects.id (el que ya guardan en client_workspace.noon_app_project_id)
    "externalCommentId":"<string>", // SU llave de idempotencia (única por comentario)
    "author":           "client",
    "body":             "<string>", // <= 2000 chars (mismo cap que el portal interino)
    "at":               "<ISO 8601>"
  }
→ 200 { "idempotent": false, "commentId": "<uuid>", "requestId": "<id>" }   // primer envío
→ 200 { "idempotent": true,  "commentId": "<uuid>", "requestId": "<id>" }   // replay (mismo externalCommentId)
```

- **Auth:** HMAC idéntico a los otros wires (mismo secreto, ±5min skew, `${timestamp}.${body}`). Sin env var nueva.
- **Idempotencia:** dedupe por `externalCommentId` (UNIQUE del lado App). Reenvíen con retry/backoff sin miedo: un duplicado devuelve `idempotent:true` + el mismo `commentId`.
- **Gate:** el `projectId` debe existir y estar `payment_activated`; si no, el App rechaza (4xx) **sin escribir** y **sin revelar** existencia.

### Errores
| Código | Caso |
|---|---|
| `401` | HMAC inválido/ausente/fuera de ventana |
| `400` | body malformado / inválido |
| `404`/`409` | projectId inexistente o no `payment_activated` (no-revelador) |
| `503` | secret no configurado (no debería pasar en prod) |
| `500` | interno |

> Casing: el body del receptor es **camelCase** (`projectId`, `externalCommentId`), consistente con la familia de reads (`prototype-signed-read`, `project-status`). Los webhooks POST viejos eran snake_case; los nuevos wires v3 van camelCase.

---

## 2. Qué hace el App con el mensaje (para que sepan que NO es un agujero negro)

- Persiste en una tabla nueva **`project_client_messages`** (project-keyed, D1-clean — no toca `client_access_tokens`, que se retira).
- **Lo surface al developer/team asignado** en una sección read-only "Mensajes del cliente" en project-detail. Esto es **nuevo**: hoy nadie del staff veía `client_comments`. Lo hacemos porque el spec §9.2 exige que el mensaje del cliente *llegue al equipo asignado*.
- **Fase 1 = sin respuesta de staff dentro del portal** (igual que el interino). El staff lee; no responde por el portal todavía. La conversación bidireccional + clasificación/estados llega con el **§9 request system** (Chunk B), que **supersede** este receptor plano (`client-requests.md`: el comment plano es "intentionally narrower").
- Por eso este receptor es un **peldaño interino**, no la versión final. Cuando §9 aterrice, esta tabla evoluciona/se reemplaza.

---

## 3. Asks de vuelta a NoonWeb (confírmenlos antes de su Slice 1b)

1. **`externalCommentId` estable y único** por comentario del cliente (es la llave de idempotencia). Confirmen que no se regenera en reintentos.
2. **`at`** en ISO 8601 (el App lo guarda como el timestamp del cliente; el `created_at` del lado App es server-`now()`).
3. **`body` cap 2000 chars** (paridad con el portal interino) — ¿les sirve, o necesitan más?
4. **¿Necesitan el `commentId` de vuelta** para algo (reconciliación en su outbox)? Lo devolvemos siempre; confírmen si lo persisten o lo ignoran.

---

## 4. Secuencia

1. **App:** ship del receptor + tabla (Backend) — desbloquea su Slice 1b. (El surface de staff es App-interno, va en paralelo, no los bloquea.)
2. **NoonWeb:** Slice 1b (outbox local + reenvío al receptor) contra el contrato §1, con stubs firmados hasta que el endpoint esté en prod.
3. **NoonWeb Slice 1c + App retira `/client/[token]`** (cleanup D1), gateado por 1a (project-status read) + 1b (comments) en prod.

---

## 5. Referencias

- Spec App (receptor): `App-nooncode/specs/v3-client-portal-comment-receiver.md`.
- Co-sign origen NoonWeb: `noon-web-main/docs/handoff-app-2026-06-14-client-portal-v3-cosign.md`.
- Contrato cross-repo (project-status §6A co-firmado): `App-nooncode/docs/integrations/cross-repo-webhook-v1.md`.
- Plan NoonWeb: `noon-web-main/docs/v3-client-portal-plan.md`.
- Spec §9 / `client-requests.md` (el target final que supersede este interino): `App-nooncode/docs/product/master-spec-v3.md` §9 + `App-nooncode/docs/contracts/client-requests.md`.
