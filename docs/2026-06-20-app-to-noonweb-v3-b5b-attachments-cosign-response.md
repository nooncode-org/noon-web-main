# Handoff — App → NoonWeb: respuesta de co-firma de B.5b (adjuntos en client-requests)

**Fecha:** 2026-06-20
**Para:** equipo **NoonWeb** (`noon-web-main`).
**De:** App-nooncode.
**En respuesta a:** `noon-web-main/docs/2026-06-20-v3-b5b-attachments-noonweb-codesign.md` (su DRAFT de co-diseño de B.5b).
**Objetivo:** **co-firmar las 6 preguntas de su §8** y **congelar el contrato de adjuntos** para que NoonWeb construya su infra de hosting (Vercel Blob + el signed-read). El App construye su lado (branch `kind:'attachment'` + fetch del signed-read) contra este contrato congelado.

> Auto-contenido. Verificado contra el código real del App: el §5D receiver (`receiveWebsiteClientRequestUpdate`, `lib/server/projects/client-requests-repository.ts`) ya **reserva + rechaza** `kind:'attachment'` con `400 CLIENT_REQUEST_UPDATE_KIND_UNSUPPORTED` (B.5a); la tabla `client_request_updates` (0095) es noon_migrator-owned (ALTER aditiva = lane limpia); el App ya firma HMAC outbound a NoonWeb (§7B / ai-mvp / proposal-decision), así que **consumir** su signed-read es factible (firma `${timestamp}.` para un GET sin body — su convención de prototype-signed-read).

---

## 0. TL;DR

**Las 6 preguntas: CO-FIRMADAS como las propusieron** (con un par de precisiones App-side). Sin corrección mayor — su diseño (NoonWeb hostea en Blob; el App guarda una referencia opaca; el staff accede vía signed-read HMAC server-to-server) encaja con la realidad + las invariantes del App. **El App no agrega env/secreto.** Contrato de B.5b **CONGELADO**.

---

## 1. Co-firma de las 6 preguntas (§8)

### Q-B5b-1 — Sub-shape de la referencia → ✅ `{ id, filename, mime, size }` (los 4)
El App **guarda los 4 campos** en su store de updates (`client_request_updates`, columnas aditivas), no solo `{ id }`. Razón: el panel staff muestra **filename + tamaño + tipo sin un fetch**; el fetch del binario ocurre **solo al abrir**. `id == updateId` (su contrato) — el App usa `update_id` como la clave del adjunto para el signed-read; no duplica un `attachment_id` aparte.

### Q-B5b-2 — Mecanismo de acceso → ✅ signed-read HMAC server-to-server + 302 a Blob URL de corta vida
- El App **fetchea vía su `GET /api/integrations/website/attachment-signed-read/[id]`** (HMAC sobre `${timestamp}.`, headers `x-noon-timestamp`+`x-noon-signature`, ±5 min, reusa `NOON_WEBSITE_WEBHOOK_SECRET`). El App **nunca guarda una URL ni el binario** — solo la referencia (Q-B5b-1).
- **Aceptamos el `302` a una URL firmada de Blob de corta vida** (TTL ~60s) — preferido sobre streamear el binario (descarga el bytes-transfer a Blob/CDN). **Rechazamos** la opción de "NoonWeb empuja una URL firmada en el wire" (expira / menos seguro / el App tendría que guardar una URL — viola Q-B5b-1).
- **Mediación App-side (precisión):** el binario NUNCA lo pide el browser del staff directo. Flujo: el staff abre el adjunto → una **ruta staff NUEVA del App** (`requireRole` admin/sales_manager/pm/developer, igual que el read de client-requests) → el App firma + llama su signed-read → recibe el `302` → **redirige al staff autenticado a esa URL de Blob de corta vida** (el browser del staff baja el binario directo de Blob; el App no proxy-ea bytes). Authz primero, siempre.

### Q-B5b-3 — Semántica del update → ✅ igual que clarification; `body` opcional
- Un `kind:'attachment'` fluye por el **mismo path** que `clarification`: si el request padre está en `needs_clarification`, **auto-retorna a `in_review`** (vía el `resumeFromClarification` ya existente — solo desde ese estado; record-only si no) + **notifica** al equipo asignado. La máquina de estados es type-agnostic; un adjunto es el cliente respondiendo con material.
- **`body` OPCIONAL** para `attachment` (un adjunto sin texto es válido). Para `clarification` el `body` sigue **requerido** (sin cambio). El App ajusta el refine: `kind:'clarification' ⇒ body`; `kind:'attachment'` no exige body pero exige el sub-objeto `attachment`.
- Notify: reusamos un event `attachment_received` (o `clarification_received` — decisión App-side interna, solo copy; sin migración de enum).

### Q-B5b-4 — Límites → ✅ 10 MB / allowlist mime / 1 por update; el App backstopea
- **NoonWeb es autoritativo** (hostea + valida los bytes reales). El App **backstopea el sub-shape** como defensa en profundidad: `size` entero `1..10485760` (10 MB), `mime` en el allowlist, `filename` 1..255 trimmed. Si el sub-shape es malformado → el App rechaza con `400` (no persiste).
- **Allowlist mime (co-firmado):** `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `application/pdf`, `text/plain`, y los office mime comunes. **Sin SVG** (XSS) **ni ejecutables**. Si NoonWeb quiere extender el allowlist, es additive + se re-confirma.
- **1 adjunto por update** (co-firmado) — mantiene `(externalRequestId, updateId)` limpio; múltiples adjuntos = múltiples updates.

### Q-B5b-5 — Lifecycle / retención → ✅ el App guarda SOLO la referencia, fetchea live; NoonWeb borra los blobs
- El App **nunca guarda el binario** — solo `{ id, filename, mime, size }` en `client_request_updates`. Siempre fetchea live vía el signed-read.
- **GDPR:** NoonWeb es dueño del borrado del blob (extiendan `gdpr-hard-delete` a los blobs — su lado). La metadata del adjunto en el App vive en `client_request_updates` (cubierta por el export/erase de client-data del App que ya existe). Un blob borrado → el fetch del App da **404 → degrada gracioso** (dangling-tolerant, como un `versionRef` colgante; el panel muestra "adjunto no disponible", nunca error). **El App no necesita lógica de borrado de blobs.**

### Q-B5b-6 — Env → ✅ el App no agrega nada; la excepción es del lado NoonWeb
Confirmado: **el App no agrega env ni secreto.** `BLOB_READ_WRITE_TOKEN` es de NoonWeb (inherente al file-hosting — la primera excepción razonable al "cero env nuevo" de v3, porque es inevitable para hostear). El signed-read + el forward del update reusan `NOON_WEBSITE_WEBHOOK_SECRET`. Excepción **aceptada** (es NoonWeb-only; el App-side se mantiene zero-new-env).

---

## 2. Qué construye el App (B.5b, contra este contrato)

- **Branch `kind:'attachment'`** en el §5D receiver: validar el sub-objeto `attachment` (backstop §Q-B5b-4), persistir la referencia, `body` opcional, mismo auto-resume + notify que clarification.
- **Migración aditiva** sobre `client_request_updates` (columnas `attachment_filename` / `attachment_mime` / `attachment_size_bytes`; `update_id` ya es el id del adjunto) — **lane limpia** (tabla noon_migrator-owned, precedente 0095/0096).
- **Ruta staff NUEVA + dirección outbound nueva:** el App firma + llama el `attachment-signed-read` de NoonWeb (primera vez que el App **consume** un signed-read; hasta ahora los expone) → 302 al staff autenticado.
- **Panel:** render de adjuntos (filename + tamaño + link de descarga via la ruta staff).

## 3. Orden de despliegue (duro, como el rollback/clarification)

1. **El App co-firma §8** → contrato congelado. *(este doc)*
2. NoonWeb construye su infra de hosting (Blob + migración + action + signed-read), **gateada por `ATTACHMENTS_ENABLED=false`**.
3. El App despliega el branch `kind:'attachment'` + el fetch del signed-read.
4. **Gate de habilitación:** el App confirma `kind:'attachment'` desplegado → NoonWeb flipea `ATTACHMENTS_ENABLED` en prod (1 PR, como el rollback flip). Hasta entonces el receptor del App sigue dando `400` a un `attachment` (degrada limpio).
5. **Smoke bilateral:** subir un adjunto desde el portal → el App recibe la referencia, la muestra, el staff la abre (fetch signed-read → 302 → binario) → confirmar. Negativos: mime no permitido → 400; oversize → 400; firma mala en el signed-read → 401; id inexistente → 404.

> **Dependencia cruzada:** el App puede construir + unit-testear su branch contra el contrato congelado YA (mock del fetch); el E2E live espera el signed-read + el flag de NoonWeb.

---

## 4. Referencias

- Co-diseño NoonWeb: `noon-web-main/docs/2026-06-20-v3-b5b-attachments-noonweb-codesign.md`.
- B.5a (la base): `App-nooncode/specs/v3-client-requests-b5-clarification.md`, ADR-042, cross-repo §5D.
- Patrón signed-read (espejo): `app/api/integrations/website/prototype-signed-read/[token]` (el App lo expone; aquí el App lo consume del lado NoonWeb).
- Wire del update: `docs/integrations/cross-repo-webhook-v1.md` §5D.
