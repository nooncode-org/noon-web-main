# Handoff — NoonWeb → App: deep-link al client-workspace = **ZERO-BUILD confirmado** (P1/P-A/P-B respondidas)

**Fecha:** 2026-06-21
**Para:** quien trabaje **App-nooncode** (dev o sesión de agente).
**De:** NoonWeb (`noon-web-main`).
**En respuesta a:** `docs/2026-06-21-app-to-noonweb-client-workspace-deeplink-confirm.md`.
**Estado:** **Confirmamos: NoonWeb NO construye nada.** La App ya tiene el id que direcciona el workspace; el deep-link es determinístico. Cero cambio de contrato, cero env/secreto nuevo de ningún lado.

> Todo lo de abajo está **verificado contra el código real de NoonWeb** (rutas exactas citadas), no inferido. Su lectura (§2 de su doc) es correcta en todos los puntos.

---

## 0. TL;DR

| # | Su pregunta | Respuesta |
|---|---|---|
| P1 | ¿`studio_session.id` seguirá siendo la clave de ruteo del workspace? | **SÍ — lo comprometemos como contrato.** Cualquier cambio futuro = breaking change cross-repo coordinado (les avisamos antes). |
| P-A | ¿Locale en el path? | **Incluyan el prefijo, y usen `en`.** Forma canónica: `https://{host}/en/maxwell/workspace/{external_session_id}`. Un path sin locale igual redirige (307) a `/en/…`, pero el prefijo explícito evita el salto. |
| P-B | ¿Host de producción? | **El mismo origin que ya usan para los signed-reads/attachments.** Un solo Next app sirve ambas superficies. Base canónica = `https://noon-main.vercel.app` (o el valor de `MAXWELL_PUBLIC_BASE_URL`/`NEXT_PUBLIC_SITE_URL` en prod). |

**Nota:** esto deja sin efecto la consulta anterior (`docs/2026-06-20-noonweb-to-app-client-deeplink-project-status.md`), donde proponíamos un delta chico de NoonWeb (Opción C: campo `workspaceUrl` en el signed-read, vs Opción A: ruta resolver). Esa propuesta asumía que la App **no** tenía el `sessionId`. Como sí lo tienen (`external_session_id`), **no hace falta ninguna de las dos**: zero-build. El modelo autenticado owner-only (que justifica retirar el token anónimo) queda aceptado.

---

## 1. P1 — clave de ruteo: confirmado + comprometido

Su lectura es **correcta**. Verificado punto por punto:

- **Param de la ruta = `sessionId`:** `app/[locale]/maxwell/workspace/[sessionId]/page.tsx` (`type Props = { params: Promise<{ sessionId: string }> }`, línea 48; `WorkspacePage` desestructura `sessionId`, línea 324).
- **Lookup contra `studio_session.id`:** `getStudioSession(sessionId)` → `SELECT * FROM studio_session WHERE id = ${id} AND deleted_at IS NULL` (`lib/maxwell/repositories.ts:626`). El segmento del URL se matchea contra `studio_session.id`.
- **Workspace 1:1 por sesión:** `getClientWorkspaceBySession(sessionId)` → `WHERE studio_session_id = ${id}` (`repositories.ts:1521`), y hay **UNIQUE real** `client_workspace_session_key UNIQUE (studio_session_id)` (`supabase/migrations/20260406_001_harden_maxwell_schema.sql:384-388`). O sea: 1 workspace por sesión, enforced.
- **El id que les mandamos == nuestra clave de ruteo:** verificado en los payloads salientes — `external_session_id: session.id` en el inbound-proposal (`lib/noon-app-integration.ts:379`) y en el payment-confirmed (`:446`); el prototype-share lleva el mismo valor (`lib/maxwell/prototipo-share.ts:181`). `session` es un `StudioSession`, así que `session.id` = `studio_session.id`. → El `external_session_id` que persisten (su `prototype_workspaces.external_session_id`, ADR-028) **es** el id que direcciona la ruta.
- **Auth owner-only (case-insensitive):** sin login → `redirect(buildSignInHref('/maxwell/workspace/{sessionId}'))`; con login → `viewerOwnsStudioSession({ email }, session)` exige `viewer.email.toLowerCase() === session.ownerEmail.toLowerCase()`, si no → `notFound()` (`page.tsx:323-334`, `lib/auth/ownership.ts`). Coincide con lo que leyeron.

**Compromiso (respuesta a P1):** `studio_session.id` se mantiene como **la** clave que direcciona `/maxwell/workspace/{…}`. No planeamos migrar a indexar por `client_workspace.id` ni otro. Si alguna vez cambiara, es un **breaking change cross-repo** y lo coordinamos con ustedes antes de tocarlo.

---

## 2. P-A — locale

La ruta vive bajo `app/[locale]/maxwell/workspace/[sessionId]` y la config de i18n es `localePrefix: "always"` (`i18n/routing.ts`: `locales: ["en","es","fr","de"]`, `defaultLocale: "en"`). Comportamiento real del middleware (`proxy.ts`, Next.js 16 — el `middleware` se llama `proxy.ts`):

- **Path sin locale** (`/maxwell/workspace/{id}`): cae al middleware de next-intl, que con `localePrefix:"always"` **redirige (307) a `/en/maxwell/workspace/{id}`**. O sea: funcionaría, pero con un salto de redirect.
- **Path con `es`/`fr`/`de`**: están **deshabilitados al lanzamiento** — `proxy.ts` los rebota a `/en{resto}` (`disabledLaunchLocales = {es,fr,de}`). Hoy no hay localización per-cliente; toda superficie cliente corre en inglés.

**Respuesta a P-A:** construyan el path **con prefijo explícito y locale `en`**:

```
https://{host}/en/maxwell/workspace/{external_session_id}
```

Es lo mismo que hace nuestro propio email "Workspace ready" (`buildWorkspaceUrl`, default `en`). Evita el salto de redirect y no depende de sutilezas del middleware. **No usen `es`/`fr`/`de`** (rebotan a `en` igual). Si en el futuro habilitamos locales reales para clientes, se los avisamos — el `en` seguiría siendo válido.

---

## 3. P-B — host

Hay **un solo** deployment de NoonWeb (un Next.js app). Las rutas de integración que ya consumen — `/api/integrations/website/project-status/[projectId]`, `/api/integrations/website/attachment-signed-read/[id]`, etc. — y la ruta cliente `/maxwell/workspace/[sessionId]` viven en **el mismo app, mismo origin**. No hay un host de integración separado del host público.

**Respuesta a P-B:** usen **el mismo origin de NoonWeb que ya tienen en env para los signed-reads/attachments**, siempre que sea la base pública de producción (no una preview URL por-deploy). El valor canónico es:

```
https://noon-main.vercel.app
```

(En código: el base se resuelve de `MAXWELL_PUBLIC_BASE_URL` → `NEXT_PUBLIC_SITE_URL` → fallbacks de Vercel, en `lib/maxwell/public-url.ts:resolvePublicBaseUrl`; `robots.ts`/`sitemap.ts` caen exactamente a `https://noon-main.vercel.app` cuando el env no está seteado.) Si más adelante montamos un dominio custom, ese pasaría a ser el canónico y se los comunicamos.

---

## 4. Dos notas (FYI, no requieren acción)

1. **El workspace es privado y `noindex`.** `app/robots.ts` ya marca `/en/maxwell/workspace/` como `disallow`, y la ruta emite `robots: { index: false, follow: false }`. El deep-link es un link **privado owner-only**, no una URL pública crawleable — trátenlo como el token legacy en ese sentido (solo se comparte al cliente dueño).
2. **Workspace aún provisionándose degrada elegante.** Si el cliente abre el link entre evidencia de pago y verificación del PM (workspace todavía no creado), la ruta muestra una vista "preparing" en vez de un 404 pelado (`page.tsx:337-341`). Refuerza su borde §3.2: aunque compartan el link un toque antes, el cliente no rebota.

---

## 5. Próximo paso

- **NoonWeb:** nada que construir. Compromiso P1 registrado (este doc). Quedamos atentos si necesitan algo más para Part B.
- **App:** con P1 + P-A (`/en/`) + P-B (host) construyen el deep-link, esconden el botón cuando no hay `external_session_id`, y retiran el portal legacy `/client/[token]` (todo App-side, sin cambio de contrato).
- Si alguna vez cambia la clave de ruteo del workspace (P1) o el host canónico (P-B), lo tratamos como cambio cross-repo y coordinamos antes.
