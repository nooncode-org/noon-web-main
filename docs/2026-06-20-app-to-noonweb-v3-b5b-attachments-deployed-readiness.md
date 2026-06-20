# Handoff — App → NoonWeb: B.5b adjuntos DESPLEGADO + ack Supabase Storage + readiness E2E

**Fecha:** 2026-06-20
**Para:** equipo **NoonWeb** (`noon-web-main`).
**De:** App-nooncode.
**En respuesta a:** su mensaje confirmando recepción del deploy del branch de adjuntos + el FYI de Supabase Storage + los 3 prerequisitos que piden para el E2E.
**Objetivo:** (1) **anclar** el deploy del branch de adjuntos del App con commit/ADR + OK explícito; (2) **acusar** el switch a Supabase Storage y marcar el ÚNICO punto donde NO es transparente para el App (el allowlist anti-open-redirect); (3) confirmar los **prerequisitos del E2E** de nuestro lado; (4) cerrar una **aclaración de dirección** antes de sembrar el smoke.

> Auto-contenido. Verificado contra el código real del App (PR #199, mergeado): el §5D receiver acepta `kind:'attachment'`, la ruta staff mediadora está en prod, y el de-dupe es exactamente el que piden.

---

## 0. TL;DR

- ✅ **Branch de adjuntos del App: DESPLEGADO en prod.** Anclas abajo (§1). Su §5D receiver ya puede asumir `kind:'attachment'` ACEPTADO (no más `400`).
- ✅ **Su flip es suyo. No tocamos nada** de nuestro lado. Esperamos su aviso de `ATTACHMENTS_ENABLED=true`.
- ⚠️ **Supabase Storage NO es 100% transparente para el App.** Nuestra ruta tiene un control anti-open-redirect (F-2) que **clava el host destino del `302`**, y estaba pineado al host de Vercel Blob. **Necesitamos el hostname exacto al que apunta el `Location` de su `302`** para re-clavarlo y desplegar antes del E2E. Hasta entonces nuestra ruta da `502` al redirigir. (§2)
- ✅ **E2E prereqs:** (a) ruta staff LIVE en prod; (c) de-dupe confirmado. (b) sembramos nosotros. (§4)
- ❓ **Una aclaración de dirección:** el contrato co-firmado es **cliente→App** (el cliente sube, el staff lee). Su frase "staff pueda postear un update con adjunto" sugiere la dirección inversa, que NO está en el contrato. Confirmemos antes de sembrar. (§5)

---

## 1. Ancla del deploy (lo que piden para anclar)

| Item | Valor |
|---|---|
| **PR (merge)** | `#199` → commit de merge **`0489bab`** |
| **Commit de feature** | **`18f9f92`** — `feat(client-requests): B.5b attachments — kind:attachment branch + App-as-consumer signed-read (ADR-044)` |
| **Doc flip** | `19188a6` — `docs(client-requests): flip B.5b rule + spec to COMPLETE tense` |
| **ADR** | **ADR-044** (`docs/adrs/ADR-044-client-requests-b5b-attachments.md`) |
| **Migración** | **`0097_client_request_update_attachment_ref.sql`** — APLICADA en prod (operator-confirmada) |

**OK explícito:** el branch `kind:'attachment'` está en prod. Su §5D receiver puede dejar de degradar a `400 CLIENT_REQUEST_UPDATE_KIND_UNSUPPORTED` y enviar `kind:'attachment'` con confianza — el App lo persiste como referencia.

---

## 2. Supabase Storage — ack + el ÚNICO punto que SÍ nos afecta

Gracias por el FYI. **Corregimos el ADR-044 "Vercel Blob" → "Supabase Storage (interno NoonWeb)"** (+ cross-repo doc + core.md). El contrato co-firmado (guardamos `{id,filename,mime,size}`, nunca la URL ni el binario; accedemos vía su signed-read) es **idéntico** — salvo **una cosa**:

Nuestra ruta staff hace `fetch(..., { redirect: 'manual' })` y, ante un `302`/`307`, **solo redirige al staff si el `Location` cae en un host de una allowlist** (defensa F-2 contra open-redirect, por si su signed-read fuera comprometido). Ese allowlist estaba así:

```js
// isAllowedAttachmentRedirect — estado actual (pineado a Blob)
parsed.hostname === noonWebHost ||            // su origen de app (derivado del env existente)
parsed.hostname === 'vercel-storage.com' ||   // ← Vercel Blob
parsed.hostname.endsWith('.vercel-storage.com')
```

Con Supabase Storage, su `302` apuntará a un signed URL tipo `https://<ref>.supabase.co/storage/v1/object/sign/...`, **cuyo host NO está en nuestro allowlist** → la ruta lo bloquea y responde `502` (`attachment_redirect_blocked`).

**Lo que necesitamos de ustedes (1 dato):**
> **¿Cuál es el hostname EXACTO al que apunta el `Location` de su `302`?** ¿Es `<ref>.supabase.co`, o usan un **dominio custom de storage**?

Con eso re-clavamos el allowlist (default Supabase = `*.supabase.co`; si es custom, lo pineamos preciso) y desplegamos **antes** del E2E. **Sin nuevo env del lado App** — el host va hardcodeado en el allowlist, igual que estaba `vercel-storage.com`.

---

## 3. Su flip / orden de despliegue

Confirmado: **el flip es suyo y no tocamos nada.** Entendido su orden:

1. Provisión de storage (bucket + env + migración 028)
2. Merge de la infra (#85)
3. PR de enablement (UI + flip + gdpr)
4. Deploy → `ATTACHMENTS_ENABLED=true`

Esperamos su aviso de (4). Hasta entonces el App degrada limpio (recibiría `400` a un `attachment`, pero como ustedes aún no lo envían, es no-op).

**Orden recomendado conjunto:** que nuestro re-pin del allowlist (§2) entre **antes** de que ustedes habiliten + smokeen, para que el `302` no choque con `502`.

---

## 4. E2E — prerequisitos de nuestro lado

### (a) Ruta staff mediadora — ✅ LIVE en prod

```
GET /api/projects/[projectId]/client-requests/attachments/[updateId]
```

- **Authz primero:** `requireRole(['admin','sales_manager','pm','developer'])` (misma audiencia que el read de client-requests). El binario nunca es alcanzable anónimo.
- **Resuelve** el adjunto SCOPED al `projectId` (deny-by-default → service role). Inexistente → `404`.
- **Firma** un GET sin body (HMAC sobre `${timestamp}.`, headers `x-noon-timestamp`+`x-noon-signature`, ±5 min, reusa `NOON_WEBSITE_WEBHOOK_SECRET`) y llama:
  `{origin-derivado-del-env}/api/integrations/website/attachment-signed-read/{updateId}` con `redirect:'manual'`.
- **Maneja `302` Y `307`** del upstream → redirige al staff con `307` al `Location` (sujeto al allowlist F-2, §2).
- **Fallback `200`** (si streamean bytes directo): re-emite con headers **pineados a valores confiables** — `content-type` = mime guardado (NO el del upstream, defensa F-1 anti-XSS) + `content-disposition: attachment` + `nosniff`.
- **`404` del upstream** (blob borrado) → `404` gracioso (`ATTACHMENT_GONE`), dangling-tolerant.

### (b) App project + request — lo sembramos nosotros

Sembramos un App project + un `client_request` en un estado donde aplique un update con adjunto (equivalente al smoke B.5a). Acción de operador del lado App.

### (c) De-dupe — ✅ confirmado en código

- **Clave de idempotencia:** `UNIQUE(external_request_id, update_id)` con `ON CONFLICT (external_request_id, update_id) DO NOTHING` (un replay devuelve el id existente, no sobre-escribe).
- **`attachment.id == updateId`:** un Zod refine lo **exige** — si no coinciden, `400` (`attachment.id must equal updateId`). Es decir: usamos `updateId` como la clave del adjunto para el signed-read; no hay un `attachment_id` separado.
- **Shape del wire (congelado):** `{ externalRequestId, updateId, kind:'attachment', attachment:{ id(==updateId), filename, mime, size }, at, body? }`. `body` opcional para attachment.

---

## 5. Aclaración de dirección (cerrar antes de sembrar)

El contrato B.5b co-firmado es **cliente→App**: el **cliente** sube el adjunto en el portal → NoonWeb lo hostea → lo reenvía como `client-request-update kind:'attachment'` → el App guarda la referencia → el **staff** lo abre vía la ruta mediadora (§4a). El staff es **consumidor**, no originador.

Su prerequisito (b) dice *"un request en estado donde **staff pueda postear un update con adjunto**"*. Eso suena a la dirección **inversa** (staff→cliente con adjunto), que **NO está en el contrato co-firmado** (el §5D receiver es inbound desde NoonWeb; el App no origina adjuntos hacia el cliente — y los clientes son NoonWeb-only por §8.1).

> **Pregunta:** ¿(b) significa "un request al que el **cliente** puede adjuntar" (= el contrato) o esperan también un **staff→cliente con adjunto** (= nuevo, fuera de contrato)? Si es lo segundo, abrámoslo como un chunk aparte con su propio co-diseño.

---

## 6. Referencias

- Co-firma B.5b (contrato congelado): `docs/handoffs/2026-06-20-app-to-noonweb-v3-b5b-attachments-cosign-response.md`.
- ADR-044: `docs/adrs/ADR-044-client-requests-b5b-attachments.md` (en corrección Blob→Supabase).
- Ruta staff mediadora: `app/api/projects/[projectId]/client-requests/attachments/[updateId]/route.ts`.
- Receiver + de-dupe: `lib/server/projects/client-requests-repository.ts` (`receiveWebsiteClientRequestUpdate`).
- Wire del update: `docs/integrations/cross-repo-webhook-v1.md` §5D.
