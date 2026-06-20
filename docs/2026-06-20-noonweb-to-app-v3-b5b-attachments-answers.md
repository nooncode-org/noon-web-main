# NoonWeb → App — v3 §9 B.5b: respuestas (host del 302 + dirección) + acuses

**Fecha:** 2026-06-20
**De:** NoonWeb (noon-web-main)
**Para:** NoonApp
**En respuesta a:** `docs/2026-06-20-app-to-noonweb-v3-b5b-attachments-deployed-readiness.md`

> Verificado contra el código real de NoonWeb (rama `feat/v3-b5b-attachments`, infra de PR #85):
> `lib/maxwell/attachment-storage.ts`, el action `submit-request-attachment.ts`,
> `lib/maxwell/repositories.ts` y el endpoint `attachment-signed-read/[id]/route.ts`.

---

## 0. TL;DR

- ✅ **Ancla del deploy recibida** (PR #199 / `18f9f92` / ADR-044 / migración 0097). Tomamos el OK
  explícito: empezamos a enviar `kind:'attachment'` una vez que NoonWeb haga el flip.
- ✅ **§2 (host del 302) — RESPUESTA:** nuestro `Location` apunta a **`umqbtqbsfjgfhdptbqfb.supabase.co`**
  (host por defecto de Supabase, **NO** dominio custom). Re-claven el allowlist a ese host. Detalle abajo.
- ✅ **§5 (dirección) — CONFIRMADO: cliente→App**, exactamente el contrato. Nuestra frase "staff pueda
  postear" fue imprecisa; la corregimos. **No hace falta chunk nuevo.**
- ✅ **§4(c) de-dupe — verificado de nuestro lado:** `external_update_id == id`, así que
  `attachment.id == updateId` se cumple siempre → su Zod refine pasa.
- ⚠️ **Nueva dependencia dura de orden:** su re-pin del allowlist (§2) debe estar desplegado **antes**
  del paso de lectura del E2E, o su ruta da `502`. Corre en paralelo a nuestra infra.

---

## 1. §2 — Hostname exacto del `302` (la respuesta que piden)

Nuestro signed-read mintea la URL firmada vía la REST API de Supabase Storage y emite un `302` cuyo
`Location` es:

```
https://umqbtqbsfjgfhdptbqfb.supabase.co/storage/v1/object/sign/client-request-attachments/<key>?token=<jwt>
```

- **Host:** `umqbtqbsfjgfhdptbqfb.supabase.co` — el ref del proyecto **Supabase Web**.
- **No es dominio custom de storage.** Es el host por defecto de Supabase (`<ref>.supabase.co`).
- El host se deriva del env `SUPABASE_URL` de NoonWeb (`attachment-storage.ts` antepone
  `/storage/v1…` al base). El operador de NoonWeb setea `SUPABASE_URL=https://umqbtqbsfjgfhdptbqfb.supabase.co`.

**Recomendación de re-pin (equivalente a como tenían `vercel-storage.com`):**

```js
// isAllowedAttachmentRedirect — re-pin a Supabase
parsed.hostname === noonWebHost ||
parsed.hostname === 'umqbtqbsfjgfhdptbqfb.supabase.co'   // ← host exacto (tightest, recomendado)
// (alternativa por sufijo si la prefieren: parsed.hostname.endsWith('.supabase.co'))
```

> **Confirmado byte-a-byte:** el `NEXT_PUBLIC_SUPABASE_URL` del proyecto Web ya es
> `https://umqbtqbsfjgfhdptbqfb.supabase.co`, y el operador setea el `SUPABASE_URL` (no-público) al
> mismo valor. Host definitivo, sin caveat. **Sin env nuevo del lado App** (host hardcodeado en el
> allowlist, como antes).

> **Sobre un posible segundo salto:** el `Location` de NUESTRO `302` es el único host sujeto a su F-2.
> Si Supabase sirviera el binario tras un redirect interno adicional, el navegador del staff lo sigue
> nativamente (no pasa por su `redirect:'manual'`), así que **solo `umqbtqbsfjgfhdptbqfb.supabase.co`
> necesita estar en el allowlist.**

## 2. §5 — Dirección: confirmado cliente→App (es el contrato)

**Sí, es la dirección del contrato co-firmado: cliente→App.** Verificado en
`submit-request-attachment.ts`:

- El originador es el **cliente autenticado** (`auth()` + `viewerOwnsStudioSession` — el viewer es
  dueño de su propio Studio session/workspace).
- Adjunta a **uno de sus propios** requests (scoped al workspace del viewer).
- El **staff es consumidor**, no originador — accede solo vía la ruta mediadora + signed-read (§4a de
  su doc).

**No existe en nuestro código ningún path staff→cliente con adjunto.** Nuestra frase del handoff
anterior ("un request en estado donde **staff** pueda postear un update con adjunto") fue un copy-paste
impreciso del framing de B.5a. **La correcta es:**

> "un request del workspace de un cliente al que **el cliente** puede adjuntar un archivo."

**No hace falta abrir un chunk nuevo.**

**Diferencia con B.5a (importante para sembrar):** a diferencia de la aclaración (que requería el
request en un estado específico), **el adjunto NO tiene precondición de estado** — el cliente puede
adjuntar a cualquiera de sus requests. Las únicas compuertas en nuestro action son:

1. `ATTACHMENTS_ENABLED == true` (el flip).
2. Proyecto con pago activado (`workspace.noonAppProjectId` presente).
3. Bridge configurado (`isNoonAppProposalHandoffConfigured`).
4. Storage configurado (`isAttachmentStorageConfigured`).

## 3. §1 — Ancla recibida (acuse)

Tomamos las anclas: PR `#199` (merge `0489bab`), feature `18f9f92`, ADR-044, migración
`0097_client_request_update_attachment_ref.sql` aplicada. Gracias por corregir el ADR-044
"Vercel Blob" → "Supabase Storage (interno NoonWeb)". Empezamos a emitir `kind:'attachment'` recién
con el flip; hasta entonces no envían/reciben adjuntos, así que es no-op.

## 4. §4 — Acuse de su ruta staff + verificación cruzada de nuestro lado

- **(a) Ruta staff LIVE:** OK. Emitimos `302` explícito (`NextResponse.redirect(url, 302)`). Su
  manejo de `302`/`307` cubre nuestro caso. Su fallback `200` (re-stream con headers pineados) **no se
  dispara**: nunca streameamos bytes, siempre `302` a la URL firmada.
- **(c) De-dupe — verificado de nuestro lado:** `createClientRequestAttachment` setea
  `external_update_id = id` (mismo UUID). El action envía `updateId = externalUpdateId` y
  `attachment.id = id` → **iguales**, su Zod refine `attachment.id == updateId` pasa. El signed-read
  resuelve por `id` (= el `updateId` con el que ustedes llaman). Cadena consistente.
- **(b) Seed:** ver §5 abajo.

## 5. Coordinación del seed (cuando sembremos, no bloquea ahora)

Como en los smokes previos (§9 / Fase 2), el `client_request` debe existir en **ambos** lados:

- **App:** project + el `client_request` espejo (ustedes lo siembran, ya confirmado en su §4b).
- **NoonWeb:** el workspace mapeado a ese App project (`workspace.noonAppProjectId`) + pago activado +
  la fila `client_request` outbox a la que el cliente adjuntará.

Coordinamos los IDs (externalRequestId ↔ App project) al sembrar, como con `smoke-s9b-*` / `smoke-s2-*`.

---

## 6. Orden conjunto resultante

1. **NoonWeb** provisiona storage (bucket + env + migración 028) → merge #85 → PR de enablement (UI +
   flip + gdpr) → deploy `ATTACHMENTS_ENABLED=true`.
2. **App** re-clava el allowlist a `umqbtqbsfjgfhdptbqfb.supabase.co` + despliega — **en paralelo a (1)**,
   y obligatoriamente **antes** del paso de lectura del E2E.
3. **Ambos** siembran el seed bilateral y corren el smoke E2E.

**Bloqueante para el E2E (no para el merge de #85):** que (1)-flip y (2)-re-pin estén ambos LIVE.
