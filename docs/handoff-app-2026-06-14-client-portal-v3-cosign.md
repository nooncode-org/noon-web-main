# Handoff — NoonWeb → App: co-firma del contrato v3 client portal + ask del receptor de comentarios

**Fecha:** 2026-06-14
**Para:** quien trabaje **App-nooncode** — dev o sesión de agente.
**De:** NoonWeb (`noon-web-main`), tras perfilar el handoff
`App-nooncode/docs/handoffs/2026-06-14-noonweb-client-portal-v3-handoff.md` y
revisar el spec `App-nooncode/specs/v3-client-portal-app-side-feed.md`.
**Objetivo:** cerrar el contrato cross-repo de Fase 1 para que ambos lados puedan
construir en paralelo. NoonWeb ya verificó el lado App contra el schema real
(`migrations 0004/0005/0069`, `database.types.ts`) y aterrizó su plan de consumo
en `noon-web-main/docs/v3-client-portal-plan.md`.

> Auto-contenido: las dos peticiones de abajo no requieren leer el repo NoonWeb.

---

## 0. TL;DR — dos asks

1. **Co-firma del project-status signed-read.** NoonWeb acepta la forma de
   respuesta que ya definieron (Architecture-Ready). Una sola nota a confirmar:
   el **casing** (camelCase bajo `data`) y la igualdad de `projectId`. Detalle §1.
2. **Tallar un receptor de comentarios interino (Camino A).** Hoy lo tienen en
   Chunk B; NoonWeb lo necesita en Fase 1 para no retirar `/client/[token]` con
   regresión. Contrato + wrinkle de schema en §2.

---

## 1. Ask #1 — Co-firma del project-status signed-read

NoonWeb **acepta tal cual** el contrato de
`App-nooncode/specs/v3-client-portal-app-side-feed.md` (Architecture §A/§B):

- `GET /api/integrations/website/project-status/[projectId]`, HMAC body-vacío
  (`${timestamp}.`), ±5min, rate-limit 60/min antes del HMAC, cache
  `private, max-age=30`. Espejo 1:1 de `prototype-signed-read`. ✔ consumible.
- Respuesta `{ "data": { project, proposal, payment, versions[], latestUpdate },
  "requestId" }`. NoonWeb mapea `status` (enum crudo) → label en su lado (la copy
  vive en el portal, §8.1). ✔
- `versions[]` solo `ready_for_client_preview`, `latestUpdate` como marcador de
  `status_changed` sin texto libre. ✔ NoonWeb no espera más en v1.
- Denylist §8.3 (de su Architecture §B): NoonWeb la **espeja** en su
  `assertNoInternalFields` defensivo. Coordinar adiciones por
  `noon-web-main/docs/cross-repo-v3-contracts-app-mirror.md`.

**Dos puntos a confirmar antes de su Backend (cambiarlos después cuesta):**

- **(a) Casing.** El read usa **camelCase bajo `data`**, mientras los webhooks
  existentes entre repos son **snake_case** (`external_session_id`, `project_id`,
  `version_url`). NoonWeb se conforma a lo que decidan — solo confirmen que el
  camelCase es intencional y no un descuido. Si prefieren snake_case por
  consistencia de wire, es el momento de cambiarlo.
- **(b) Igualdad de `projectId`.** NoonWeb keyea el read con el `projectId` que
  recibió en la respuesta de `payment-confirmed` y guardó en
  `client_workspace.noon_app_project_id` (helper `extractNoonAppProjectId`).
  Confirmen que ese id **es** `projects.id` (el que usa el endpoint de status).
  Si hubiera un id intermedio, hay que mapearlo.

NoonWeb se compromete a construir el consumidor (Slice 1a) contra esta forma, con
stubs firmados en tests hasta que el endpoint esté en prod.

---

## 2. Ask #2 — Receptor de comentarios interino (Camino A)

**Por qué.** El portal interino `/client/[token]` deja al cliente postear mensajes
(`app/api/client/comments/route.ts` + tabla `client_comments`; todos son del
cliente, no hay respuesta de staff dentro del portal). Retirar ese portal sin
write-back equivale a **quitarle al cliente el recuadro de mensajes** = regresión.
Su propio spec (§4) ya contempló esto: *"si NoonWeb shipea un portal Fase-1 que
necesita comment write-back antes del request system, se puede tallar un receptor
interino mínimo como spec aparte."* **Esa es la decisión:** tallarlo.

**Contrato propuesto (server-to-server, mismo HMAC que los otros wires):**

```
POST /api/integrations/website/client-comment
headers: x-noon-timestamp, x-noon-signature   (HMAC sobre ${timestamp}.${body})
body:    { "projectId", "externalCommentId", "author": "client", "body", "at" }
→ 200 { "idempotent": false, "commentId": "..." }
```

- NoonWeb captura local (outbox) + reenvía con retry/backoff; degrada a audit si
  el App 5xx.
- `externalCommentId` es la llave de **idempotencia** (de-dupear por ella).
- Sin respuesta de staff dentro del portal en Fase 1 (igual que el interino); eso
  llega con §9.

**Wrinkle de schema que los devs del App deben resolver:** `client_comments` está
keyeada por `token_id` (FK a `client_access_tokens`). El flujo nuevo **no tiene
token** — viene por `projectId`. Insertar un comentario projectId-keyed en una
tabla token-keyed no encaja sin uno de estos:
- agregar columna nullable `project_id` (+ `external_comment_id`) a
  `client_comments` y hacer `token_id` nullable, **o**
- una tabla sucesora chica project-keyed (p.ej. `project_client_messages`:
  `project_id`, `body`, `source='website'`, `external_comment_id`, `created_at`)
  que el board de delivery lea.

NoonWeb no opina cuál — solo señala que **el receptor no es un "insert directo en
`client_comments`"**. Lo deciden los devs del App al tallar su spec. Lo importante
para el contrato es que la entrada sea `projectId` (no token), para nacer
D1-limpio (sin acoplarse a la tabla que se retira).

---

## 3. Qué construye NoonWeb (para que sepan que el consumidor es real)

Plan completo en `noon-web-main/docs/v3-client-portal-plan.md`. Fase 1:

- **Slice 1a** — consumidor del project-status read (Ask #1) dentro del workspace
  autenticado `/maxwell/workspace/[sessionId]` (auth Google + `owner_email`).
- **Slice 1b** — outbox local de comentarios + reenvío al receptor (Ask #2).
- **Slice 1c** — handshake de retiro: el link al cliente apunta a NoonWeb; gatilla
  el cleanup D1 del lado App.

El cliente nunca toca el App interno (§2.1). El acceso es por **cuenta Google**
existente (decisión NoonWeb), no por token firmado.

---

## 4. Secuencia

0. Co-firmar §1 (casing + igualdad de projectId). — *bloquea Backend del App*
1. App: ship Chunk A (project-status read) + tallar receptor de comentarios (§2).
2. NoonWeb: Slice 1a + 1b contra el contrato (paralelo a 1).
3. NoonWeb Slice 1c + App retira `/client/[token]` (cleanup D1), gateado por 1a+1b
   en prod.

---

## 5. Referencias

- Plan NoonWeb: `noon-web-main/docs/v3-client-portal-plan.md`.
- Contrato cross-repo (project-types + sanitización): `noon-web-main/docs/cross-repo-v3-contracts-app-mirror.md`.
- Spec App (feed): `App-nooncode/specs/v3-client-portal-app-side-feed.md`.
- Handoff origen App: `App-nooncode/docs/handoffs/2026-06-14-noonweb-client-portal-v3-handoff.md`.
- Patrón signed-read: `App-nooncode/app/api/integrations/website/prototype-signed-read/[token]/route.ts`.
- Sanitización App: `App-nooncode/lib/security/project-isolation.ts`.
