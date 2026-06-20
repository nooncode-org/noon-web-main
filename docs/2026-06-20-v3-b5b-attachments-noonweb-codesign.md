# NoonWeb — Diseño + co-diseño de B.5b (adjuntos en client-requests), lado web

- **Fecha:** 2026-06-20
- **Repo:** `noon-web-main`
- **Estado:** **CONGELADO 2026-06-20** — el App co-firmó las 6 preguntas (`docs/2026-06-20-app-to-noonweb-v3-b5b-attachments-cosign-response.md`), sin corrección mayor. NoonWeb entra a build de la infra de hosting (gateada por `ATTACHMENTS_ENABLED=false`). *(Era DRAFT pre-freeze; las precisiones del App están en el bloque FREEZE de abajo.)*

> ### ✅ FREEZE 2026-06-20 — el App co-firmó; contrato de B.5b CONGELADO
>
> Las 6 preguntas de §8 **co-firmadas como propuestas**, con precisiones App-side:
> - **Q-B5b-1 ✅** referencia = `{ id, filename, mime, size }` (los 4; el App los guarda; `id == updateId`).
> - **Q-B5b-2 ✅** acceso = signed-read HMAC server-to-server **+ `302` a Blob URL de corta vida** (aceptado; "push URL" rechazado). **Precisión:** el binario nunca lo pide el browser del staff directo — el App tiene una **ruta staff (authz `requireRole`)** que firma + llama nuestro signed-read, recibe el 302, y **redirige al staff autenticado** a esa URL de Blob (el App no proxy-ea bytes).
> - **Q-B5b-3 ✅** `kind:'attachment'` = mismo path que clarification (auto `needs_clarification→in_review` + notify); **`body` OPCIONAL** para attachment (pero el sub-objeto `attachment` requerido); clarification sigue exigiendo `body`.
> - **Q-B5b-4 ✅** 10 MB / allowlist mime (png·jpeg·webp·gif·pdf·text-plain·office; **sin SVG/exe**) / **1 por update**. NoonWeb autoritativo; el App backstopea el sub-shape (`size` 1..10485760, mime allowlist, filename 1..255) → `400` si malformado.
> - **Q-B5b-5 ✅** el App guarda SOLO la referencia, fetchea live; **NoonWeb borra los blobs** (extender `gdpr-hard-delete`). Blob borrado → fetch del App da 404 → degrada gracioso ("adjunto no disponible"). El App no necesita lógica de borrado.
> - **Q-B5b-6 ✅** el App no agrega env/secreto; `BLOB_READ_WRITE_TOKEN` es NoonWeb-only (excepción aceptada); signed-read reusa `NOON_WEBSITE_WEBHOOK_SECRET`.
>
> **Orden de despliegue duro:** NoonWeb construye la infra gateada por `ATTACHMENTS_ENABLED=false` → el App despliega el branch `kind:'attachment'` + el fetch → el App confirma → NoonWeb flipea el flag (1 PR, como el rollback). Hasta entonces el receptor del App sigue dando `400` a un attachment (degrada limpio).
- **Predecesores:** B.5a clarification LIVE (`docs/2026-06-20-noonweb-to-app-v3-section9-rollback-clarification-ready.md`); contrato del App (`docs/2026-06-20-app-to-noonweb-v3-section9-rollback-and-clarification-ready.md` §2.9 OQ-8); spec App `specs/v3-client-requests-b5-clarification.md` §3 (el blocker de adjuntos).

> **Por qué co-diseño:** el App difirió explícitamente el sub-shape del adjunto a "cuando NoonWeb tenga file-hosting + co-firmemos" (OQ-8). Su `client-request-update` **rechaza `kind:'attachment'` con `400`** hasta entonces. El contrato congelado fija la dirección: **NoonWeb hostea los archivos; el App guarda una referencia estable (id), NO una URL cruda.** Este doc propone el shape exacto + el mecanismo de acceso para cerrarlo.

---

## 0. TL;DR

- Un adjunto viaja como un **`client-request-update` con `kind:'attachment'`** (el mismo endpoint §5D que ya usa B.5a; un update más por adjunto).
- **NoonWeb hostea** el archivo en **Vercel Blob** (privado), guarda una fila local, y reenvía al App una **referencia opaca + metadata** (`{ id, filename, mime, size }`), nunca una URL.
- **El staff (App) accede** al archivo vía un **endpoint NUEVO de signed-read HMAC** que NoonWeb expone (`GET /api/integrations/website/attachment-signed-read/[id]`), espejo del `prototype-signed-read` existente. El App llama server-to-server con la firma; NoonWeb responde el binario (o un 302 a una URL firmada de Blob de corta vida).
- **Un env nuevo, inevitable:** `BLOB_READ_WRITE_TOKEN` (de Vercel Blob). Es la **primera excepción** al "cero env nuevo" de v3 — es inherente al file-hosting. **Sin secreto compartido nuevo:** el signed-read reusa `NOON_WEBSITE_WEBHOOK_SECRET`.
- **6 preguntas de co-diseño (§8)** que el App debe co-firmar antes de cablear el wire.

---

## 1. Ownership (recap del contrato congelado)

- **NoonWeb:** dueño del adjunto — lo sube el cliente, lo hostea, lo sirve. Valida (tamaño/mime), persiste local, reenvía la referencia.
- **App:** guarda la **referencia estable** (`id` + metadata) en su store de updates; NUNCA una URL cruda ni el binario. La muestra read-only al equipo asignado; cuando el staff la abre, el App **fetchea** vía el signed-read de NoonWeb.
- **Cliente:** vive 100% en NoonWeb (ADR-010). Sube el archivo desde el portal (el RequestBox/reply).

---

## 2. Flujo de subida (NoonWeb, propuesto)

1. En la respuesta a un request (el "Reply" de B.5a) o al crear/responder, el cliente adjunta archivo(s) con un file-picker.
2. La server action (molde de `submit-request-update.ts`): re-deriva viewer + ownership + gate Q-10; valida **tamaño + mime** (allowlist) antes de subir.
3. Sube el binario a **Vercel Blob** en modo **privado** (no public URL); obtiene el blob key/pathname.
4. Persiste una fila local `client_request_attachment` (id opaco == el id de la fila, blob key, filename, mime, size, FK al request) — fuente durable + ancla de idempotencia/dead-letter, espejo de los otros outboxes.
5. Reenvía un `client-request-update` `kind:'attachment'` al App con la **referencia** (§3), reusando el bridge HMAC. `updateId == id` reusado en reintentos.

---

## 3. El wire (propuesto — extiende §5D, aditivo)

`POST /api/integrations/website/client-request-update` (el endpoint que ya existe para `kind:'clarification'`):

```jsonc
{
  "externalRequestId": "<uuid>",      // request padre (igual que clarification)
  "updateId":          "<uuid>",      // id estable del adjunto (== la fila local), reusado en reintentos
  "kind":              "attachment",  // NUEVO branch (hoy 400)
  "attachment": {                      // NUEVO sub-objeto (la "referencia", no una URL)
    "id":       "<uuid>",             // == updateId; el id opaco estable que el App guarda
    "filename": "<string>",          // 1..255, sanitizado por NoonWeb
    "mime":     "<string>",          // del allowlist
    "size":     12345                 // bytes, entero > 0, <= cap
  },
  "body": "<string|optional>",        // nota opcional que acompaña el adjunto (≤4000); ausente = solo archivo
  "at":   "<ISO 8601>"
}
```

- **Idempotencia = `(externalRequestId, updateId)`** (igual que clarification). Replay → `200 idempotent:true`.
- **El App NO recibe URL.** Solo `{ id, filename, mime, size }`. La URL se obtiene on-demand vía §4.
- **`body` opcional** para `attachment` (a diferencia de `clarification`, donde es requerido). Co-diseño Q-B5b-3.

---

## 4. Mecanismo de acceso (propuesto — endpoint NUEVO de NoonWeb)

`GET /api/integrations/website/attachment-signed-read/[id]` (espejo de `prototype-signed-read`):

- **Auth:** HMAC-SHA256 sobre `${timestamp}.` (empty-body trailing-dot, como el prototype-signed-read), headers `x-noon-timestamp` + `x-noon-signature`, ±5 min, secret `NOON_WEBSITE_WEBHOOK_SECRET` (**reusado, sin secreto nuevo**).
- **Quién llama:** el App, **server-to-server**, cuando el staff abre el adjunto en el dev-board (no el browser del staff directo → el binario nunca se expone público).
- **Respuesta:** el binario con su `Content-Type`/`Content-Disposition`, **o** un `302` a una URL firmada de Vercel Blob de corta vida (TTL ~60s). (Recomendación: 302 a signed URL — descarga el streaming a Blob/CDN; co-diseño Q-B5b-2.)
- **Gate:** el `id` debe resolver a un adjunto cuyo request pertenezca a un proyecto activado; si no → `404` no-revelador.

---

## 5. Límites + seguridad (propuesto)

- **Tamaño máx:** **10 MB** por archivo (cap inicial; ajustable). Validado client-side (UX) + server-side (autoritativo) + por el App como backstop del `size`.
- **Mime allowlist:** imágenes (`image/png`, `image/jpeg`, `image/webp`, `image/gif`), `application/pdf`, y docs comunes (`text/plain`, office mime). **Sin** ejecutables/SVG (XSS) por defecto. Co-diseño Q-B5b-4.
- **Count:** N adjuntos por update (recomendado 1 por update para mantener `(externalRequestId, updateId)` limpio; múltiples = múltiples updates). Co-diseño Q-B5b-4.
- **Authz:** solo el dueño del request sube (auth + `viewerOwnsStudioSession` + gate Q-10, igual que `submit-request-update`).
- **Privacidad:** blobs **privados** (sin public URL); acceso solo vía signed-read HMAC con expiry corto; filename sanitizado; sin datos internos (el adjunto es client-origin).
- **Antivirus/scan:** fuera de scope del MVP; flag para futuro si el owner lo pide.

---

## 6. Env / secretos

- **NUEVO (NoonWeb only):** `BLOB_READ_WRITE_TOKEN` (Vercel Blob). **Primera excepción** al "cero env nuevo" de v3 — inherente al file-hosting. Es de NoonWeb, **no compartido** con el App.
- **Reusado:** `NOON_WEBSITE_WEBHOOK_SECRET` (el signed-read + el forward del update) + `NOON_APP_BASE_URL`. **El App no agrega env ni secreto.**

---

## 7. Plan de build NoonWeb (post-freeze)

1. Dep `@vercel/blob` + `BLOB_READ_WRITE_TOKEN` en Vercel (preview + prod).
2. Migración: `client_request_attachment` (id PK, FK→client_request, blob_key, filename, mime, size, forwarded_at, created_at; UNIQUE external id; CHECK size>0; RLS+self-register). Migración-primero.
3. Repo: create/markForwarded/getByRequest + adjuntar a `getClientRequestsByWorkspace` (display).
4. Integration: `buildClientRequestAttachmentPayload` (kind:'attachment' + sub-objeto) + reuse de `sendClientRequestUpdateToNoonApp` (o un sibling) + el signed-read route.
5. Server action: `submit-request-attachment.ts` (upload a Blob → persist → forward), molde de `submit-request-update.ts`.
6. UI: file-picker en el RequestCard reply + render de adjuntos (filename + tamaño + descarga via el portal).
7. Gate detrás de un flag (`ATTACHMENTS_ENABLED=false`) hasta que el App despliegue el branch `kind:'attachment'` + el acceso (orden de despliegue duro, como el rollback flip).
8. Tests (vocab/payload/action/signed-read) + 4 gates. Smoke bilateral.

---

## 8. Preguntas de co-diseño (el App debe co-firmar antes de cablear el wire)

- **Q-B5b-1 — Sub-shape de la referencia.** ¿`attachment: { id, filename, mime, size }` (recomendado — el App puede mostrar + decidir si fetchea) o solo `{ id }`? ¿El App guarda los 4 campos?
- **Q-B5b-2 — Mecanismo de acceso.** ¿El App fetchea vía nuestro `GET /attachment-signed-read/[id]` (HMAC, server-to-server), y aceptan un `302` a una URL firmada de Blob de corta vida (vs. streamear el binario)? ¿O prefieren que NoonWeb empuje una URL firmada de corta vida en el wire (menos seguro, expira)?
- **Q-B5b-3 — Semántica del update.** ¿`kind:'attachment'` dispara el mismo auto-`needs_clarification → in_review` + notify que `clarification`? ¿`body` opcional para attachment (sí, recomendado)? ¿Un adjunto sin texto es válido?
- **Q-B5b-4 — Límites.** Cap de tamaño (propuesto 10 MB), mime allowlist (propuesta arriba), count por update (propuesto 1). ¿Valores del App?
- **Q-B5b-5 — Lifecycle/retención.** ¿El App necesita el archivo tras cierre del proyecto? Política de borrado / GDPR (el adjunto es client-data — el `gdpr-hard-delete` de NoonWeb debe cubrir los blobs). ¿El App guarda copia o siempre fetchea live?
- **Q-B5b-6 — Env.** Confirmar: NoonWeb agrega `BLOB_READ_WRITE_TOKEN` (suyo), reusa `NOON_WEBSITE_WEBHOOK_SECRET` para el signed-read; el App no agrega nada. ¿OK la excepción al "cero env nuevo"?

---

## 9. Secuencia + dependencias

1. **El App co-firma §8** → contrato de B.5b congelado. *(estado: pendiente)*
2. NoonWeb construye la infra de hosting (Blob + migración + action + signed-read) contra el contrato congelado; gateada por flag.
3. El App agrega el branch `kind:'attachment'` a su receptor §5D (validación del sub-shape, persistir la referencia) + el fetch del signed-read en el dev-board.
4. **Gate de habilitación:** el App confirma `kind:'attachment'` desplegado → NoonWeb activa el flag en prod (1 PR, como el rollback flip).
5. **Smoke bilateral:** subir un adjunto desde el portal → el App recibe la referencia, lo muestra, el staff lo abre (fetch signed-read) → confirmar el binario. Negativos: mime no permitido → 400 client-side; oversize → 400; firma mala en el signed-read → 401; id inexistente → 404.

---

## 10. Referencias

- B.5a (clarification, live): `docs/2026-06-20-noonweb-to-app-v3-section9-rollback-clarification-ready.md` + App `…-section9-rollback-and-clarification-ready.md` §2 (§5D).
- Spec App de adjuntos: `App-nooncode/specs/v3-client-requests-b5-clarification.md` §3 + §14 (B.5b carve-out).
- Patrón signed-read existente: `app/api/integrations/website/prototype-signed-read/[token]` + `lib/maxwell/prototipo-render-fetch.ts`.
- GDPR: `scripts/gdpr-hard-delete.mjs` (debe extenderse a los blobs de adjuntos).
