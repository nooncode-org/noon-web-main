# project.context.core.md — Noon / Maxwell Studio

> **Última actualización:** 2026-05-08
> **Sesión:** Operación post-Fase 6 — Studio en producción interna, hardening continuo
> **Modo recomendado:** Refactor / Hardening (la implementación base está en su sitio)

## 2026-04-26 integration note

- Noon Website y Noon App son productos separados.
- Website es dueño de Maxwell, visibilidad de propuesta y pago.
- Noon App es dueño del review entrante por PM y del handoff operativo post-pago.
- Website envía propuestas pendientes a Noon App vía webhooks firmados.
- Noon App devuelve la decisión de review a `POST /api/integrations/noon-app/proposal-review-decision`.
- Las mutaciones legacy de review en website están deshabilitadas; `POST /api/maxwell/review` ya no aprueba/envía propuestas.
- La confirmación de pago sigue originándose en website y se envía a Noon App solo cuando website tiene una sesión paid/confirmed.

---

## 1. Identidad

- **Proyecto:** Noon — plataforma de software profesional con intake comercial vía Maxwell
- **Objetivo activo:** Maxwell Studio (experiencia tipo v0 + Emergent) reemplazando el modal pre-propuesta. Modal legacy ya eliminado.
- **Tipo de producto:** Website pública + sistema de intake comercial IA-asistido
- **Estado:** Studio operativo (Fases 1–6 completadas). Pendiente: hardening, observabilidad, CI, cobertura de tests del webhook entrante.
- **Repositorio:** `noon-web-main`

---

## 2. Stack

- **Frontend:** Next.js **16.0.10** (App Router), React **19.2.0**, TypeScript strict, Tailwind **v4**, shadcn/ui, next-intl (en/es/fr/de)
- **Backend:** Next.js API Routes (runtime `nodejs`)
- **Base de datos:** PostgreSQL en Supabase, vía `postgres.js` (sin ORM); pool con `DATABASE_URL`/`POSTGRES_URL`, ssl=require
- **Auth:** NextAuth v5 (JWT), Google OAuth con `email_verified` requerido
- **IA:** OpenAI `gpt-4.1` (vía `openai` SDK), v0 SDK 0.16 para prototipos
- **i18n routing:** middleware `proxy.ts` (Next 16 renombró `middleware.ts` → `proxy.ts`)
- **Tests:** Vitest (unit/integration) + Playwright (visual + a11y)
- **Infra:** Sin AWS dedicada en este ciclo; Postgres/Supabase como única dependencia gestionada

---

## 3. Arquitectura (estado actual)

### Módulos estables (NO tocar):
- `app/page.tsx` y `app/[locale]/page.tsx` — Homepage pública
- `app/_components/site/` — Componentes de layout público (incluye `start-with-maxwell-flow.tsx`)
- `lib/site-config.ts`, `lib/site-tones.ts` — Config global y design tokens

### Maxwell Studio — implementado:
- `app/[locale]/maxwell/page.tsx` — entry; redirige al Studio con prompt
- `app/[locale]/maxwell/studio/page.tsx` — Studio (gate auth → shell)
- `app/[locale]/maxwell/review/...` — UI PM (lista + detalle + workspace)
- `app/[locale]/maxwell/workspace/[sessionId]/page.tsx` — Workspace post-pago
- `app/[locale]/maxwell/proposal/[token]/page.tsx` — viewer público de propuesta
- `app/api/maxwell/` — 13 routes (chat, proposal, prototype + poll, session, studio/{session, sessions, prototype-quota}, review, review-sla, payment, workspace, message-feedback)
- `app/api/integrations/noon-app/proposal-review-decision/route.ts` — webhook entrante HMAC-SHA256
- `components/maxwell/` (10): maxwell-gate, studio-shell, studio-header, studio-chat-pane, studio-preview-pane, studio-thinking-block, studio-correction-bar, studio-proposal-cta, prototype-quota-strip, proposal-document
- `lib/maxwell/` (13): repositories, state-machine, studio-guards, studio-status, prompts, proposal-{rules, lifecycle, content, email, review-sla}, prototype-quota, public-url, workspace-status
- `lib/server/db.ts` — postgres.js singleton; `lib/server/noon-storage.ts` ya migrado a Postgres
- `lib/noon-app-integration.ts` — handoff bidireccional firmado website ↔ Noon App
- `lib/auth/{review, session, ownership, redirect}.ts` — auth + ownership de sesiones

### Pendiente / Por crear:
- CI (`.github/workflows/`) — no existe
- Tests del webhook entrante `proposal-review-decision`
- Tests de `/api/maxwell/payment`, `/api/maxwell/chat`, `/api/maxwell/prototype/poll`
- Observabilidad estructurada (Sentry o equivalente)

---

## 4. Convenciones críticas

- Todos los routes API: `runtime = "nodejs"`, `dynamic = "force-dynamic"`, validación Zod
- Postgres vía `postgres.js` — sin ORM, queries directas con tagged templates
- Componentes client-side: `"use client"` explícito
- Estilos: Tailwind v4 + `siteTones` / `siteStatusTones` de `lib/site-tones.ts` — no hardcodear colores
- TypeScript strict; Server Components por defecto
- Cookies de sesión vía NextAuth (httpOnly)
- IDs: `crypto.randomUUID()`; fechas: ISO 8601
- No introducir AWS dedicada, Redis ni complejidad infra extra en este ciclo

---

## 5. Restricciones no negociables

1. Homepage y navegación pública: PRESERVAR intactas
2. No entregar código, repo ni acceso técnico antes del pago
3. Máximo 2 correcciones pre-propuesta (guarda dual: código en `studio-guards.ts` + CHECK constraint en DB)
4. Toda propuesta pasa por revisión humana antes del envío
5. `client_workspace` solo con `payment_status = confirmed`
6. Propuesta: Pago único + Membresía como principales; Pago flexible como secundario
7. Sin descuento automático por full payment en la propuesta
8. Sin AWS ni infra cloud en este ciclo

---

## 6. Estado actual (verificado 2026-05-08)

### Implementado y funcional:
- Studio completo: shell, chat pane, preview pane, gate, correction bar, proposal CTA, thinking block, quota strip
- State machine con transiciones validadas (`assertValidTransition`) y guards (`assertCanRequestProposal`, `assertCanRequestCorrection`, etc.)
- Persistencia Postgres: `studio_session`, `studio_message`, `studio_message_feedback`, `studio_brief`, `studio_version`, `proposal_request`, `proposal_review_event`, `client_workspace`, `workspace_update`, `payment_event`, `studio_event`, más tablas de upgrade (13 migraciones)
- `proposal/route.ts` reescrito: usa `validateProposalDraft`, `stripInternalReviewFlags`, guards, ownership, handoff a Noon App
- Cola de revisión humana operativa: `/maxwell/review` UI + `/api/maxwell/review` con auth dual (Google allowlist o Bearer secret)
- Webhook entrante con HMAC-SHA256 + clock skew 5 min + comparación timing-safe
- Auth Google con `email_verified`; ownership por `owner_email`
- i18n: 4 idiomas (en/es/fr/de) prefix routing, redirects legacy → `/en/...` en `next.config.mjs`

### Riesgos abiertos:
- `auth.ts` degrada silenciosamente si faltan `AUTH_GOOGLE_ID/SECRET` (providers: [])
- Modelo OpenAI `gpt-4.1` hardcodeado en `lib/api-ia.ts`; no hay variable de entorno para override
- `NEXT_PUBLIC_SITE_URL` y `MAXWELL_PUBLIC_BASE_URL` solapan propósito
- Sin observabilidad estructurada (solo `console.warn/error`)

### Deudas legacy heredadas que siguen vivas (no resueltas en esta verificación):
- **Tabla `maxwell_sessions` + `/api/maxwell/session`** son del flujo modal antiguo y conviven con `studio_session` + `/api/maxwell/studio/session`. Pendiente: confirmar uso real y consolidar.
- **Cookie parsing manual** en `app/api/maxwell/session/route.ts` (líneas 10-15, 33-38). Pendiente: sustituir por `request.cookies` de Next.
- **`v0.chats.sendMessage` con cast forzado** en `lib/api-ia.ts:174`. Pendiente: revisar tipado cuando v0-sdk lo mejore.

---

## 7. Riesgos activos

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Sin CI: lint/test/build no automatizados | ALTO | Añadir `.github/workflows/ci.yml` |
| Webhook entrante sin tests de firma/replay/timestamp | ALTO | Tests en `tests/maxwell/noon-app-webhook.test.ts` |
| Auth degrada silenciosamente sin `AUTH_GOOGLE_*` | MEDIO | Fail-fast en producción |
| Modelo OpenAI hardcodeado | BAJO | Variabilizar `OPENAI_MODEL` |

---

## 8. Supuestos activos

| Supuesto | Riesgo si es falso |
|----------|--------------------|
| `DATABASE_URL`, `OPENAI_API_KEY`, `V0_API_KEY`, `AUTH_GOOGLE_*`, `NOON_APP_*` configurados | Boot/feature parcialmente roto |
| Supabase es la base canónica para Maxwell Studio | Drift entre runtime y esquema remoto |
| PM de Noon revisa propuestas vía Noon App (handoff) | Sin PM, propuesta queda en `pending_review` indefinido |
| Email de Google verificado es identidad suficiente del prospecto | Sin verificación adicional, riesgo de spoofing limitado |

---

## 9. Decisiones abiertas

| Decisión | Opciones | Impacto | Trigger |
|----------|----------|---------|---------|
| Notificación al PM cuando llega propuesta (más allá del webhook) | Email vs dashboard admin | UX PM | Si Noon App no notifica suficiente |
| Mecanismo de confirmación de pago | Webhook de pasarela vs manual | Producción | `/api/maxwell/payment` aún sin contrato documentado |
| Override de modelo OpenAI por env | `OPENAI_MODEL` vs hardcoded | Coste/latencia | Cuando se necesite A/B o fallback |

---

## 10. Siguiente paso recomendado

**Hardening en este orden:**

1. CI mínimo (`.github/workflows/ci.yml`): `lint`, `tsc --noEmit`, `vitest run`, `next build`
2. Tests del webhook entrante (`proposal-review-decision`): firma válida/inválida, timestamp expirado, replay, payload malformado
3. Mover `test-*.js` de raíz a `scripts/manual/` (no son tests)
4. Fail-fast de auth en producción si faltan `AUTH_GOOGLE_*`
5. Variabilizar `OPENAI_MODEL` (default `gpt-4.1`)
6. Observabilidad: integrar Sentry o equivalente

**Modo recomendado:** Refactor / Hardening
**Skills:** system-testing → system-infra → system-refactor
