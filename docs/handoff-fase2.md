# Handoff — FASE 2 hardening (sesión 2026-05-16/17/18)

**Estado al 2026-05-18 PM:** `main` HEAD en `b4ab857`, **513 tests verdes**, working tree limpio. PR #13 ya mergeado por nooncode-tech (cuerpo grande FASE 2). Después se mergearon 3 PRs adicionales esta sesión (PR #14 F-1 security, PR #15 B28 polling UX, PR #16 npm audit fix).

Actualización 2026-05-17 PM: cerrados Bloque 11 (Maxwell Quality Layer, gpt-4.1) y B22 (mobile fallback banner).

Actualización 2026-05-18 PM (esta sesión): 3 PRs directos a main + verificación productiva — ver sección "5-tris" para detalle.

Si vuelves a este repo en frío, este doc te ahorra reconstruir contexto.

---

## 1 · Verificar estado al volver

```bash
cd C:\Users\melan\Proyectos\noon-web-main
git status                               # debe decir "working tree clean"
git log --oneline -10                    # debe mostrar b4ab857 al tope
npx tsc --noEmit                         # gate 1
npx eslint .                             # gate 2
npm test                                 # gate 3 → 513 tests pass
npm run build                            # gate 4 → "Compiled successfully"
```

Si algo no cuadra, el problema está en lo que pasó entre sesiones (HMR, ediciones manuales, dep update). NO sigas adelante hasta que los 4 gates queden verdes.

**Verificación en producción (10 seg):**
```bash
curl -s https://noon-main.vercel.app/api/health
# → {"service":"api","healthy":true,"checked_at":"..."}

curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://noon-main.vercel.app/api/integrations/noon-app/proposal-review-decision \
  -H "x-noon-signature: sha256=0000" -H "content-type: application/json" -d '{}'
# → 401 (F-1 fix activo)
```

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

  > **Supply-chain note (2026-05-17):** `@sentry/nextjs@10.53.1` se instaló durante Bloque 7 sin pre-verificar IOC post-Mini-Shai-Hulud (npm hack 2026-05-11). Auditoría posterior: maintainer oficial, integrity hash matchea registry, `npm audit` sin alertas, Sentry no aparece en IOC públicos del incidente. **Owner decision: mantener.** Antes de setear `SENTRY_DSN` en prod, re-correr `npm audit` + comparar `npm view @sentry/nextjs@10.53.1 dist.integrity` con lockfile, por si surgió alguna advisory entre commit y deploy.
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

## 5-bis · Auditoría B-series dudosos (2026-05-18 PM)

Tras el merge de PR #13 quedaron 8 items B-series clasificados como "verificar". Audit ejecutado 2026-05-18 PM contra `main` actual:

| Item | Estado real | Ubicación / ETA si falta |
|---|---|---|
| B27 interceptor 401 → signin | ✅ Done | `components/maxwell/studio-shell.tsx:435` + `components/maxwell/public-proposal-payment.tsx:100`. Usan `router.push('/en/signin?callbackUrl=...')`. |
| B33 metadataBase + openGraph | ✅ Done | `app/layout.tsx:27-37`. |
| B35 quitar `images: { unoptimized: true }` | ✅ Done | Ya removido de `next.config.mjs` (no aparece la key). |
| B36 viewport + themeColor | ✅ Done | `app/layout.tsx:62-65`. |
| B41 uninstall three / react-three / geist | ✅ Done | No aparecen en `package.json`. |
| **B28** indicador progreso polling v0 | ⚠️ Parcial | `pollV0Status` en `studio-shell.tsx:826` hace polling cada 5s pero NO surface UI counter ni barra. UX gap: usuario ve "generating_prototype" sin feedback de tiempo transcurrido. **ETA fix: ~2h** (counter elapsed time en `studio-preview-pane.tsx`). |
| **B11** advisory lock quota prototipo | ❌ Pendiente real | `evaluateInitialPrototypeCreate` (`lib/maxwell/prototype-quota.ts:103`) hace 4 checks secuenciales SIN lock. Race condition entre requests concurrentes del mismo usuario. Patrón ya implementado en `repositories.ts:897,962,1393` (`pg_advisory_xact_lock(hashtext(...))`) pero NO aplicado a este path. **ETA fix: ~3-5h** (envolver checks en transacción con advisory lock + tests). |
| **B19** audit log proposal/[token] | ⚠️ Parcial | `app/[locale]/maxwell/proposal/[token]/page.tsx:85` solo loguea rate-limit hits. Falta tabla `proposal_access_audit` para tracking compliance. **ETA fix: ~4h** (migration nueva + integración + tests). |

**Conclusión:** de los 8 dudosos, **5 ya estaban hechos**, **3 son pendientes reales** (B11 + B19 + B28). Los 3 requieren cuidado: B11 y B19 tocan DB con migration nueva, B28 cambia UX visible del Studio. Quedan diferidos hasta próxima sesión cuando haya tiempo y validación.

---

## 5-tris · F-1 mirror fix (2026-05-18 PM)

Tras el smoke E2E cross-repo B1.3b en App (2026-05-18), Piedra3021 detectó la vulnerabilidad **F-1** (Medium-High): verifier HMAC inbound acepta requests sin `x-noon-timestamp`, bypaseando ventana anti-replay ±5min. Piedra parchó App en commit `92f1e0b`.

**Mirror Web hecho 2026-05-18 PM:** branch `chore/fase-1-f1-mirror-fix-2026-05-18`, commit `7fba986`, **pushed pero PR pendiente de crear** (link: https://github.com/nooncode-org/noon-web-main/pull/new/chore/fase-1-f1-mirror-fix-2026-05-18).

Cambios:
- `lib/noon-app-integration.ts`: nueva función `assertRecentTimestamp(): asserts timestamp is string` + colapso del ternario línea 93 a unconditional `${timestamp}.${bodyText}`
- `tests/maxwell/noon-app-webhook.test.ts`: 1 regression test "F-1 regression: returns 401 when x-noon-timestamp header is missing" usando `buildSignedRequest({ omitTimestamp: true })`
- Tests: 497 → 498 verdes. 4 gates verdes.

**Bloqueo desbloqueado:** B1.5 pilot sign-off App (estaba bloqueado en este mirror per finding F-1).

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
2. ~~**Crea el PR en GitHub**~~ ✅ — PR #13 mergeado por nooncode-tech 2026-05-17.
3. ~~**Aplica migración 013 + las 13 legacy**~~ ✅ — aplicada por el dev 2026-05-18.
4. **Configura Sentry + UptimeRobot + Resend DNS** (sección 4.2) — pendiente.
5. **Decide Bloques 11/12/13** (sección 5) — Bloque 11 + B22 ya cerrados; quedan B14 GDPR + B8 #2/#3.
6. Coordina cross-repo (4.3) — rename completo de `NOON_APP_WEBHOOK_SECRET` → `NOON_WEBSITE_WEBHOOK_SECRET` en App.
7. **Rotar credenciales Supabase** (sección 4.1-bis) — deadline 2026-07-22 o primer deploy público.

---

## 8 · Sesión 2026-05-18 PM — 3 PRs adicionales mergeados a main

Esta sesión cerró 3 items concretos post-merge de PR #13, todos pusheados directo a main con autorización explícita del owner:

| PR | Commit merge | Items | Tests | Notas |
|---|---|---|---|---|
| **#14** | `5b2bb0b` | F-1 mirror (HMAC timestamp required) | 497 → 498 | Mirror exacto del App `92f1e0b`. Destraba B1.5 pilot sign-off del App. Verificado productivo 2026-05-18: `curl -X POST ... -H "x-noon-signature: sha256=..." -d '{}'` → 401 `"Missing Noon App timestamp."` ✅ |
| **#15** | `255aa23` | B28 polling progress indicator | 498 → 513 (+15) | Counter live + copy adaptativo en 4 fases (setup/generating/almost/extended). Helper puro `lib/maxwell/polling-progress.ts`. Solo afecta `phase === "generating_prototype"`. |
| **#16** | `b4ab857` | npm audit fix (5 CVEs cerradas) | 513 estables | Lockfile-only. Cierra `brace-expansion` (low), `icu-minify` (DoS), `next-intl` ≤4.9.1 (proto pollution), `vite` 8.0.0-8.0.4 (HIGH path traversal). Residual `postcss` <8.5.10 aceptado (fix exigiría downgrade Next 16.2.6→9.3.3). |

**Verificación productiva confirmada 2026-05-18 PM:**
- `/api/health` → 200 OK
- `/api/health/detail` sin auth → 401
- `/api/integrations/noon-app/proposal-review-decision` con timestamp omitido → 401 `"Missing Noon App timestamp."`
- Security headers activos: HSTS, X-Frame-Options, X-Content-Type-Options

### Audit B-series adicional (2026-05-18 PM)

De 8 items B-series "verificar":

- ✅ Done: **B27** (interceptor 401 → signin), **B33** (metadataBase + openGraph), **B35** (unoptimized images removed), **B36** (viewport + themeColor), **B41** (three/react-three/geist uninstalled), **B28** (polling indicator — cerrado este PR #15).
- ❌ Reales pendientes (próxima sesión):
  - **B11** advisory lock quota (`prototype-quota.ts:103 evaluateInitialPrototypeCreate`): race condition real. Patrón `pg_advisory_xact_lock(hashtext(...))` ya usado en `repositories.ts:897,962,1393` pero NO en este path. ETA real **5-8h** (no chico — requiere thinking sobre lock key strategy + posiblemente marker temporario para cubrir la generación v0 completa, no solo el check).
  - **B19** audit log proposal/[token] (`page.tsx:85` solo loguea rate-limit). Falta tabla `proposal_access_audit` + integración. ETA **3-4h** (chico-medio si scope minimal).

---

_Generado 2026-05-16. Actualizado 2026-05-17 (push + reprioritización rotación Supabase). Actualizado 2026-05-18 PM (PR #14/15/16 + verificación productiva)._
