# Spec — Slice 1d: Re-entrada al client workspace desde Studio (A + B)

**Fecha:** 2026-06-17
**Repo:** `noon-web-main` (NoonWeb).
**Tipo:** follow-on de Fase 1 del v3 client portal (`docs/v3-client-portal-plan.md`).
**Dependencia del App:** **ninguna.** Slice 100% NoonWeb. Sin migración, sin env ni
secreto nuevo.

> Auto-contenido: trae el porqué, el estado verificado contra el código, el diseño,
> los archivos a tocar y los tests. Los devs pueden tomarlo en una branch.

---

## 1. Contexto y por qué

Hoy el cliente solo llega a su **client workspace** post-pago
(`/{locale}/maxwell/workspace/{sessionId}` — donde vive la sección **"Messages"**,
los updates, el preview AI-MVP y, gateado, el `RequestBox`) por **un único canal:
el email "Workspace ready"** (B8 #3, `buildWorkspaceUrl` en `lib/maxwell/public-url.ts`).
No hay forma de volver desde el sitio: no existe un dashboard de proyectos, y si el
cliente cierra/pierde el correo, se queda sin puerta de entrada.

El cliente **ya tiene auth y un hub de retorno**: `/{locale}/maxwell/studio` sin
parámetros y con sesión iniciada es el **hub "Your chats"** (`app/[locale]/maxwell/studio/page.tsx:45-47`),
que lista las sesiones del dueño vía `GET /api/maxwell/studio/sessions`
(`listStudioSessionsForOwner`). El client workspace usa **el mismo `sessionId`** y el
**mismo gate de dueño por email** (`viewerOwnsStudioSession`) que la sesión de Studio
— quien ve su chat ya pasa el gate del workspace. No hace falta modelo de acceso
nuevo: solo **superficiar el link**.

**Objetivo:** que el cliente llegue a su client workspace desde el chat, dejando al
email como conveniencia/notificación y no como única puerta. Esto **completa la
historia de Slice 1c** (retiro de `/client/[token]`): al volverse el workspace LA
superficie del cliente, que sea alcanzable deja de ser opcional.

---

## 2. Aclaración de nombres (no confundir — riesgo real)

En el código de Studio conviven dos "workspace" distintos:

| Término | Qué es | Señal |
|---|---|---|
| **Preview/"workspace" de Studio** | el panel chat+preview del prototipo v0 dentro de `StudioShell`; el prop `hasWorkspace` del `StudioHeader`/`StudioShell` (`components/maxwell/studio-header.tsx:158`, ViewToggle) se refiere a **esto** | hay prototipo v0 renderizable |
| **Client workspace (post-pago)** | la página `/{locale}/maxwell/workspace/{sessionId}` con Messages/updates/requests; fila en la tabla `client_workspace` | `getClientWorkspaceBySession(sessionId) != null` |

**Este slice trabaja sobre el segundo.** El prop `hasWorkspace` existente **NO se toca
ni se reusa**: se introduce una señal nueva y nombrada aparte
(`hasClientWorkspace`) para evitar el solapamiento semántico.

---

## 3. Alcance

**Entra (A + B):**
- **A** — En la lista **"Your chats"** (popover del `StudioHeader`): cada fila cuya
  sesión tenga un client workspace provisionado muestra un acceso **"Open workspace →"**
  que navega a `/{locale}/maxwell/workspace/{sessionId}`.
- **B** — Dentro del chat de la sesión **activa**: cuando esa sesión tiene client
  workspace, un **banner** en la columna del chat con el mismo CTA.

**No entra (futuro, ver §10):** ítem de nav global "My projects"; superficiar
sesiones en estado "preparing" (pago registrado pero workspace aún no provisionado);
deep-link a la sección Messages; badges de "nuevos mensajes/updates".

---

## 4. Estado actual verificado (contra código, no inferido)

| Pieza | Dónde | Nota |
|---|---|---|
| Hub "Your chats" (signed-in, sin params) | `app/[locale]/maxwell/studio/page.tsx:45-47` | ya existe |
| Endpoint lista de sesiones del dueño | `app/api/maxwell/studio/sessions/route.ts` (`GET`) → `listStudioSessionsForOwner` (`lib/maxwell/repositories.ts:628`) | payload allowlisteado a mano + `assertNoInternalFields` (dev/CI) |
| Carga en cliente | `StudioShell`: `fetch("/api/maxwell/studio/sessions")` → `setSessionSummaries` (`components/maxwell/studio-shell.tsx:232-235`) | `cache: "no-store"` |
| Mapeo a header | `draftSessionsForHeader = sessionSummaries.map(...)` (`studio-shell.tsx:1245`) → `draftSessions` (`:1299`) | hoy `{id, title, updatedAt}` |
| Render de filas | `StudioHeader` popover "Your chats" (`components/maxwell/studio-header.tsx:240-290`) | botón por fila → `onSelectDraftSession(id)` |
| Señal de client workspace | `getClientWorkspaceBySession(sessionId)` (`lib/maxwell/repositories.ts:1503`); tabla `client_workspace` (1:1 por `studio_session_id`) | existencia de fila = workspace provisionado |
| Gate del workspace | `app/[locale]/maxwell/workspace/[sessionId]/page.tsx:219-252` | auth Google + `viewerOwnsStudioSession`; sin fila → vista "preparing" o 404 |

`StudioSessionListItem` (`repositories.ts:112`) hoy = `{id, initialPrompt, status,
goalSummary, updatedAt}`. **No** trae señal de client workspace → es el dato net-new
a propagar.

---

## 5. Diseño

### 5.1 Señal por sesión: `hasClientWorkspace`

Fuente de verdad = **existencia de fila en `client_workspace`** para ese
`studio_session_id` (no el `status` de la sesión, que es derivado/ambiguo). Se
calcula en el mismo query del listado, con un `LEFT JOIN`:

- Extender `listStudioSessionsForOwner` (`repositories.ts:628`):
  ```sql
  SELECT s.id, s.initial_prompt, s.status, s.goal_summary, s.updated_at,
         (cw.id IS NOT NULL) AS has_client_workspace
  FROM studio_session s
  LEFT JOIN client_workspace cw ON cw.studio_session_id = s.id
  WHERE lower(s.owner_email) = ${email}
    AND s.deleted_at IS NULL
  ORDER BY s.updated_at DESC
  LIMIT ${limit}
  ```
  Un solo row por sesión (relación 1:1). Añadir `hasClientWorkspace: boolean` al tipo
  `StudioSessionListItem`.

> **MVP:** solo se superficia cuando la fila `client_workspace` existe (= workspace
> provisionado, la página renderiza la vista completa con Messages). Las sesiones
> pagadas pero aún provisionándose (vista "preparing") **no** se superfician todavía
> (§10) — evita mandar al cliente a una página "preparing" desde el hub.

### 5.2 A — Link en "Your chats"

- El payload de `GET /api/maxwell/studio/sessions` agrega `has_client_workspace` por
  fila (allowlist a mano, mantener el `assertNoInternalFields`; un booleano no aporta
  fugas §8.3).
- `StudioShell`: el tipo `SessionSummary` (interno de `studio-shell.tsx`) agrega
  `has_client_workspace`. En `draftSessionsForHeader` (`:1245`) construir, cuando el
  flag es true, `workspaceHref = /${locale}/maxwell/workspace/${id}` (el `locale` ya
  está en el shell). `StudioDraftSession` (`studio-header.tsx:142`) agrega
  `workspaceHref?: string | null`.
- `StudioHeader`: en cada fila del popover (`:246-288`), cuando `row.workspaceHref`,
  renderizar un `<Link href={row.workspaceHref}>` "Open workspace →" (ícono, p.ej.
  `Monitor`/`ArrowUpRight` de lucide) **separado** del botón principal
  (`onSelectDraftSession` carga el chat; el link **navega** al workspace). Cerrar el
  popover en click. El link convive con el botón de borrar.

### 5.3 B — Banner en el chat (sesión activa)

- `StudioShell` deriva `currentSessionHasClientWorkspace =
  sessionSummaries.find(s => s.id === currentSessionId)?.has_client_workspace ?? false`.
- Cuando es true, renderizar un banner presentational chico en la **columna del chat**
  (host: `components/maxwell/studio-chat-pane.tsx`, arriba del thread, o en el shell
  justo encima del chat pane), con copy tipo *"Your project workspace is ready"* + CTA
  **"Open workspace →"** a `/{locale}/maxwell/workspace/{currentSessionId}`.
- Componente nuevo chico (p.ej. `components/maxwell/workspace-reentry-banner.tsx`),
  presentational puro (recibe `href`), testeable aislado.

### 5.4 Acceso / seguridad

- **Sin superficie de acceso nueva.** El link solo navega; el gate real sigue en la
  página del workspace (`auth` + `viewerOwnsStudioSession`). Un link viejo/stale para
  un no-dueño → la página resuelve `notFound()`.
- El flag es booleano derivado de existencia; no expone data del proyecto. El
  `assertNoInternalFields` del endpoint se mantiene satisfecho.

---

## 6. Contrato del endpoint (cambio aditivo)

`GET /api/maxwell/studio/sessions` → `200`:
```jsonc
{
  "sessions": [
    {
      "id": "<uuid>",
      "initial_prompt": "...",
      "status": "<studio_status>",
      "goal_summary": "...|null",
      "updated_at": "<ISO>",
      "has_client_workspace": true   // NUEVO (boolean)
    }
  ]
}
```
Aditivo y snake_case (consistente con el payload actual de este endpoint). Sin cambio
de auth (sigue `getAuthenticatedViewer`, 401 sin sesión).

---

## 7. Archivos a tocar

- `lib/maxwell/repositories.ts` — `listStudioSessionsForOwner` (JOIN + map) +
  `StudioSessionListItem` (campo `hasClientWorkspace`).
- `app/api/maxwell/studio/sessions/route.ts` — agregar `has_client_workspace` al map
  allowlisteado del `GET`.
- `components/maxwell/studio-shell.tsx` — tipo `SessionSummary` + `workspaceHref` en
  `draftSessionsForHeader` + derivar `currentSessionHasClientWorkspace` + montar el
  banner (B) en la columna del chat.
- `components/maxwell/studio-header.tsx` — `StudioDraftSession.workspaceHref` + link
  "Open workspace →" por fila (A).
- `components/maxwell/workspace-reentry-banner.tsx` — **nuevo**, banner presentational (B).
- (opcional) `components/maxwell/studio-chat-pane.tsx` — host del banner si no se monta
  desde el shell.

Sin migración. Sin env/secreto. Sin tocar el prop `hasWorkspace` existente.

---

## 8. Tests (vitest)

- **Repos:** `listStudioSessionsForOwner` devuelve `hasClientWorkspace=true` para una
  sesión con fila `client_workspace` y `false` sin ella (si el harness corre contra
  DB; si no, cubrir el mapeo de filas).
- **Endpoint:** el body del `GET` incluye `has_client_workspace` y pasa
  `assertNoInternalFields` (no se cuela ninguna llave nueva fuera del allowlist).
- **A (`StudioHeader`):** una fila con `workspaceHref` renderiza el link con el href
  correcto; sin `workspaceHref`, no aparece. El click no dispara
  `onSelectDraftSession` (son acciones separadas).
- **B (`workspace-reentry-banner`):** renderiza el CTA con el href dado; el shell solo
  lo monta cuando la sesión activa tiene client workspace (test de la condición de
  derivación).

---

## 9. Gates + entrega

- Las **4 gates** verdes antes de PR: `lint` (0 err), `tsc` (0), `vitest` (todos),
  `build` (OK) — ver [[feedback_run_all_gates]].
- **Una branch / un PR** (p.ej. `feat/studio-workspace-reentry`), PR abierto para
  revisión del partner salvo OK explícito de merge — ver [[feedback_feature_branches_always]].
- Al cerrar: entrada en el changelog de gaps de escritorio — ver
  [[feedback_desktop_changelog]].

---

## 10. Fuera de alcance (futuro)

- **Sesiones "preparing":** superficiar también las pagadas-pero-no-provisionadas
  (pago registrado, sin fila `client_workspace`) con un estado "preparing" en el hub.
  Requiere ampliar la señal más allá de la existencia de fila.
- **Nav global "My projects":** ítem en el header/drawer post-login para descubrir el
  hub sin tipear la URL (la opción C que quedó fuera).
- **Deep-link a Messages / badges de novedad:** anclar a la sección de mensajes y/o
  marcar updates/mensajes nuevos sin leer.

---

## 11. Secuencia

1. Repos + endpoint (la señal `has_client_workspace`).
2. A (link en "Your chats").
3. B (banner en el chat).
4. Tests + 4 gates → PR.

Sin pasos del App ni de ops. Es un slice cerrado de un solo lado.
