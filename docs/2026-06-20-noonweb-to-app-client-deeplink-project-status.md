# NoonWeb → App — Deep-link cliente per-project para estado de proyecto (respuesta D1 / ADR-010)

**Fecha:** 2026-06-20
**De:** NoonWeb (noon-web-main)
**Para:** NoonApp
**Asunto:** Respuesta a "¿tienen (o pueden exponer) un deep-link per-project a la vista del cliente que el seller comparta, para retirar `/client/[token]`?"

> Verificado contra el código real de NoonWeb: `lib/maxwell/public-url.ts` (`buildWorkspaceUrl`),
> `app/[locale]/maxwell/workspace/[sessionId]/page.tsx` (auth + ownership), `lib/auth/redirect.ts`
> (`buildSignInHref`), `lib/maxwell/project-status-fetch.ts` (el pull de status).

---

## 0. TL;DR

- La superficie cliente de NoonWeb es el **workspace autenticado**
  `{base}/{locale}/maxwell/workspace/{sessionId}`, keyed por el **`sessionId` de NoonWeb**,
  **cliente-autenticado** (solo el dueño), **sobrevive el login**, con **paridad de contenido** (y
  más) vs el portal legacy.
- **NO existe hoy** un link per-project que el App pueda construir solo (ni anónimo tipo el
  prototype-share): la clave es el `sessionId`, que el App no tiene. Falta un puente
  `project id → sessionId` que solo NoonWeb conoce.
- → **Hace falta un cambio chico de NoonWeb** (Opción C recomendada: un campo en el signed-read que el
  App ya consume; o Opción A: una ruta resolver per-project). **Sin env nuevo** de ningún lado.
- **2 confirmaciones del owner** antes de construir: (1) el modelo de auth pasa de **anónimo-token →
  cliente-autenticado (solo el dueño)**; (2) la cobertura es solo projects que tienen workspace en
  NoonWeb.

---

## 1. Respuestas a los 5 específicos (verificado en código)

**1. Esquema de URL.** `{base}/{locale}/maxwell/workspace/{sessionId}` (`buildWorkspaceUrl`,
`lib/maxwell/public-url.ts`). Es el **workspace autenticado**, NO un `/portal/{projectId}` ni
token-based. `{base}` = `MAXWELL_PUBLIC_BASE_URL` / `NEXT_PUBLIC_SITE_URL`. `{locale}` es obligatorio
(next-intl con `localePrefix:"always"`).

**2. La clave.** El **`sessionId` de NoonWeb** (`studio_session.id`), **NO** el App project id ni un
token que NoonWeb mintee. El `noon_app_project_id` que el App ya consume en el signed-read vive como
**columna en `client_workspace`**, que linkea 1:1 a un `studio_session`. La cadena es:
`noon_app_project_id → client_workspace → studio_session.id` = la clave de la URL. **El App no tiene
el `sessionId`** → no puede construir el link con solo el project id.

**3. Modelo de auth.** **Cliente-autenticado, NO anónimo.** La página
(`app/[locale]/maxwell/workspace/[sessionId]/page.tsx`): `auth()` → si no hay sesión,
`redirect("/signin?redirectTo=/maxwell/workspace/{sessionId}")`; con sesión,
`viewerOwnsStudioSession({ email }, session)` exige que el email logueado sea el `owner_email` del
proyecto, si no → `404` no-revelador. Es decisión deliberada de v3 (el cliente es un usuario real de
NoonWeb, no un token anónimo — el espíritu de ADR-010 / D1).

**4. ¿Sobrevive el login?** **SÍ.** Un cliente no logueado que abre el deep-link va a
`/signin?redirectTo={url-del-workspace}` → tras loguear, aterriza en SU workspace (no en un portal
genérico). **Además** está gateado por ownership: **solo el dueño (el cliente) lo ve**; un no-dueño
(p.ej. el propio seller con su cuenta) → `404`. O sea: el seller **comparte** el link, el cliente lo
abre — el seller no puede previsualizarlo con su cuenta.

**5. Paridad de contenido.** **SÍ, y más.** El workspace pinta status del proyecto + versiones +
updates + requests + activity feed, **todo del mismo signed-read que el App alimenta**
(`fetchNoonAppProjectStatus`, keyed por `noon_app_project_id`). Cubre lo del portal legacy (vista de
estado) y agrega el round-trip de requests/aclaraciones/adjuntos.

---

## 2. El punto clave (por qué "solo el esquema" no alcanza)

**No existe hoy un link per-project que el App pueda construir solo, ni anónimo tipo el
prototype-share.** La superficie cliente es **autenticada + keyed por `sessionId`**, y el App solo
tiene el `noon_app_project_id`. Falta el puente `project id → sessionId`, que solo NoonWeb conoce
(el signed-read de status NO devuelve el `sessionId` ni la URL del workspace hoy). → **Hace falta un
cambio chico de NoonWeb**; no hay opción de cero-build de nuestro lado.

---

## 3. Opciones (ambas: cambio chico de NoonWeb, sin env nuevo, reusan el auth+ownership existente)

### Opción C — agregar la URL del workspace al signed-read (RECOMENDADA, la más liviana)
NoonWeb agrega el **workspace URL (o el `sessionId`) como campo aditivo al signed-read de
project-status** que el App ya consume. El App lo lee y lo usa directo como `href` del botón del
seller.
- **Pros:** sin ruta nueva; un solo campo aditivo al pull que ya existe; maneja la cobertura solo
  (si el proyecto no tiene workspace, el campo viene `null` → el App esconde el botón / mantiene el
  legacy). El App no construye URL: la usa tal cual.
- **Contras:** es un cambio aditivo al contrato del pull (co-firma chica).

### Opción A — ruta resolver per-project
NoonWeb construye `{base}/{locale}/maxwell/project/{noonAppProjectId}` que mapea project→workspace,
aplica el mismo auth+ownership y redirige al workspace.
- **Pros:** el App **genera el link con el project id que ya tiene** (análogo a lo que pidieron); más
  limpia conceptualmente.
- **Contras:** una ruta nueva de NoonWeb (resolver + redirect + manejo de no-workspace/no-owner →
  404).

Ambas honran "no necesitamos que construyan nada si ya existe" en el sentido mínimo: el delta es
chico. Pero **algo de NoonWeb sí hay que tocar** porque el App no tiene el `sessionId`.

---

## 4. Decisiones del owner antes de construir (2)

1. **Cambio de modelo de auth:** pasa de **anónimo-token → cliente-autenticado (solo el dueño)**.
   Funciona porque el cliente que vino por Maxwell + pagó YA tiene cuenta Noon (el `owner_email`).
   Pero **deja de ser "cualquiera con el link lo ve"**. ¿OK para D1? (Encaja con ADR-010.)
2. **Cobertura:** solo aplica a App projects que **tienen workspace en NoonWeb** (originados por
   Maxwell + pago). Los projects sales-led / creados directo en el App **no tienen workspace** → no
   hay link (URL `null`). ¿Esos quedan en legacy hasta migrar, o no aplican?

---

## 5. Próximo paso

Con la confirmación de los 2 puntos del §4 + la elección C vs A, NoonWeb dimensiona y construye el
delta (chico, sin env nuevo) y co-firma el campo/ruta. El App genera el link en el botón del seller y
redirige el viejo `/client/[token]` ahí.

**Pendiente del lado App:** confirmar §4.1 (auth autenticado OK) + §4.2 (qué pasa con projects sin
workspace) + preferencia C/A.
**Pendiente del lado NoonWeb:** construir C (campo en el pull) o A (ruta resolver) según la elección.
