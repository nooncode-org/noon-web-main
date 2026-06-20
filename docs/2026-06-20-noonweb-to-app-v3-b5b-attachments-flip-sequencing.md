# NoonWeb → App — v3 §9 B.5b adjuntos: acuse, aclaración de backend y secuencia del flip

**Fecha:** 2026-06-20
**De:** NoonWeb (noon-web-main)
**Para:** NoonApp
**Asunto:** Respuesta al "branch de adjuntos desplegado → flipeen `ATTACHMENTS_ENABLED`"
**Contrato base:** co-diseño B.5b CONGELADO 2026-06-20 (PR #84, 6 Qs co-firmadas)

---

## 1. Acuse

Recibido: el branch de adjuntos del App está desplegado y su receptor `client-request-update`
(§5D) ya acepta `kind:'attachment'` en lugar de responder `400`. Esto es exactamente el paso
`App despliega → flip` del orden duro acordado. Para anclarlo de nuestro lado, los devs del App
nos pasan el commit/ADR o un OK explícito de que `kind:'attachment'` está LIVE en prod.

## 2. Aclaración de backend (FYI — NO requiere re-co-firma)

El mensaje entrante menciona "Blob + signed-read". El hosting de NoonWeb es **Supabase Storage**,
no Vercel Blob: se verificó que un bucket Blob privado no entrega signed URLs de corta vida, lo que
rompía el mecanismo de acceso co-firmado. Supabase Storage (`createSignedUrl`) sí lo da.

El cambio es **100 % interno de NoonWeb**. El contrato App-facing es idéntico al congelado:

- El App guarda una **referencia estable** `{ id, filename, mime, size }`, **nunca una URL**.
- El acceso es vía el endpoint signed-read de NoonWeb → `302` a una URL firmada de corta vida.

No hay nada que re-co-firmar. Si el ADR/notas del App dicen "Blob", los devs del App lo actualizan
a "Supabase Storage (interno NoonWeb)".

## 3. El flip es de NoonWeb y va al FINAL de esta secuencia

El App no flipea nada de su lado. `ATTACHMENTS_ENABLED` es un flag exclusivo de NoonWeb, y es el
último paso. Antes faltan, en orden:

1. **Provisión de storage (operador NoonWeb):** bucket privado `client-request-attachments` +
   `SUPABASE_SERVICE_ROLE_KEY` (secreto nuevo) + verificar `SUPABASE_URL` (ya existente) en preview
   y prod + aplicar la **migración 028** (`client_request_attachment`).
2. **Merge de la infra gateada (PR #85)** — la migración debe estar aplicada antes del merge (el
   drift-check de prebuild falla si el `.sql` entra a git sin estar aplicado).
3. **PR de enablement:** UI file-picker en el workspace del cliente + flip `ATTACHMENTS_ENABLED=true`
   + extender el gdpr-hard-delete para borrar también los objetos del bucket.
4. **Deploy de prod.**

NoonWeb avisa al App cuando `ATTACHMENTS_ENABLED=true` esté LIVE en prod. Recién ahí corre el E2E.

## 4. Contrato del wire que NoonWeb emite (recap verificado contra el código)

Cuando un cliente adjunta un archivo a uno de sus requests, NoonWeb:

- Hostea los bytes en el bucket **privado** `client-request-attachments`.
- Persiste la fila outbox `client_request_attachment` (source of truth + dead-letter).
- Reenvía un `client-request-update` con:
  - `kind: 'attachment'`
  - `attachment: { id, filename, mime, size }` — referencia, nunca URL.
  - `updateId == attachment.id` (el App de-dupea en `(externalRequestId, updateId)`).
  - `body` **opcional** (un adjunto no requiere nota; una aclaración sí).

**Límites (NoonWeb es autoritativo sobre los bytes; el App respalda la sub-forma):**

- Tamaño: 1 byte .. **10 MB**.
- Mime: allowlist (imágenes png/jpeg/webp/gif, pdf, text/plain, doc/docx, xls/xlsx).
  **Excluye SVG (XSS) y ejecutables.** Extenderla es aditivo + re-confirmado con el App.
- Filename: saneado, 1..255 (se quita ruta y caracteres de control).
- 1 adjunto por update.

## 5. Acceso (signed-read) — verificado contra el código

- **Endpoint NoonWeb:** `GET /api/integrations/website/attachment-signed-read/{id}`.
- **Authz:** el App media el acceso (su ruta staff valida primero), luego firma un GET con la
  convención `${ts}.` HMAC, **reutilizando `NOON_WEBSITE_WEBHOOK_SECRET`** (sin secreto compartido
  nuevo).
- **Respuesta:** `302` a una URL firmada de Supabase Storage con **TTL de 60 s**. Los bytes van
  directo de Storage al navegador del staff; NoonWeb no proxea bytes.
- **No-revelador:** `404` idéntico para "no existe" y "proyecto sin pago activado".

## 6. Lo que NoonWeb necesita del App para el E2E

1. La **ruta staff mediadora** del App (firma el GET y llama a nuestro signed-read) lista en prod.
2. Un **App project + un request** en un estado donde el staff pueda postear un update con adjunto
   (mismo patrón que el smoke B.5a de aclaración).
3. Confirmación de que el App **de-dupea en `(externalRequestId, updateId)`** con
   `updateId == attachment.id`.

## 7. Plan de smoke (cuando NoonWeb confirme el flip)

Bilateral, igual que §9 / Fase 2:

1. Cliente adjunta un archivo dentro del allowlist (< 10 MB) a un request → NoonWeb hostea +
   reenvía `kind:'attachment'` → el App registra la referencia.
2. Staff abre el adjunto desde el App → ruta staff firma → signed-read NoonWeb → `302` → bytes.
3. Idempotencia: reintento con el mismo `updateId` no duplica.
4. Rechazos limpios: mime fuera de allowlist y tamaño > 10 MB.
5. (Diferido / post-smoke) gdpr-hard-delete borra también el objeto del bucket.

---

**Pendiente del lado del App:** confirmar §3.1 (OK de `kind:'attachment'` LIVE), §6 (insumos del
smoke), §2 (actualizar ADR a Supabase Storage si menciona Blob).
**Pendiente del lado de NoonWeb:** §3 pasos 1-4 (provisión + merge #85 + PR de enablement + deploy).
