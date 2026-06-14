# Handoff — NoonWeb → App: confirmaciones del receptor de comentarios

**Fecha:** 2026-06-14
**Para:** quien trabaje **App-nooncode** — dev o sesión de agente.
**De:** NoonWeb (`noon-web-main`), en respuesta a
`noon-web-main/docs/2026-06-14-app-comment-receiver-contract.md`.
**Objetivo:** cerrar el ciclo del receptor de comentarios — NoonWeb **acepta el
contrato tal cual**, responde sus 4 asks (§3) y manda 3 refinamientos menores. Con
esto **ambos wires de Fase 1 quedan congelados** y ambos lados pueden construir.

> Auto-contenido. El plan de consumo de NoonWeb está en
> `noon-web-main/docs/v3-client-portal-plan.md` §3.3.

---

## 0. TL;DR

- **Receptor aceptado y congelado.** La Opción B (`project_client_messages`
  project-keyed) resuelve limpio el wrinkle de schema; el surface al developer/team
  es una mejora bienvenida (cierra el agujero del interino donde nadie del staff
  veía los mensajes).
- **4 asks respondidos** (§1). Todos verdes, sin cambios al contrato.
- **3 refinamientos** (§2) — sugerencias, no bloquean su Backend.

---

## 1. Respuestas a sus 4 asks (§3 de su doc)

1. **`externalCommentId` estable y único → Sí.** NoonWeb lo genera **una vez** como
   el id de la fila del outbox local (`client_comment.id`) y lo reusa **idéntico**
   en cada reintento. Nunca se regenera. Pueden confiar en él como llave de
   idempotencia.
2. **`at` en ISO 8601 → Sí.** Mandamos el timestamp de captura del cliente en ISO.
   Entendido que del lado App el `created_at` es server-`now()` (ver refinamiento
   §2.2 sobre cuál usar para ordenar).
3. **`body` cap 2000 → OK.** Espejamos el cap. NoonWeb valida `body` (1..2000, con
   trim) en su server action **antes** de reenviar, así el cliente recibe un error
   limpio en vez de un 400 del App.
4. **`commentId` de vuelta → Sí, lo persistimos.** Lo guardamos en el outbox para
   reconciliación/audit (marca "reenviado OK"). El display de Fase 1 sale de la
   tabla local, no de ese id, pero el `commentId` nos sirve para confirmar entrega.

---

## 2. Refinamientos (sugerencias, no bloquean)

### 2.1 El rate-limit del cliente lo hace NoonWeb
El receptor es **server-to-server** (confía en el HMAC de NoonWeb), así que el
límite anti-spam del *cliente* va en **nuestro** server action de envío, no en el
endpoint del App. Lo decimos explícito para que no asuman que deben cubrirlo ahí.
(Un rate-limit defensivo por `projectId`/IP del lado App está bien igual, pero la
contención real del cliente es responsabilidad de NoonWeb.)

### 2.2 Ordenar el display de staff por `created_at` server, no por `at` cliente
Para que un reloj desfasado del cliente no reordene ni futur-feche mensajes en el
project-detail, sugerimos que la sección read-only de staff ordene por el
`created_at` server-`now()` del App, no por el `at` que mandamos. (Guardar `at`
está bien como dato del cliente; solo no usarlo como orden.)

### 2.3 UX de fallo permanente de reenvío (limitación conocida, compartida)
Si un reenvío da 4xx (p.ej. `projectId` sin `payment_activated`), el retry de
NoonWeb **no** reintenta (4xx = determinista) y el comentario queda solo local +
audit `noon_app_*_failed`. Es un edge raro (un workspace con `projectId` ya pagó),
pero lo dejamos anotado como limitación conocida de Fase 1 en ambos lados. No
requiere acción suya; solo alineación.

---

## 3. Qué construye NoonWeb (Slice 1b)

- Tabla local `client_comment` (outbox: `id`, `workspace_id`, `body`,
  `external_comment_id`, `forwarded_at`, `created_at` + el `commentId` devuelto).
- UI de captura en el workspace autenticado + server action → reenvío al receptor
  §1 con `postNoonAppWebhook` (retry/backoff; degrada a audit si el App 5xx).
- Display del log del cliente desde la tabla local (el status read no trae
  comentarios; no se necesita).
- NoonWeb puede construir todo el slice contra **stubs firmados** y activar el
  reenvío real cuando el endpoint esté en prod.

---

## 4. Estado — ambos wires congelados

| Wire | Estado | App | NoonWeb |
|---|---|---|---|
| project-status read (§6A) | **congelado** (camelCase intencional, `projectId==projects.id`) | Chunk A Architecture-Ready | Slice 1a |
| client-comment receptor | **congelado** (Opción B, idempotencia, 2000 cap) | spec `v3-client-portal-comment-receiver.md` | Slice 1b |

**Secuencia:** App entrega ambos endpoints (iteraciones propias) ∥ NoonWeb
construye 1a+1b contra stubs → 1a+1b en prod → NoonWeb Slice 1c + App retira
`/client/[token]` (cleanup D1).

---

## 5. Referencias

- Plan NoonWeb (§3.3 receptor congelado): `noon-web-main/docs/v3-client-portal-plan.md`.
- Respuesta App (receptor): `noon-web-main/docs/2026-06-14-app-comment-receiver-contract.md`.
- Co-sign origen NoonWeb: `noon-web-main/docs/handoff-app-2026-06-14-client-portal-v3-cosign.md`.
- Spec App (receptor): `App-nooncode/specs/v3-client-portal-comment-receiver.md`.
