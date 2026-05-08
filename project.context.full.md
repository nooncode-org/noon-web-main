# project.context.full.md — Noon / Maxwell Studio

> **Última actualización:** 2026-05-08
> **Usar cuando:** Recovery, Architecture, Validator, Refactor mayor
> **Estado del repo:** Studio operativo (Fases 1–6 completadas). Hardening pendiente.

---

## 1. Identidad completa

- **Proyecto:** Noon — boutique de software profesional
- **Problema que resuelve:** Empresas necesitan software custom pero el proceso de intake, definición y propuesta es lento, opaco y costoso.
- **Usuarios del Studio:** Prospectos (pre-pago) y PM de Noon (revisión de propuesta vía Noon App, no website).
- **Usuarios post-pago:** Clientes activos (workspace formal en `app/[locale]/maxwell/workspace/[sessionId]`).
- **Owner:** Juan (operador de Noon).
- **Estado del repo:** Producción interna — Studio funcional, propuestas firmadas hacia Noon App, hardening (CI, tests de webhooks, observabilidad) pendiente.

---

## 2. Stack completo

### Frontend
- Next.js **16.0.10** (App Router, `app/` directory, Turbopack)
- React **19.2.0**, TypeScript strict
- Tailwind CSS **v4** (`@tailwindcss/postcss`)
- shadcn/ui (componentes base) + Radix primitives
- Lucide icons
- next-themes, sonner (toasts), embla-carousel
- Custom design system: `lib/site-tones.ts`, `lib/site-config.ts`

### i18n
- `next-intl` v4
- 4 locales: `en` (default), `es`, `fr`, `de`
- Prefix routing always (locale en URL)
- Middleware en `proxy.ts` raíz (Next 16 renombró `middleware.ts` → `proxy.ts`)
- Mensajes en `messages/{locale}.json`
- Configuración: `i18n/routing.ts`, `i18n/request.ts`

### Backend
- Next.js API Routes (Server Actions usadas en `app/[locale]/maxwell/review/_actions/auth.ts`)
- Runtime: `nodejs` (sin edge — Postgres y SDKs lo requieren)
- Validación: Zod en todos los endpoints
- `dynamic = "force-dynamic"` en routes de Maxwell

### Base de datos
- **PostgreSQL en Supabase** vía `postgres.js` (sin ORM)
- Cliente singleton en `lib/server/db.ts` con `globalThis` (Next HMR-safe)
- Conexión: `DATABASE_URL` (o `POSTGRES_URL`), ssl=require, pool máx 10 (`DB_MAX_CONNECTIONS`), `DB_CONNECT_TIMEOUT_SECONDS=20`, `DB_IDLE_TIMEOUT_SECONDS=30`
- Schema canónico: `supabase/schema.sql`
- 13 migraciones en `supabase/migrations/` (rangos: 20260406 a 20260430)

### Auth
- NextAuth v5 (`auth.ts` raíz)
- Provider: Google OAuth con `prompt=select_account`
- Estrategia: JWT
- `signIn` callback exige `email_verified === true` y proveedor Google
- `email`, `name`, `picture` propagados a token y session

### IA
- OpenAI SDK v6.33.0, modelo `gpt-4.1` por defecto en `chatWithOpenAI`
- v0 SDK v0.16.4 (`v0-sdk`) — `responseMode: "async"` para create/update; cliente global
- Wrapper común: `lib/api-ia.ts` exports `chatWithOpenAI`, `createV0Prototype`, `updateV0Prototype`, `getV0PrototypeStatus`
- `OPENAI_API_KEY` validada en runtime (lazy); `V0_API_KEY` configurada globalmente por el SDK

### Tests
- Vitest v4 (`vitest.config.ts`): `npm test`, `npm run test:watch`, `npm run test:coverage`
- Playwright v1.59 (`playwright.config.ts`): visual + a11y
- Estructura:
  - `tests/maxwell/` (13): api-smoke, auth-gating, noon-app-integration, prompts, proposal-content, proposal-email, proposal-lifecycle, proposal-rules, prototype-quota, public-url, review-auth, state-machine, studio-guards
  - `tests/contact/contact-abuse.test.ts`
  - `tests/visual/`: a11y.spec.ts (axe-core), capture.spec.ts (visual regression)

### Mail
- Resend (`MAIL_PROVIDER=resend`, `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_REPLY_TO`)
- Templates: `lib/maxwell/proposal-email.ts`

### Infra
- Sin AWS, sin Redis, sin S3
- Deployment local/VPS o Vercel-compatible (a confirmar por entorno)
- No hay `.github/workflows/` — sin CI

---

## 3. Arquitectura completa

### Capa pública (PRESERVAR)
```
app/
  [locale]/
    page.tsx                         ← Homepage (módulos revelados en scroll)
    contact/, about/, services/, …   ← Páginas públicas
  _components/site/                  ← Layout público: nav, frame, cards, footer, start-with-maxwell-flow
lib/
  site-config.ts                     ← Rutas y configuración del sitio
  site-tones.ts                      ← Sistema de color semántico (siteTones, siteStatusTones)
  contact.ts                         ← Tipos y validación del formulario de contacto
```

### Capa Maxwell Studio (operativa)
```
app/[locale]/maxwell/
  page.tsx                                       ← Entry: redirige al Studio con prompt
  studio/page.tsx                                ← Studio (auth gate → StudioShell)
  review/page.tsx                                ← Lista PM (review queue UI)
  review/[id]/page.tsx                           ← Detalle de propuesta para PM
  review/[id]/_components/review-actions.tsx
  review/workspace/[workspaceId]/page.tsx        ← Workspace en review
  review/_actions/auth.ts                        ← Server Actions para PM auth
  review/_components/{review-login, status-badge}.tsx
  workspace/[sessionId]/page.tsx                 ← Workspace post-pago del cliente
  proposal/[token]/page.tsx                      ← Viewer público de propuesta

app/api/maxwell/
  chat/route.ts                  ← OpenAI gpt-4.1; persiste mensajes; extrae señales
  prototype/route.ts             ← v0 create/update encapsulado en sesión + ownership
  prototype/poll/route.ts        ← Poll de estado de generación v0
  proposal/route.ts              ← Genera draft + valida + handoff signed a Noon App
  session/route.ts               ← Captura prompt + cookie (LEGACY del flujo modal; convive con studio/session)
  studio/session/route.ts        ← CRUD studio_session (canónico)
  studio/sessions/route.ts       ← Lista sessions del usuario (history)
  studio/prototype-quota/route.ts ← Cuota de prototipos del usuario
  workspace/route.ts             ← Upsert workspace post-pago
  message-feedback/route.ts      ← Up/down feedback en mensajes
  review/route.ts                ← Auth dual; lectura de cola de review (mutaciones deshabilitadas)
  review-sla/route.ts            ← SLA de revisión
  payment/route.ts               ← 5 acciones (mark_payment_pending, submit_evidence, verify_payment, expire_proposal, confirm_payment); auth dual; activa client_workspace; handoff a Noon App. Tests pendientes.

app/api/integrations/noon-app/
  proposal-review-decision/route.ts   ← Webhook entrante HMAC-SHA256 desde Noon App

components/maxwell/                       (10 componentes, completos)
  maxwell-gate.tsx                ← Diálogo de entrada al Studio
  studio-shell.tsx                ← Orquestador (header + chat pane + preview pane + quota)
  studio-header.tsx
  studio-chat-pane.tsx            ← Mensajes, feedback, thinking, correction bar, CTA propuesta
  studio-preview-pane.tsx         ← Iframe del prototipo v0
  studio-thinking-block.tsx
  studio-correction-bar.tsx
  studio-proposal-cta.tsx
  prototype-quota-strip.tsx
  proposal-document.tsx           ← Render de propuesta para el viewer público

lib/maxwell/                              (13 módulos, completos)
  repositories.ts                 ← Persistencia Postgres: studio_session, message, brief, version, proposal_request, etc.
  state-machine.ts                ← Transiciones válidas: intake → clarifying → generating_prototype → prototype_ready → … → converted
  studio-guards.ts                ← assertCanRequestProposal, assertCanRequestCorrection, MaxwellGuardError
  studio-status.ts                ← Helpers de estado
  prompts.ts                      ← System prompts (chat discovery, propuesta, prototipo) multilingües
  proposal-rules.ts               ← Perfil comercial, validación de drafts (`validateProposalDraft`)
  proposal-lifecycle.ts           ← Clasificación, expiración, timeline de revisión
  proposal-content.ts             ← stripInternalReviewFlags, formateo
  proposal-email.ts               ← Templates de email (Resend)
  proposal-review-sla.ts          ← Cálculo de SLA
  prototype-quota.ts              ← Lógica de cuota de prototipos iniciales
  public-url.ts                   ← URLs públicas (demos, propuestas)
  workspace-status.ts             ← Tipos y helpers de WorkspaceStatus

lib/server/
  db.ts                           ← postgres.js singleton (getDb)
  noon-storage.ts                 ← Tablas legacy (contact_leads, maxwell_sessions); ya migrado a Postgres
  contact-abuse.ts                ← Rate limiting

lib/auth/
  session.ts                      ← getAuthenticatedViewer
  ownership.ts                    ← viewerOwnsStudioSession
  review.ts                       ← Auth dual (Google allowlist o Bearer secret) para /api/maxwell/review
  redirect.ts                     ← buildSignInHref

lib/
  noon-app-integration.ts         ← Outbound + verificación inbound HMAC-SHA256, clock skew 5 min, timing-safe
  api-ia.ts                       ← Wrapper OpenAI + v0
```

### Capa post-pago (operativa parcialmente)
```
app/[locale]/maxwell/workspace/[sessionId]/   ← Portal cliente post-pago
                                              ← Bloqueado por payment_status = confirmed (CHECK constraint)
```

---

## 4. Convenciones

### Código general
- TypeScript strict, sin `any` explícito
- Zod para validación en todos los API routes (request body)
- `crypto.randomUUID()` para IDs
- Fechas en ISO 8601 string (`new Date().toISOString()`)

### Frontend
- Server Components por defecto; `"use client"` solo cuando hay estado, efectos o handlers de eventos
- Tailwind v4 utility-first; sin CSS modules
- Colores: siempre vía `siteTones.X.{accent,surface,border,shadow,contrast}`; no hardcodear hex salvo en `site-tones.ts`
- Animaciones: clases Tailwind + `transition-all duration-{X}`; `useRevealOnView` hook donde aplique
- Íconos: Lucide React

### Backend (API routes)
- `export const runtime = "nodejs"` en todos los routes con DB o IA
- `export const dynamic = "force-dynamic"` en todos los routes
- Errores: `{ message: string, code?: string, fieldErrors?: object }`
- Cookies: `httpOnly: true`, `sameSite: "lax"`, `secure: production`
- Auth: `getAuthenticatedViewer()` + `viewerOwnsStudioSession()` antes de mutar

### Base de datos
- Todas las tablas con `id TEXT PRIMARY KEY` (UUID)
- `created_at TIMESTAMPTZ NOT NULL` y `updated_at TIMESTAMPTZ NOT NULL` donde aplique
- Índices en columnas de búsqueda frecuente
- CHECK constraints para enums y guardas críticas (max correcciones, payment status)
- Soft delete vía `deleted_at TIMESTAMPTZ NULL` en `studio_session`

---

## 5. Seguridad y datos

- API keys solo en variables de entorno del servidor (nunca en cliente)
- Cookies de sesión: NextAuth gestiona httpOnly automáticamente
- Input validation en todos los endpoints vía Zod
- `client_workspace` con CHECK constraint a nivel DB para prevenir activación sin pago
- Webhook entrante HMAC-SHA256 + timestamp (clock skew ≤ 5 min) + comparación timing-safe
- Webhook saliente firma payload completo (con timestamp prefijado)
- Allowlist de PMs en `REVIEW_ALLOWED_EMAILS`; en `NODE_ENV !== "production"` y allowlist vacía, cualquier sesión Google es team member (modo dev)

### Superficie de riesgo conocida
- Webhook entrante sin tests automatizados → regresión de auth posible
- `auth.ts` no falla si `AUTH_GOOGLE_*` no están configurados (providers vacíos): la app arranca pero login imposible
- `proposal/[token]`: usa `publicToken = crypto.randomUUID()` (columna `public_token TEXT NOT NULL UNIQUE`); no es id directo y no es enumerable. Riesgo residual: si una URL se filtra, queda viva mientras la propuesta no expire.

---

## 6. Contratos y dependencias

### Frontend → Backend (Maxwell Studio)
| Frontend consume | Backend provee | Contrato |
|------------------|----------------|----------|
| `studio-shell.tsx` | `POST /api/maxwell/chat` | `{ session_id, prompt }` → `{ reply, signals }` |
| `studio-shell.tsx` | `POST /api/maxwell/prototype` | `{ session_id, action: "create"\|"update", prompt? }` → `{ chatId, demoUrl }` |
| `studio-shell.tsx` | `GET /api/maxwell/prototype/poll?chat_id=…` | `{ status, demoUrl?, versionId? }` |
| `studio-shell.tsx` | `POST /api/maxwell/proposal` | `{ session_id }` → `{ proposal_request_id, status, session_status, review_flags, noon_app_handoff_skipped }` |
| `studio-shell.tsx` | `GET/POST /api/maxwell/studio/session` | CRUD studio_session |
| `start-with-maxwell-flow.tsx` | `GET /api/maxwell/studio/sessions` | History picker |
| `studio-shell.tsx` | `POST /api/maxwell/message-feedback` | `{ message_id, feedback: "up"\|"down" }` |

### Webhooks Noon App (bidireccional, firmados)
- **Saliente:** `POST {NOON_APP_BASE_URL}/api/integrations/website/inbound-proposal` (proposal handoff) y `/payment-confirmed`
- **Entrante:** `POST /api/integrations/noon-app/proposal-review-decision`
- Headers: `x-noon-signature: sha256=<hex>`, `x-noon-timestamp: <epoch_seconds>`
- Body firmado: `${timestamp}.${bodyText}` con HMAC-SHA256(`NOON_APP_WEBHOOK_SECRET`)

### Variables de entorno requeridas
```
# Core runtime
DATABASE_URL                 # Postgres connection (Supabase pooler o direct)
DB_CONNECT_TIMEOUT_SECONDS=20
DB_IDLE_TIMEOUT_SECONDS=30
DB_MAX_CONNECTIONS=10
AUTH_SECRET                  # NextAuth
NEXT_PUBLIC_SITE_URL         # URL pública (cliente)
MAXWELL_PUBLIC_BASE_URL      # URL para links absolutos en propuestas/emails

# OAuth
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET

# IA
OPENAI_API_KEY
V0_API_KEY

# Internal review access
REVIEW_ALLOWED_EMAILS        # CSV/whitespace de emails autorizados
REVIEW_API_SECRET            # Bearer secret para automation

# Mail
MAIL_PROVIDER                # ej. "resend"
MAIL_FROM
MAIL_REPLY_TO
RESEND_API_KEY

# Noon App bridge
NOON_APP_BASE_URL
NOON_APP_WEBHOOK_SECRET
```

---

## 7. ADRs (Decisiones de Arquitectura)

### ADR-001: PostgreSQL/Supabase como persistencia (reemplaza el ADR-001 SQLite original)
**Decisión:** Usar `postgres.js` contra Supabase Postgres, sin ORM.
**Contexto:** El ADR original (SQLite local con `node:sqlite`) se reemplazó cuando el dominio creció (multi-instancia, soft delete, CHECK constraints, integraciones cross-product). Migración completada en abril 2026.
**Razón:** Supabase ofrece pooler, backups, migraciones versionadas y SSL gratis sin operar infra. `postgres.js` mantiene la simplicidad de SQL directo sin ORM.
**Trade-off:** Dependencia externa de Supabase. Coste medible en facturación. Aceptado.

### ADR-002: v0 como motor de prototipado
**Decisión:** v0 SDK para generación y actualización de prototipos.
**Razón:** Calidad visual alta sin infraestructura de rendering propia.
**Trade-off:** Dependencia externa; v0 chatId como referencia de versión; eventual consistency tras `create` (manejado en `getV0PrototypeStatus`).

### ADR-003: Estado de sesión Maxwell persistido en backend
**Decisión:** Toda la conversación, brief, versiones de prototipo y propuesta viven en Postgres; el frontend deriva de la API.
**Estado:** Completado en Fase 2; las rutas Studio canónicas están en `app/api/maxwell/studio/*`.
**Implicación:** El frontend nunca debe asumir estado local autoritativo; siempre re-fetchar al recargar sesión.

### ADR-004: Revisión humana obligatoria para propuestas
**Decisión:** Toda propuesta generada entra en `pending_review`; nunca se envía automáticamente.
**Razón:** Control de calidad comercial y protección contra errores de la IA.
**Implementación:** PM revisa via Noon App (handoff firmado) y devuelve decisión a `/api/integrations/noon-app/proposal-review-decision`. La UI de review en website (`/maxwell/review`) es de lectura/auditoría; las mutaciones legacy están deshabilitadas.

### ADR-005: Guardas de corrección como constraint dual (código + DB)
**Decisión:** El límite de 2 correcciones se refuerza tanto en `studio-guards.ts` como en CHECK constraint a nivel Postgres.
**Razón:** Defensa en profundidad; un bug en la aplicación no puede saltarse la guarda.

### ADR-006: i18n con prefix routing siempre
**Decisión:** Todas las rutas tienen prefijo de locale (`/en/...`, `/es/...`, etc.). Redirects legacy en `next.config.mjs` apuntan a `/en/...`.
**Razón:** Predecible para SEO y simplifica caché. Coste: usuarios con browser fr/de aterrizan en inglés desde rutas legacy.

### ADR-007: Auth dual para `/api/maxwell/review`
**Decisión:** Aceptar Google session (con allowlist `REVIEW_ALLOWED_EMAILS`) o `Bearer ${REVIEW_API_SECRET}` header.
**Razón:** Permite humanos (PM) y automation (Noon App, scripts) con un solo endpoint.

---

## 8. Estado detallado de módulos

| Módulo | Estado | Próxima acción |
|--------|--------|----------------|
| `app/[locale]/page.tsx` (homepage) | Estable | Preservar |
| `app/[locale]/maxwell/page.tsx` | Redirector | Preservar |
| `app/[locale]/maxwell/studio/page.tsx` | Operativo | Preservar |
| `app/[locale]/maxwell/review/*` | Operativo (lectura) | Preservar; mutaciones via Noon App |
| `app/[locale]/maxwell/proposal/[token]/page.tsx` | Operativo | Confirmar tipo de token |
| `components/maxwell/*` | Operativo | Refactor menor si UX evoluciona |
| `lib/maxwell/repositories.ts` | Operativo | Mantener |
| `lib/maxwell/state-machine.ts` | Operativo | Preservar |
| `lib/maxwell/proposal-rules.ts` | Operativo | Mantener alineado con `docs/maxwell/maxwell-commercial-constraints.md` |
| `lib/api-ia.ts` | Operativo | Variabilizar `OPENAI_MODEL` |
| `lib/server/noon-storage.ts` | Operativo (Postgres) | Mantener |
| `lib/noon-app-integration.ts` | Operativo | Añadir tests del entrante |
| `auth.ts` | Operativo | Fail-fast en producción |
| `proxy.ts` | Operativo | Preservar |
| `app/api/maxwell/proposal/route.ts` | Reescrito; sin contenido prohibido | Preservar |
| `app/api/maxwell/payment/route.ts` | Operativo; contrato en código (Zod + 5 acciones); falta doc externa y tests | Tests + `docs/maxwell/payment-flow.md` |
| `app/api/maxwell/session/route.ts` | Legacy (modal flow); cookie parsing manual | Consolidar o documentar coexistencia con `/studio/session` |
| `lib/api-ia.ts` v0 type cast (línea 174) | Cast forzado sigue presente | Revisar cuando v0-sdk mejore tipado |
| `maxwell_sessions` (tabla) | Legacy modal flow; persiste en schema | Mantener mientras `/api/maxwell/session` exista |
| `app/api/integrations/noon-app/proposal-review-decision/route.ts` | Operativo | Tests de firma/replay/timestamp |
| `.github/workflows/` | NO EXISTE | Crear `ci.yml` |
| `tests/` | Buena cobertura unit | Cubrir webhook entrante, payment, chat, prototype/poll |

---

## 9. Deuda técnica conocida

| Deuda | Severidad | Plan |
|-------|-----------|------|
| Sin CI/CD | ALTA | Añadir `ci.yml` (lint + tsc + vitest + build) |
| Webhook entrante sin tests | ALTA | `tests/maxwell/noon-app-webhook.test.ts` |
| `auth.ts` degrada silenciosamente | MEDIA | Fail-fast en producción |
| Tabla `maxwell_sessions` + `/api/maxwell/session` legacy conviven con `studio_session` + `/api/maxwell/studio/session` | MEDIA | Confirmar que solo se usa para captura inicial de prompt; consolidar o documentar la división |
| Cookie parsing manual en `app/api/maxwell/session/route.ts:10-15, 33-38` | BAJA | Sustituir por `request.cookies` de Next |
| `v0.chats.sendMessage` con cast forzado (`lib/api-ia.ts:174`) | BAJA | Revisar tipado cuando v0-sdk mejore |
| Modelo OpenAI hardcodeado | BAJA | `OPENAI_MODEL` env override |
| `NEXT_PUBLIC_SITE_URL` vs `MAXWELL_PUBLIC_BASE_URL` solapan | BAJA | Documentar diferencia o consolidar |
| Sin observabilidad estructurada | MEDIA | Sentry o equivalente |
| `payment/route.ts` sin tests automatizados ni doc externa (contrato sí existe en código: Zod discriminatedUnion + 5 acciones) | MEDIA | Añadir tests y `docs/maxwell/payment-flow.md` |

---

## 10. Restricciones

1. **No AWS / cloud** en este ciclo
2. **Homepage pública intacta** — ningún cambio en `app/page.tsx` ni en `app/_components/site/`
3. **Sin ORM** — `postgres.js` directo
4. **`client_workspace` bloqueado hasta pago confirmado** — CHECK constraint a nivel DB
5. **Propuesta siempre en revisión humana** — no hay bypass
6. **Max 2 correcciones** — guarda dual código + DB

---

## 11. Supuestos

- `DATABASE_URL`, `OPENAI_API_KEY`, `V0_API_KEY`, `AUTH_GOOGLE_*` y `NOON_APP_*` configurados en cada entorno
- Supabase es la base canónica; el repo es la fuente del esquema
- Un PM revisa propuestas via Noon App; el website es informacional
- Un email Google verificado es identidad suficiente del prospecto
- La migración SQL más reciente (`20260430_011_studio_session_soft_delete.sql`) está aplicada en todos los entornos donde el código corre (validar antes de eliminar el guard de runtime)

---

## 12. Decisiones abiertas

| Decisión | Opciones | Impacto | Trigger |
|----------|----------|---------|---------|
| Notificación al PM más allá del webhook | Email / dashboard | UX PM | Si Noon App no notifica suficiente |
| Pasarela de pago externa | Stripe / manual / simulado | Producción | El route ya implementa el ciclo interno; falta vincular pasarela real |
| Override de modelo OpenAI | env vs hardcoded | Coste/latencia | A/B o fallback |

---

## 13. Continuidad

### Última iteración significativa (Fases 1–6, abril 2026):
- Migración SQLite → Postgres completada
- `proposal/route.ts` reescrito (sin contenido comercial prohibido)
- Cola de revisión humana operativa (`/maxwell/review`) + handoff firmado a Noon App
- Webhook entrante HMAC-SHA256 con anti-replay
- Auth Google con allowlist + Bearer dual
- 13 migraciones Postgres aplicadas
- 13 tests Vitest + visual/a11y Playwright
- Soft delete de `studio_session`

### Próxima iteración recomendada — Hardening:
1. CI mínimo (`.github/workflows/ci.yml`)
2. Tests del webhook entrante (firma, timestamp, replay)
3. Mover scripts manuales (`test-*.js`) fuera de raíz
4. Fail-fast de auth en producción
5. Variabilizar `OPENAI_MODEL`
6. Observabilidad (Sentry o equivalente)

**Modo:** Refactor / Infra / Testing
**Skills:** system-testing → system-infra → system-refactor

---

## 14. Entornos

- **Dev:** Local, Postgres remoto (Supabase) o local. `.env` con keys de dev. `npm run dev` con Turbopack.
- **Prod:** VPS o Vercel-compatible; Postgres en Supabase con SSL. Misma stack.
- **Staging:** No formalizado; se recomienda crearlo cuando haya CI.

---

## 15. Referencias

- Especificación Studio: `docs/maxwell/maxwell-studio-v1-spec.md`
- Máquina de estados y modelo de datos: `docs/maxwell/maxwell-studio-state-machine.md`
- Constraints comerciales: `docs/maxwell/maxwell-commercial-constraints.md`
- Runtime de contact + Maxwell: `docs/contact-and-maxwell-runtime.md`
- Roadmaps históricos: `docs/roadmaps/` (referencia, no fuente de verdad actual)
- Items pendientes históricos: `docs/website-missing-items.txt`
- Legal source: `docs/legal-source/`
- IA wrapper: `lib/api-ia.ts`
- Persistencia: `lib/server/db.ts`, `lib/maxwell/repositories.ts`
- Diseño del sistema: `lib/site-tones.ts`, `lib/site-config.ts`
- Schema DB: `supabase/schema.sql`, `supabase/migrations/`
