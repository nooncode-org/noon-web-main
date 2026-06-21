# Handoff — App → NoonWeb: client-workspace **deep-link** es ZERO-BUILD — confirmen lectura + 2 detalles operativos

**Fecha:** 2026-06-21
**Para:** equipo **NoonWeb** (`noon-web-main`) — dev o sesión de agente.
**De:** App-nooncode.
**Estado:** **NoonWeb NO tiene que construir nada.** La App puede construir el deep-link al workspace por sí sola a partir de un id que ya posee. Este doc (a) les muestra qué leímos de su propio código para llegar a esa conclusión, (b) pide que confirmen que lo leímos bien, y (c) hace 2 preguntas operativas chicas. **Cero cambio de contrato. Cero env/secreto nuevo de ningún lado.**

> Contexto: esto destraba **D1 Part B** del lado App — migrar el botón staff "Enlace de cliente" desde el portal legacy anónimo (`/client/[token]`) hacia el **workspace autenticado** de NoonWeb, y retirar el legacy. Invariante: el cliente vive 100% en NoonWeb (ADR-010); el vendedor es interno y solo comparte el link.

---

## 0. TL;DR

| # | Pregunta | Respuesta que tenemos (de SU código) | Qué les pedimos |
|---|---|---|---|
| 1 | ¿Con qué id se direcciona `/maxwell/workspace/{sessionId}`? | **`studio_session.id`** — que es **idéntico** al `external_session_id` que ustedes nos mandan en el prototype-share. | **Confirmen** que leímos bien (§2). |
| 2 | ¿La App necesita que expongan un `workspaceUrl`? | **NO.** El URL es determinístico desde `external_session_id`. | Nada. (Solo confírmenlo.) |
| 3 | ¿El path lleva prefijo de locale? | La ruta es `app/[locale]/maxwell/workspace/[sessionId]` → parece requerir `/{locale}/...`. | **Pregunta operativa A (§4).** |
| 4 | ¿Cuál es el host de producción del workspace? | Lo derivamos del env que ya tenemos del lado App (el origin de NoonWeb que ya usamos para signed-reads/attachments). | **Pregunta operativa B (§4).** |

---

## 1. Qué va a construir la App (Part B) — para que tengan el contexto

1. El botón staff **"Enlace de cliente"** dejará de generar un token anónimo legacy y pasará a construir el deep-link:
   `https://{noonweb-host}/{locale}/maxwell/workspace/{external_session_id}`
   donde `external_session_id` es el `studio_session.id` que ya guardamos en `prototype_workspaces.external_session_id` desde el prototype-share (ADR-028).
2. Si el proyecto **no tiene** `external_session_id` (puro sales-led / sin prototipo Maxwell → no hay `studio_session` → no hay workspace), la App **esconde el botón** (no manda al cliente a la nada). Esto lo decide la App sola con su propio dato.
3. La App **retira** el portal anónimo legacy (`/client/[token]` + sus tablas/cron/endpoints). Esto es 100% del lado App; **NoonWeb no toca nada.**

---

## 2. Qué leímos de SU código (confirmen que es correcto)

Evidencia (rutas en `noon-web-main`):
- **Ruta:** `app/[locale]/maxwell/workspace/[sessionId]/page.tsx` — param dinámico `sessionId` (líneas 48, 324).
- **Lookup:** `getStudioSession(sessionId)` → `SELECT * FROM studio_session WHERE id = ${id} AND deleted_at IS NULL` (`lib/maxwell/repositories.ts:626`). El `sessionId` del URL **se matchea contra `studio_session.id`**.
- **Workspace:** `getClientWorkspaceBySession(sessionId)` → `SELECT … FROM client_workspace WHERE studio_session_id = ${id}` (UNIQUE en `studio_session_id`, 1 workspace por sesión) (`lib/maxwell/repositories.ts:1521`; migración `20260406_001_harden_maxwell_schema.sql:384`).
- **El mismo id que nos mandan:** en prototype-share y en payment-confirmed ustedes envían `external_session_id = studio_session.id` (`lib/maxwell/prototipo-share.ts:181`, `lib/noon-app-integration.ts:379,446`). Ese es el valor que la App persiste como `prototype_workspaces.external_session_id` (App ADR-028, migración 0063).
- **Auth de la ruta (owner-only):** sin login → redirect a sign-in con `next` de vuelta al workspace; luego `viewerOwnsStudioSession` exige `viewer.email == studio_session.ownerEmail` (case-insensitive), si no → `notFound()` (`app/[locale]/maxwell/workspace/[sessionId]/page.tsx:325-334`, `lib/auth/ownership.ts`).

**→ Verdicto App:** el deep-link es `…/maxwell/workspace/{external_session_id}`, zero-build. El owner-only nos da el modelo de seguridad que justifica retirar el token anónimo (solo el dueño autenticado ve el workspace).

**CONFIRMEN (P1):** ¿`studio_session.id` seguirá siendo el id que direcciona la ruta del workspace (no van a migrar a indexar por `client_workspace.id` u otro)? Si planean cambiarlo, avísennos — romperíamos el deep-link.

---

## 3. Bordes que ya cubrimos del lado App (no requieren acción de NoonWeb)

- **Proyecto sin workspace:** la App esconde el botón cuando no hay `external_session_id` (no hay `studio_session`). Confirmamos en su código que **no existe `client_workspace` sin `studio_session`** (se crea en payment-activation keyeado por `studio_session_id`).
- **Workspace aún sin pago:** el deep-link apunta igual; su ruta hace login + owner-check y resuelve el estado. La App solo comparte links de proyectos ya convertidos (post-pago), así que el `client_workspace` existirá.

---

## 4. Las 2 preguntas operativas (lo único que necesitamos de ustedes)

- **P-A (locale):** la ruta vive bajo `app/[locale]/…`. ¿Su middleware **redirige** un path sin locale (`/maxwell/workspace/{id}`) al locale por defecto, o la App **debe** incluir el prefijo? Si debe incluirlo, ¿cuál default usamos para un cliente (`es`? `en`?), o existe una forma locale-less canónica que prefieran que usemos?
- **P-B (host):** ¿cuál es el **host de producción** exacto del workspace para construir el URL absoluto? (La App ya tiene un origin de NoonWeb en env desde los signed-reads/attachments; queremos confirmar que es el mismo host público donde corre `/maxwell/workspace`, y no un host de integración distinto.)

---

## 5. Resumen de acciones

- **NoonWeb:** responder P1 (confirmación), P-A (locale) y P-B (host). **No construir nada.** Si en el futuro cambian el id de routing del workspace, es un breaking change cross-repo — coordinar.
- **App:** con esas 3 respuestas, construye el deep-link, esconde el botón cuando no hay workspace, y retira el portal legacy (todo App-side, sin cambio de contrato).
