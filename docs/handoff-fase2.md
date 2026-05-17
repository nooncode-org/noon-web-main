# Handoff — FASE 2 hardening (sesión 2026-05-16)

Estado al cierre de sesión 2026-05-17: **14 commits en `chore/fase2-hardening-2026-05-16` (pushed), working tree limpio, 491 tests verdes.**

Actualización 2026-05-17 PM: cerrados Bloque 11 (Maxwell Quality Layer, gpt-4.1) y B22 (mobile fallback banner). Quedan pendientes Bloque 12 (GDPR — pospuesto) y B8 #2/#3 (esperando email templates).

Si vuelves a este repo en frío, este doc te ahorra reconstruir contexto.

---

## 1 · Verificar estado al volver

```bash
cd C:\Users\melan\Proyectos\noon-web-main
git status                               # debe decir "working tree clean"
git log --oneline 248a323..HEAD          # debe listar los 11 commits abajo
npx tsc --noEmit                         # gate 1
npx eslint .                             # gate 2
npm test                                 # gate 3 → 447 tests pass
npm run build                            # gate 4 → "Compiled successfully"
```

Si algo no cuadra, el problema está en lo que pasó entre sesiones (HMR, ediciones manuales, dep update). NO sigas adelante hasta que los 4 gates queden verdes.

---

## 2 · Los 11 commits y qué cierran

| Hash | Bloque | Cierra | Tipo |
|---|---|---|---|
| `1cfb326` | Pre-compaction | B4, B7, B15, B26, B43 | chore |
| `8c961cc` | 1 | B18 + cross-repo secret docs | feat (security) |
| `60253a3` | 2 | B17 logger + B8 #1 + B26 | feat (observability) |
| `8cc24ac` | 3 | B10 atomic verify_payment | fix (payment) |
| `2503f4e` | 4 | B13 + B19 + B21 rate-limit | feat (security) |
| `e745d3e` | 5 | B9 retry + B1 secret runtime | feat (integration) |
| `4aeec8a` | 6 | B45 migrations infra | feat (ops) |
| `a660d34` | 8 | B37 landmarks + B39 chart delete | feat (a11y) |
| `f89145a` | 9 | B38 a11y matrix Playwright | test (a11y) |
| `a9e9a1b` | 10 | B29 + B30 + B31 + B40 | feat (ux) |
| `a16ba3b` | 7 | B42 Sentry skeleton | feat (observability) |

**Métricas:** 362 → 447 tests (+85), 0 regresiones, ~100 kb menos en bundle cliente (recharts eliminado), 1 dep nueva (`@sentry/nextjs`, no-op sin DSN).

---

## 3 · Acción inmediata: push + PR

Los commits viven sólo en local. Riesgo de pérdida hasta que estén en remoto.

**Recomendado:** branch + PR (mantiene el patrón del repo, ver PRs #2/#3/#4/#9/#10).

```bash
git checkout -b chore/fase2-hardening-2026-05-16
git push -u origin chore/fase2-hardening-2026-05-16

# Con gh CLI (si está instalado):
gh pr create --title "chore: FASE 2 hardening (11 commits, B17/B18/B10/B13-19-21/B9/B45/B37-39-40/B38/B29-30-31/B42)" \
  --body-file docs/handoff-fase2.md

# Sin gh: abre el repo en GitHub y crea el PR manualmente
# desde chore/fase2-hardening-2026-05-16 → main, usa este doc como descripción.
```

**No recomendado:** `git push origin main` directo — salta el review pattern del repo y estos commits tocan superficies de seguridad (rate-limit, atomic payment, retry, secret rename, logger).

---

## 4 · Checklist ops (no es código, lo hace Pedro/operador)

Orden importa: items con `→ desbloquea X` deben ir antes de X.

### 4.1 Antes de aplicar migraciones

- [ ] **Aplicar migración B45** en Supabase prod + preview: `psql $DATABASE_URL -f supabase/migrations/20260516_013_schema_migrations.sql`. Después insertar checksum en `schema_migrations` con `applied_by='manual:<tu-nombre>'`.
- [ ] **Aplicar las 13 migraciones legacy** si todavía no se han aplicado a prod. Lista completa en `supabase/migrations/` (las 14 primeras quedaron bootstrap-marcadas como aplicadas por la migración 013, pero el bootstrap no aplica el DDL — sólo dice que están registradas).

### 4.1-bis Antes del primer deploy público a producción (NO ANTES)

- [ ] **Rotar credenciales Supabase** (service role + anon). Filtradas en `App-nooncode/.mcp.json` commit `f433223` (público) desde 2026-04-23. Ver `~/.claude/.../memory/project_nooncode_warnings.md`.

  > **Decisión owner 2026-05-17:** rotación pospuesta hasta justo antes del primer deploy de producción público. Mientras el sitio no esté expuesto al mundo (FASE 1 internal-only por ADR-008), el riesgo es contenido al ámbito interno y compensado por: RLS de Supabase activo en todas las tablas, el `service_role` no es trivialmente descubrible si nadie explora el repo App, y rotación tardía evita coordinar cambio de env vars entre múltiples sandboxes durante desarrollo activo.
  >
  > **Riesgo residual asumido:** cualquiera que clone `App-nooncode` antes de la rotación puede leer/escribir todas las tablas bypaseando RLS. Vigila Supabase audit logs (Settings → Logs → Auth) periódicamente; si aparecen IPs no-Vercel/no-locales, rota inmediatamente sin esperar al deploy.
  >
  > **Disparador no-negociable de rotación:** (a) primer deploy a `nooncode.com` o subdominio público, (b) cualquier indicio de uso no-autorizado en logs, (c) más de 90 días desde el leak (2026-04-23) — sea lo que llegue primero.

### 4.2 Activar features nuevas

- [ ] **Sentry**: crear proyecto en Sentry → copiar DSN → setear `SENTRY_DSN` y `SENTRY_TRACES_SAMPLE_RATE` (0.1 default) en Vercel Production + Preview. Sin DSN el SDK es no-op (skeleton ya está en código).
- [ ] **Migrations drift check en Vercel**: setear `CHECK_MIGRATIONS=1` en env vars de Vercel → el `prebuild` script empieza a validar drift en cada deploy. Sin ese flag, el script es no-op.
- [ ] **UptimeRobot** apuntando a `https://<prod>/api/health` (público, sin auth, devuelve `{healthy, service, checked_at}`). Para diagnostic detallado: `/api/health/detail` con header `Authorization: Bearer <REVIEW_API_SECRET o CRON_SECRET>`.

### 4.3 Cross-repo

- [ ] **Coordinar con equipo App**: confirmar que App está enviando el header con `NOON_WEBSITE_WEBHOOK_SECRET` (nombre canónico). Web acepta los 2 nombres durante la migración. Cuando ambos repos hayan migrado, eliminar `NOON_APP_WEBHOOK_SECRET` de los envs.

### 4.4 Email (cuando se vaya a usar)

- [ ] **Resend domain verification** (SPF + DKIM). Bloquea Bloque 13 (B8 #2/#3 emails). El B8 #1 (sendProposalEmail on approve) ya está en código (commit `60253a3`) pero requiere el dominio verificado para que los emails salgan.

---

## 5 · Decisiones owner pendientes

3 bloques quedaron sin ejecutar porque requieren decisión humana, no porque falte código.

### 5.1 · Bloque 11 — Maxwell Quality Layer

**Bloqueo:** el spec en `maxwell-quality-layer.md` (descargado a `~/Downloads` originalmente, no en el repo) define 24 familias visuales × 72 referencias para mejorar la calidad de los prototypes v0. Sin tener ese doc en el repo y validado, implementar las 24 familias sería adivinar.

**Adicional:** el spec sugiere bumpear el modelo a `gpt-5.5`. El default actual es `gpt-4.1` (`lib/api-ia.ts:98`). No sé si `gpt-5.5` existe / está GA en OpenAI.

**Lo que necesitas decidir:**
- Copiar `maxwell-quality-layer.md` a `docs/maxwell/quality-layer.md` y firmarlo como spec oficial.
- Confirmar si `gpt-5.5` está disponible o si seguimos con `gpt-4.1`.

**Default si quieres avanzar sin más spec:** `gpt-4.1` actual, implementar style packs como bloque cohesivo con feature flag `MAXWELL_QUALITY_LAYER=true` para rollback fácil. ETA real: 10–14 h.

### 5.2 · Bloque 12 — B14 GDPR hard-delete

**Bloqueo:** dos decisiones irreversibles.

1. **¿Self-service endpoint o SLA manual?**
   - Recomendado (default): SLA manual + script CLI con dry-run. ADR-008 dice "internal-only FASE 1", no hay portal cliente todavía.
   - Alternativa: endpoint `/api/account/delete` que el cliente dispara — requiere portal cliente, NO existe en FASE 1.

2. **¿Borrar o anonimizar `payment_event`?**
   - Recomendado (default): anonimizar (`email→null`, `provider_payment_intent_id` preservado para reconciliación Stripe y contabilidad).
   - Alternativa: borrar — más limpio para GDPR pero rompe el ledger de pagos. Stripe + contabilidad pueden requerir retención.

**Riesgo:** acción irreversible. Mitigación: dry-run obligatorio + snapshot pre-delete + 2-person approval en runbook.

### 5.3 · Bloque 13 — B22 + B8 #2/#3

**B22 (preview pane mobile):** ¿bloqueo explícito "Studio requires desktop", rediseño responsive completo (1–2 días), o aceptar fallback actual (0 h, sólo doc)? Default plan: aceptar fallback.

**B8 #2 (sendProposalEmail on payment-confirmed) + #3 (sendProposalEmail on workspace-activated):** necesitan copy y templates aprobados por owner. Sin templates no hay código.

---

## 6 · Archivos clave creados / modificados (referencia rápida)

### Nuevos archivos

- `lib/server/logger.ts` — logger PII-safe (Bloque 2)
- `lib/server/rate-limit.ts` — token bucket (Bloque 4)
- `lib/server/sentry.ts` — Sentry skeleton (Bloque 7)
- `app/api/health/detail/route.ts` — health gated (Bloque 1)
- `app/global-error.tsx` — root error boundary (pre-compaction B4)
- `instrumentation.ts` — Next.js boot hook (pre-compaction B43 + Bloque 7)
- `lib/server/runtime-env.ts` — env validator (pre-compaction B43)
- `scripts/check-migrations.{mjs,lib.mjs}` — drift check (Bloque 6)
- `supabase/migrations/20260516_013_schema_migrations.sql` — ledger (Bloque 6)
- `docs/migrations.md` — runbook (Bloque 6)
- `tests/visual/a11y-matrix.spec.ts` — Playwright matrix (Bloque 9)
- Tests asociados en `tests/{lib,health,scripts,maxwell}/`

### Modificaciones notables

- `lib/noon-app-integration.ts` — secret rename + retry/backoff (Bloques 1+5)
- `lib/maxwell/payment-activation.ts` — orden atomic (Bloque 3)
- `components/maxwell/studio-shell.tsx` — landmarks (Bloque 8)
- `components/maxwell/studio-chat-pane.tsx` — composer simplify + tap targets (Bloques 8+10)
- `components/maxwell/studio-header.tsx` — confirm delete (Bloque 10)
- 16 routes bajo `app/api/**` — migración a logger (Bloque 2)
- `next.config.mjs` — CSP/HSTS (pre-compaction B15)
- `package.json` — `prebuild` script, `db:check-migrations`, `@sentry/nextjs` añadido, `recharts` eliminado

### Borrados

- `components/ui/chart.tsx` — dead code, 0 consumers (Bloque 8 / B39)

---

## 7 · Cuando vuelvas — orden sugerido

1. ~~**Push**~~ ✅ — hecho 2026-05-17, branch `chore/fase2-hardening-2026-05-16` en origin.
2. **Crea el PR en GitHub** (sección 3) — usa el link que dio el push + pega body de este doc.
3. **Aplica migración 013 + las 13 legacy** (sección 4.1) — bloquea cualquier deploy nuevo.
4. **Configura Sentry + Vercel envs** (sección 4.2) — activa lo que el código ya espera.
5. **Decide Bloques 11/12/13** (sección 5) — cuando tengas energía para meter cabeza en specs.
6. Coordina cross-repo (4.3) y Resend (4.4) en paralelo.
7. **Rotar credenciales Supabase** (sección 4.1-bis) — pospuesto por decisión owner 2026-05-17 hasta el primer deploy público o 2026-07-22 (90 días post-leak), lo que llegue primero.

---

_Generado 2026-05-16, actualizado 2026-05-17 (push + reprioritización rotación Supabase)._
