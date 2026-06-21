# Handoff — NoonWeb → App: el lado NoonWeb de v3 Fase 2 (Versionado) está LISTO contra el contrato congelado

**Fecha:** 2026-06-18
**Para:** quien trabaje **App-nooncode** (dev o sesión de agente).
**De:** NoonWeb (`noon-web-main`).
**En respuesta a:** `docs/2026-06-18-app-to-noonweb-v3-fase2-versioning-cosign-response.md`
(co-firma del contrato de Fase 2).
**Objetivo:** avisar que NoonWeb ya **construyó y mergeó** su parte del MVP de Fase 2 contra
el contrato congelado, dejar por escrito **qué consume y qué envía** (para que el App
construya/verifique contra la forma real), y listar las **confirmaciones + el plan de smoke**
para cerrar el E2E como hicimos en §9.

> Auto-contenido: no requiere leer el repo NoonWeb. Las formas de wire de abajo son las
> congeladas en la co-firma; lo que cambia es que ahora del lado NoonWeb **ya están
> implementadas y en `main`**.

---

## 0. TL;DR

1. **NoonWeb terminó Fase 2 MVP (mergeado a `main`):** **Slice 2a** (display de versiones +
   estado publicado, sobre el pull) y **Slice 2b** (acción Publish del cliente → receptor
   `version-action`). **Sin Slice 2c** (rollback = staff/App-interno, por contrato Q-A).
2. **Falta el lado App** para cerrar Fase 2: (a) la **capa de publicación** sobre
   `project_versions`, (b) el **feed extendido** del project-status pull, (c) el **receptor**
   `POST /api/integrations/website/version-action`. Hasta que eso despliegue, en NoonWeb la
   sección de versiones se ve vacía y un Publish devuelve un error limpio (mismo ritmo que §9).
3. **Cero env/secreto nuevo de ningún lado** (reusa `NOON_WEBSITE_WEBHOOK_SECRET`).
4. Pedimos **4 confirmaciones** (§6) y proponemos el **smoke bilateral** (§7).

---

## 1. Qué consume NoonWeb (el pull extendido) — forma exacta esperada

NoonWeb ya parsea esta forma (allowlist Zod, sin `.strict()` para tolerar campos aditivos).
La identidad de versión cross-repo es `versionSequenceNumber` (congelado §9 B.4).

```jsonc
"data": {
  "project":  { "id", "name", "status" },
  "proposal": { ... } | null,
  "payment":  { "activated", "status" },
  "versions": [
    {
      "sequence": 1,
      "state": "ready_for_client_preview" | "published" | "previous_published" | "rolled_back",
      "previewUrl": "<url|null>",
      "at": "<ISO>",
      "published": false            // === (state === 'published'); NoonWeb trata `state` como canónico
    }
  ],
  "publishedSequence": 2 | null,    // qué sequence está publicada
  "publishedUrl": "<url|null>",     // URL pública client-facing actual
  "latestUpdate": { ... } | null,
  "serverTime": "<ISO>"
}
```

**Comportamiento de NoonWeb sobre esto (ya en main):**
- **NoonWeb es dueño del label** (§8.1): mapea `state` → copy + tono de badge
  ("Preview ready" / "Published" / "Previously published" / "Rolled back").
- **Cualquier `state` no mapeado / interno degrada a un chip neutral "Version"** y **nunca**
  se ofrece Publish sobre él. Es decir: si un valor interno (`draft`, validación fallida)
  llegara a cruzar, NoonWeb no lo rompe pero tampoco lo expone con sentido. **Confiamos en que
  el App NO emita estados internos** (allowlist positiva del lado App, §8.3).
- Cuando hay `publishedUrl`, NoonWeb muestra una tarjeta **"Live"** con esa URL pública.
- **Forward-compat ya resuelto:** el productor pre-Fase-2 (que omite `published` /
  `publishedSequence` / `publishedUrl` y solo emite `state: "ready_for_client_preview"`)
  sigue parseando. O sea: **el App puede desplegar el feed extendido de forma incremental**
  sin romper el portal.

---

## 2. Qué envía NoonWeb (la acción Publish) — y qué espera de vuelta

Cuando el cliente publica una versión desde el workspace, NoonWeb hace **un POST firmado**:

```
POST /api/integrations/website/version-action
Headers: x-noon-timestamp, x-noon-signature  (HMAC, ±5 min, secreto NOON_WEBSITE_WEBHOOK_SECRET)
Body (camelCase, flat):
  {
    "action": "publish",
    "projectId": "<== projects.id == client_workspace.noon_app_project_id>",
    "versionSequenceNumber": 2,
    "externalActionId": "<UUID>",
    "at": "<ISO>"
  }
```

NoonWeb **espera** (y depende de) esta respuesta:

```
200  { "idempotent": false|true, "publishedSequence": <n|null>, "publishedUrl": "<url|null>", "requestId": "<str>" }
```

- **`action` es SIEMPRE `publish` en el MVP.** NoonWeb nunca envía `rollback` (Q-A: rollback
  es staff/App-interno, no cruza el wire).
- **`externalActionId`** = UUID generado por NoonWeb **por intento**, **reusado en los
  reintentos internos** del cliente HTTP (3 intentos: 5xx/red, no en 4xx). → El App debe
  **de-dup por `externalActionId`** (UNIQUE app-level) y devolver **200 con el estado
  resultante** tanto en el primer write como en el replay (mismo molde que `externalRequestId`
  / `externalCommentId`).

---

## 3. Decisión de diseño de NoonWeb que el App DEBE respetar: forward SÍNCRONO

A diferencia de §9 (client-requests, que tiene outbox local), **NoonWeb NO persiste nada para
publish**: el App es el único SoT del **estado** publicado (lo leemos por el pull) **y** del
**audit** "quién publicó cuándo" (`project_activities`, Q-D). En consecuencia:

- **NoonWeb reenvía de forma síncrona y ESPERA la respuesta del receptor.** El cliente ve el
  resultado de ese 200 (y además NoonWeb revalida la página para re-leer el pull). → **El
  receptor del App debe responder síncronamente con el estado resultante**
  (`publishedSequence` / `publishedUrl` ya movidos), no solo "aceptado, mirá el pull luego".
- **No hay reintento durable en background.** Si el receptor 5xx-ea o no existe aún, NoonWeb
  devuelve un **error legible** al cliente y este puede re-hacer click (nuevo `externalActionId`).
  Esto es deliberado: publish es interactivo.
- **Gate de project type (solo web/web-app, Q-C) lo aplica el APP server-side.** El pull
  **no** expone `project.type`, así que NoonWeb **no puede** esconder el botón por tipo —
  gatea la UI por **estado publicable conocido** (`ready_for_client_preview` /
  `previous_published` / `rolled_back`; nunca `published` ni desconocido) y deja al App como
  **autoridad final**. → **El receptor debe rechazar limpio** un target no-web / no-publicable.

---

## 4. Qué falta del lado App (resumen de su propia co-firma §5, para alinear)

1. **Capa de publicación** sobre `project_versions` (state CHECK ensanchado + columnas
   `published_url`/`published_at`/… + audit a `project_activities`) — modelo Q-D.
2. **Feed extendido** del project-status pull (`state` por versión + `published` +
   `publishedSequence` + `publishedUrl`), por `sanitizeForClient` (sin fuga §8.3).
3. **Receptor** `POST /api/integrations/website/version-action` (solo `publish`, idempotente
   por `externalActionId`, body flat + 200 first/replay, HMAC reusado) — molde de su receptor
   `client-request`. Responde con el estado resultante (§3).
4. **UI staff App-interna** para ejecutar rollback (dev/PM/Admin) — no toca a NoonWeb.

---

## 5. Confirmaciones que pedimos al App (para cerrar sin sorpresas)

- **C-1 · Respuesta síncrona con estado:** ¿el receptor `version-action` devuelve
  `publishedSequence` + `publishedUrl` **ya actualizados** en el 200? (NoonWeb los usa para el
  feedback inmediato.)
- **C-2 · Allowlist de `state`:** ¿los únicos valores de `state` por versión que cruzan son
  `ready_for_client_preview | published | previous_published | rolled_back`, y `draft` /
  validación-fallida / cualquier interno **nunca** cruzan?
- **C-3 · Errores client-legibles:** dado que NoonWeb no gatea por tipo, ¿qué status/código
  devuelve el receptor para (a) project type no-web, (b) versión no publicable, (c) versión
  inexistente? Hoy NoonWeb muestra un mensaje genérico ("couldn't publish right now") ante
  cualquier fallo; si quieren copy específico por caso, NoonWeb mapea los códigos que definan.
- **C-4 · Env:** confirmamos que **no hay env/secreto nuevo** del lado App para esto (el
  receptor es inbound y reusa `NOON_WEBSITE_WEBHOOK_SECRET`; el estado se sirve por el pull ya
  existente). ¿Su lado tampoco necesita env nuevo?

---

## 6. Plan de smoke bilateral (cuando el App despliegue) — como §9

1. **Feed extendido (2a display):** con un workspace mapeado, el App emite ≥1 versión con
   `state` de publicación + (tras publicar) `publishedSequence`/`publishedUrl`. Verificar que
   el workspace de NoonWeb pinta el historial + la tarjeta "Live" + sin fuga §8.3.
2. **Publish (2b):** desde el workspace de prod, publicar una versión publicable → verificar
   (a) el receptor del App responde 200 con el estado resultante, (b) `externalActionId`
   de-dup en replay (200 `idempotent:true`), (c) el siguiente pull refleja `published` +
   `publishedUrl`, (d) el audit quedó en `project_activities`.
3. **Rechazo limpio:** publicar un target no-web / no-publicable → el receptor rechaza y
   NoonWeb muestra un error legible (no rompe).

> Nota operativa (de §9): el agente no puede correr escrituras a prod (gate de permisos); el
> operador corre los scripts y pega el output. Reusar el patrón de seed `smoke-*`.

---

## 7. Referencias
- Contrato congelado (co-firma del App): `docs/2026-06-18-app-to-noonweb-v3-fase2-versioning-cosign-response.md`.
- Diseño NoonWeb (+ §9 freeze + §9.3 decisión 2b): `docs/2026-06-17-v3-fase2-versioning-publish-design.md`.
- Handoff de co-diseño original: `docs/handoff-2026-06-17-v3-fase2-versioning-codesign.md`.
- Identidad de versión cross-repo: `versionSequenceNumber` (congelado §9 B.4).
- Patrón de receptor existente (App): `app/api/integrations/website/client-request/route.ts`; HMAC: `lib/server/website-webhook-auth.ts`.

**Estado: lado NoonWeb de Fase 2 MVP = COMPLETO en `main`. Pelota del lado App
(capa de publicación + feed extendido + receptor). Cero env/secreto nuevo.**
