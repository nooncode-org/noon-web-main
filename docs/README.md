# 📚 `docs/` index — noon-web-main

> Index master para que cualquier sesión (en frío o continuando) encuentre
> rápido lo que necesita. Cada entrada dice **cuándo usarlo**, no solo qué es.

---

## 🚨 Si arrancás una sesión en frío, leé esto primero

| Orden | Doc | Propósito |
|---|---|---|
| 1 | [`../project.context.full.md`](../project.context.full.md) | Arquitectura completa + stack + estado del repo. **Source of truth** del "dónde estamos" |
| 2 | [`handoff-fase2.md`](handoff-fase2.md) | Log operacional de la última sesión + comandos `git status` + `npm test` + `npm run build` para verificar al volver |
| 3 | [`../CHANGELOG.md`](../CHANGELOG.md) | Cambios chronicled por sesión (Keep a Changelog format) |

---

## ⚙️ Runbooks operacionales

Procedimientos paso-a-paso para acciones de ops. Cada uno tiene
exit codes, fallback paths, y verification commands.

| Runbook | Cuándo correr | Quién | ETA |
|---|---|---|---|
| [`gdpr-runbook.md`](gdpr-runbook.md) | Cliente pide GDPR Art.17 ("right to be forgotten") | Ops (2-person approval) | 15-30min |
| [`smoke-gpt-5.5-runbook.md`](smoke-gpt-5.5-runbook.md) | Post-deploy del bump gpt-5.5, antes de rollback, o quarterly canary | Ops | 1min + cost ~$0.0002 |
| [`supabase-key-rotation-runbook.md`](supabase-key-rotation-runbook.md) | **Deadline 2026-07-22** rotación obligatoria. También cuando se sospeche key leakeada | Ops + pair-ops con dev | 30-40min |
| [`bundle-and-cve-audit-2026-05-19.md`](bundle-and-cve-audit-2026-05-19.md) | Auditoría periódica de bundle size + npm CVEs. Re-correr cuando Next se actualice | Dev | 30min |

**Cómo correr un runbook nuevo (template):**
```
1. Leer "Why this runbook exists" + scope
2. Hacer pre-flight checks (cada runbook tiene los suyos)
3. Ejecutar pasos en orden — NUNCA saltarse pre-checks
4. Verificar gates post-ejecución
5. Si algo se desvía → ir a la sección "Rollback" del runbook, NO improvisar
```

---

## 🌉 Cross-repo coordination

Cuando se necesita coordinar cambios entre `noon-web-main` y `App-nooncode`.

| Doc | Para qué |
|---|---|
| [`cross-repo-v3-contracts-app-mirror.md`](cross-repo-v3-contracts-app-mirror.md) | Spec exacta para crear los módulos `lib/constants/project-types.ts` + `lib/security/project-isolation.ts` en App. Incluye contenido literal (2 alternativas) + decisión owner sobre canonical drift |
| [`handoff-piedra-2026-05-19.md`](handoff-piedra-2026-05-19.md) | Snapshot de cierre de sesión 2026-05-19 con acción-items para Piedra (App-side dev) |

**Cross-repo contract canónico (no es un doc en este repo):** `cross-repo-webhook-v1.md` — vive en `App-nooncode`. Define el HMAC-SHA256 + anti-replay que ambos lados implementan.

---

## 📖 Referencias técnicas (specs + state machines)

Documentación arquitectónica vigente. Léete acá si necesitás entender CÓMO algo funciona (vs el changelog que dice QUÉ cambió).

| Doc | Cubre |
|---|---|
| [`maxwell/maxwell-studio-v1-spec.md`](maxwell/maxwell-studio-v1-spec.md) | Spec original del Maxwell Studio v1 (flujo de producto, modos, estados) |
| [`maxwell/maxwell-studio-state-machine.md`](maxwell/maxwell-studio-state-machine.md) | Máquina de estados de `studio_session` (transiciones válidas) |
| [`maxwell/maxwell-commercial-constraints.md`](maxwell/maxwell-commercial-constraints.md) | Reglas comerciales (modalidades de pago, vigencia propuestas, contraindicaciones) |
| [`maxwell/quality-layer.md`](maxwell/quality-layer.md) | Spec del Bloque 11 (style packs, brief extractor, prototype-brief assembly) |
| [`maxwell/error-codes.md`](maxwell/error-codes.md) | Códigos de error que las routes de Maxwell devuelven al cliente |
| [`contact-and-maxwell-runtime.md`](contact-and-maxwell-runtime.md) | Runtime detail del contact form + Maxwell intake |
| [`migrations.md`](migrations.md) | Convenciones de migrations Postgres (naming, self-register pattern) |

---

## 📅 Histórico (referencia, no source of truth)

Documentos que reflejan el estado pasado del proyecto. Útiles para
entender DECISIONES, no para ejecutar.

| Doc | Estado |
|---|---|
| [`roadmaps/`](roadmaps/) | Roadmaps de fases anteriores (FASE 1, FASE 2 inicial, Stripe checkout launch). Snapshots, no plan activo. |

---

## 🗺️ Navegación por escenario

**"Necesito hacer X" → vé a:**

| Escenario | Doc |
|---|---|
| Mergear un PR | [`../.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md) — pattern Why/What/Tests/Gates/Risks |
| Aplicar una migration | [`migrations.md`](migrations.md) |
| Borrar datos de un cliente (GDPR) | [`gdpr-runbook.md`](gdpr-runbook.md) |
| Verificar gpt-5.5 en prod / decidir rollback | [`smoke-gpt-5.5-runbook.md`](smoke-gpt-5.5-runbook.md) |
| Rotar Supabase keys (2026-07-22) | [`supabase-key-rotation-runbook.md`](supabase-key-rotation-runbook.md) |
| Investigar bundle size o CVEs | [`bundle-and-cve-audit-2026-05-19.md`](bundle-and-cve-audit-2026-05-19.md) |
| Mandarle handoff a Piedra (App dev) | [`handoff-piedra-2026-05-19.md`](handoff-piedra-2026-05-19.md) — refactor para sesión nueva |
| Entender qué hace `studio_session.status="generating_prototype"` | [`maxwell/maxwell-studio-state-machine.md`](maxwell/maxwell-studio-state-machine.md) |
| Entender qué es "membresía" vs "pago único" | [`maxwell/maxwell-commercial-constraints.md`](maxwell/maxwell-commercial-constraints.md) |
| Entender los 24 style packs + por qué existen | [`maxwell/quality-layer.md`](maxwell/quality-layer.md) |
| Ver qué error code corresponde a qué situación | [`maxwell/error-codes.md`](maxwell/error-codes.md) |
| Continuar sesión Maxwell desde frío | [`../project.context.full.md`](../project.context.full.md) + [`handoff-fase2.md`](handoff-fase2.md) |

---

## 🛠️ Mantener este index actualizado

Si añadís un doc nuevo a `docs/`, agregalo a la sección que corresponda
arriba. **Regla simple:** si tu doc es accionable → runbooks; si es
spec/referencia → referencias técnicas; si es snapshot temporal →
histórico.

Si removés un doc, sacar la entrada también acá (cleanup).

---

**Última actualización del index:** 2026-05-19. Próxima revisión recomendada: cuando se agreguen 2+ docs nuevos o cuando se haga reorg de `docs/`.
