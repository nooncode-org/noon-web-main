# 📬 Handoff para Piedra — 2026-05-19

> **Tu rol:** App-nooncode dev. Este mensaje es **lo que necesito de vos en App** + contexto cross-repo. El lado web está cerrado por mí; vos no tenés que hacer nada ahí.

---

## 🎯 Lo que necesito de vos en App-nooncode

### #1 — Mirror v3 contracts (~1.5-2h)

Crear 2 módulos nuevos en `App-nooncode` espejando lo que ya está en Web. **Spec completa con contenido exacto:** `noon-web-main/docs/cross-repo-v3-contracts-app-mirror.md`.

**Archivos a crear (en `develop` branch):**
- `lib/constants/project-types.ts` — vocabulario canonical de project types
- `lib/security/project-isolation.ts` — denylist de campos operacionales + helper `sanitizeForClient` + dev guard `assertNoInternalFields`

**Por qué importa:** Web ya tiene estos módulos (commit `a3ca787`) y los usa como guards en 3 routes client-facing. Sin el mirror en App, los payloads cross-repo pueden traer fields internos sin que ningún lado se entere.

**Pattern para tests:** `node:test` + `node:assert/strict` con `tsx --test` (mismo runner que usás en `tests/lib/dashboard-selectors.test.ts`).

---

### ⚠️ Decisión importante antes de mergear el mirror

**App y Web usan canonical de project-type DIFERENTE:**

| Web canonical | App canonical |
|---|---|
| `web_landing` | `landing` |
| `ecommerce` | `ecommerce` |
| `webapp_system` | `webapp` |
| `mobile` | `mobile` |
| `saas_ai_automation` | `saas_ai` |

La spec asume **mantener ambos vocabularios + mapas bidireccionales** (no forzar unificación, para no romper código existente en ningún lado).

**Pero alguien tiene que decidir si:**
- (a) Mantener separados y traducir en el borde cross-repo (lo que propongo)
- (b) Unificar a uno de los dos sets (decisión owner-level, requiere migración de datos en uno de los repos)

Mi voto es (a) por bajo riesgo. **Hablalo con Juan antes de implementar la spec.**

---

### #2 — Cuando renombremos el webhook secret legacy

`NOON_APP_WEBHOOK_SECRET` → `NOON_WEBSITE_WEBHOOK_SECRET` (el nombre canónico per cross-repo-webhook-v1).

Web ya acepta ambos nombres (backward compat). Cuando coordines con Juan rotar:

1. Vos seteás `NOON_WEBSITE_WEBHOOK_SECRET` en App con el mismo valor que ya tiene `NOON_APP_WEBHOOK_SECRET`
2. Web flipea Vercel env para que solo lea el nuevo nombre
3. Vos eliminás la env legacy de App

Sin urgencia operativa — pendiente cuando tengamos ventana.

---

## 🌐 Contexto: qué pasó en Web hoy

Sesión de 17 PRs en `noon-web-main`. Te resumo solo lo que **te afecta cross-repo o vale la pena saber**:

### Lo que potencialmente afecta tus consumers

| Cambio | Impacto en App | Acción tuya |
|---|---|---|
| **gpt-5.5** como model default en `lib/api-ia.ts` (commit `206f63f`) | App también usa OpenAI — querrás considerar el mismo bump en tu lado. Rollback hot-swap via `OPENAI_DEFAULT_MODEL` env var | Opcional — decisión de timing |
| **G-D2 LLM budget tracker** (commit `a196a12`) en Web | Solo trackea Web. App tiene su propio consumo invisible para nosotros. Recomendado: setear "Hard limit" en OpenAI dashboard per-API-key | Si ambos repos comparten API key, ojo con quien consume — el budget Web es de $200/mes default |
| **B14 GDPR hard-delete CLI** en Web (commit `1b28907`) | Cuando un cliente pida Art.17, hay que borrar datos en **ambos** repos. La CLI de Web NO toca data de App | Coordinar el flujo cuando llegue el primer request |
| **v3 contracts isolation** (commit `a3ca787`) | Es lo del item #1 arriba — necesitamos tu mirror | Pendiente acción tuya |

### Lo que NO te afecta (info por completitud)

- B8 emails lifecycle (Payment received + Workspace ready) — surface 100% web-cliente
- v3 wiring guards en 3 routes web — server-side only, no expone API nueva
- Tests +304 en sesión, ahora 817/817 — coverage interna web
- Ops toolkit (smoke scripts + runbooks operacionales) — para ops del lado web

<details>
<summary><b>Lista completa de los 17 PRs (collapsable, por si querés el detalle)</b></summary>

**Funcionalidad nueva:**

| Commit | Scope |
|---|---|
| `1b28907` | B14 GDPR Art.17 hard-delete CLI + audit ledger `gdpr_deletion_log` + 2-person approval runbook |
| `206f63f` | gpt-5.5 model bump + rollback via `OPENAI_DEFAULT_MODEL` |
| `606cbfb` | B8 #2/#3 lifecycle email templates (gated por `MAXWELL_LIFECYCLE_EMAILS=1`) |
| `a3ca787` | v3 contracts prep (`lib/constants/project-types.ts` + `lib/security/project-isolation.ts`) |
| `a532889` | B8 wiring en `confirmProposalPayment` fire-and-forget |
| `5f69a7f` | v3 wiring guards `assertNoInternalFields` en 3 routes client-facing |
| `0b4743b` | Ops toolkit (smoke gpt-5.5 + 3 runbooks operacionales) |
| `a196a12` | G-D2 LLM budget multi-provider tracker (OpenAI + Anthropic + v0) |
| `c9ddf45` | 🚨 Hotfix G-D2 fail-open (crítico, evita romper Maxwell sin migration aplicada) |
| `7e9447e` | Admin endpoint `GET /api/maxwell/admin/llm-budget` |

**Tests + docs + cleanup:**

| Commit | Scope |
|---|---|
| `2188948` | `project.context.full.md` refresh |
| `0ff140a` | Bundle + CVE audit report (postcss CVE no exploitable, build healthy) |
| `b67a875` | +62 tests: 5 routes Maxwell sin coverage |
| `7e9447e` | +13 tests: contact + health/db routes |
| `43ac889` | +14 tests: upgrade entry routes |
| `a487a09` | +59 tests: 6 upgrade sub-action routes |
| `7f82fe4` | Cleanup: 33 líneas dead code + doc obsoleto borrado |

**Estado:** 513 → 817 tests (+304). `main` HEAD: `7f82fe4`. Working tree clean.

</details>

---

## 🔧 Acciones operacionales web pendientes (no afectan App, pero info)

Si Juan no las hizo cuando vos veas esto, son las 2 cosas que falta hacer en Web:

1. **Aplicar `supabase/migrations/20260520_017_llm_budget_usage.sql` a prod** — sin esto, el ledger del LLM budget está vacío (Maxwell sigue funcionando gracias al hotfix fail-open)
2. **Setear `MAXWELL_LIFECYCLE_EMAILS=1` en Vercel** — activa los 2 emails B8 wireados

Si las necesitás ejecutar vos, los detalles están en `noon-web-main/docs/handoff-fase2.md`.

---

## 📚 Refs para si querés profundizar

| Doc | Para qué |
|---|---|
| `noon-web-main/docs/cross-repo-v3-contracts-app-mirror.md` | **Spec exacta de lo que tenés que crear en App (item #1)** |
| `noon-web-main/docs/cross-repo-webhook-v1.md` | Contract HMAC cross-repo (vigente, no cambió) |
| `noon-web-main/docs/handoff-fase2.md` | Log operacional completo de la sesión Web |
| `noon-web-main/project.context.full.md` | Arquitectura web actualizada |

---

## TL;DR

**1 cosa que tenés que hacer:** mirror v3 contracts en App (~2h), pero **hablalo primero con Juan** por el tema del canonical drift.

**0 cosas urgentes.** No hay nada bloqueado esperando tu input. La spec está lista; vos definís cuándo arrancás.

Cualquier duda dale por privado.
