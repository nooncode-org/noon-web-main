# Spec — Ola E-2: hardening Web (auditoría master 2026-07, medios residuales)

> Fuente: backlog Ola E de la auditoría master (carpeta untracked en App-nooncode,
> repo público). 7 ítems: SEC-M2, SEC-M5, SEC-M8, SEC-M10, F5-05, SEC-M7, F1-01.
> Una iteración, una rama (`fix/e2-web-hardening`), un PR. El usuario mergea.

## Estado verificado en código (2026-07-08, sobre cc71b4f)

| Ítem | Hallazgo verificado | Evidencia |
|---|---|---|
| SEC-M2 | `expires_at` EXISTE (se setea al primer open, +15 días, `markProposalFirstOpened`) y la UI lo promete ("Valid through") — pero NADA lo enforcea: página/checkout/payment solo miran `status === 'expired'`, que es flip manual (review o webhook App). Token = UUID bearer permanente | `repositories.ts:1441-1445`, `checkout/route.ts:47`, `payment/route.ts:151`, `proposal/[token]/page.tsx:110` |
| SEC-M5 | Rate-limiter token-bucket **in-memory** (`lib/server/rate-limit.ts:61` Map) — bucket fresco por instancia serverless; scanner cross-instance lo bypasea. Sin Upstash/Redis en el repo | `rate-limit.ts:10-11` lo declara como swap futuro |
| SEC-M8 | Solo las correcciones (`correctionNote` presente) consumen `correctionsUsed`; un POST sin body desde `version_ready` regenera gratis en loop → drena el budget LLM global (`LLM_BUDGET_USD_PER_MONTH`, compartido) | `upgrade/[id]/generate/route.ts:64-72` |
| SEC-M10 | `postgres()` sin `prepare: false`; puerto del pooler indocumentado en `.env.example` | `db.ts:31-36` |
| F5-05 | Sin reaper: `studio_session` colgada en `generating_prototype`/`revision_*` si el cliente deja de pollear (único revert = poll budget del browser); `website_upgrade_session` colgada en `crawling/analyzing/generating` si muere el lambda; outbox `client_comment`/`client_request`/`client_request_update` con `forwarded_at IS NULL` para siempre si la App estaba caída (índices parciales `*_unforwarded` existen, **sweeper no**); `archiveStaleUpgradeSessions` es código muerto sin caller | poll/route.ts:32-46, audit/analyze/generate routes, migr. 023:43-45 |
| SEC-M7 | `workspace_status` solo se escribe localmente (activación → `'active'`, staff manual); el badge cliente pullea el estado real de la App en render y ante fallo cae al local congelado → "Active" perpetuo bajo outage | `workspace/[sessionId]/page.tsx:388-392`, `project-status-fetch.ts:236-294` |
| F1-01 | Sin mecanismo formal de done-notification cross-repo; paliativo = CHANGELOG Web reactivado 2026-07-08 | fase-1/fase-8 auditoría |

Infra disponible: cron único `review-sla` (`vercel.json`, diario 09:00 UTC) con auth
`CRON_SECRET` — patrón a extender. Stripe re-entrega webhooks = retry durable del
forward de payment (excluido del reaper por eso). La App dedupe re-forwards:
UNIQUE(`external_comment_id`), `externalRequestId`, (`externalRequestId`,`updateId`).

## Decisiones de diseño

1. **SEC-M2 — cutoff enforced, SIN firma HMAC.** El backlog decía "HMAC + cutoff".
   El riesgo real declarado es "leakage = acceso permanente a contenido + checkout
   vivo": eso lo cierra el **cutoff duro** (enforcear el `expires_at` que ya existe
   y que la UI ya promete). Una firma HMAC en la URL NO cierra leakage (la firma
   viaja en la misma URL filtrada), rompería los links ya enviados a clientes
   reales por email, y contra brute-force el UUID de 122 bits + rate-limit
   distribuido (SEC-M5) ya es suficiente (la propia auditoría lo califica de
   impráctico). Decisión: helper puro `isProposalPastCutoff` en
   `proposal-visibility.ts` (SoT existente de visibilidad), aplicado en:
   - página pública: past-cutoff (statuses pre-pago) → misma vista `expired`
     SIN draft content ni CTA de pago (hoy la vista expired muestra el contenido:
     se retira también — "acceso permanente a contenido" cerrado).
   - `POST /api/maxwell/checkout`: 410 `PROPOSAL_EXPIRED`.
   - `POST /api/maxwell/payment` (evidence): 410 `PROPOSAL_EXPIRED`.
   Cutoff aplica SOLO a statuses pre-pago (`sent`, `payment_pending`).
   `paid`/`payment_under_verification` no expiran (recibo del cliente / pago ya
   emitido). Proposal nunca abierta: `expires_at` NULL → el primer open arranca
   el reloj (ya implementado) → sin ventana infinita. Renovación = staff extiende
   `expires_at` (`updateProposalExpiry` existe).
2. **SEC-M5 — rate-limit distribuido respaldado en Postgres, no Upstash.** Regla
   del repo: no infra nueva sin necesidad concreta. Postgres ya está en cada
   request de estas páginas. Contador fixed-window en tabla nueva
   (migración `20260708_032`): `INSERT ... ON CONFLICT ... SET hits = hits+1
   RETURNING hits` (atómico cross-instance). Capa 1 = bucket in-memory existente
   (absorbe bursts por instancia gratis); capa 2 = contador DB. Identity = hash
   IP truncado (mismo diseño privacy que `proposal_access_audit`). Fail-open ante
   error DB (misma filosofía; sin DB la página igual no sirve nada). Aplica a las
   dos superficies anónimas de token: `/maxwell/proposal/[token]` y
   `/maxwell/prototipo/[token]`. Limpieza de ventanas viejas = el reaper (F5-05).
3. **SEC-M8 — toda generación con versión previa consume el cap.** `isCorrection
   || hayVersiónPrevia` → chequea y consume `correctionsUsed` (cap 2 existente).
   Total LLM ≤ 3 generaciones/sesión. Retry desde `error` sin versión previa
   sigue gratis (recuperación legítima de un fallo).
4. **SEC-M10 —** `prepare: false` en `db.ts` + documentar en `.env.example`:
   6543 = transaction pooling (requiere prepare:false), 5432 = session. La opción
   es segura en ambos modos.
5. **F5-05 — reaper único** `app/api/maxwell/reaper/route.ts` (cron Vercel horario,
   auth `CRON_SECRET`, mismo patrón review-sla). Acciones idempotentes, batch
   acotado, cada una con umbral >> peor caso legítimo (~3 min poll / 60s
   maxDuration):
   - `studio_session` >30 min en `generating_prototype` → `clarifying`; en
     `revision_requested|revision_applied` → `prototype_ready` (mismo mapping que
     `revertInFlightSession`).
   - `website_upgrade_session` >30 min en `crawling|analyzing|generating` →
     `error` + `insertUpgradeEvent` (el cliente puede reintentar: rutas ya
     aceptan re-POST desde `error`).
   - Outbox re-forward (batch ≤20 c/u, filas >10 min sin forward): `client_comment`,
     `client_request`, `client_request_update` → re-llamar el sender existente y
     marcar forwarded (dedupe App-side verificado). Attachments: solo si el
     payload es reconstruible desde la fila (verificar en implementación; si no,
     documentar residual).
   - Wire de `archiveStaleUpgradeSessions()` (hoy código muerto) + DELETE de
     ventanas viejas del rate-limit (SEC-M5).
6. **SEC-M7 — badge honesto, columna se queda.** `workspace_status` sigue siendo
   el ciclo de vida local (activación/entrega); lo que se elimina es la MENTIRA:
   si el workspace está vinculado a proyecto App (`noon_app_project_id`) y el
   pull falla, el badge muestra "Status unavailable" neutro (con el copy "we'll
   refresh shortly") en vez del local congelado. Pull OK → estado App (como hoy).
   Sin vínculo App → local (pre-handoff, es la única verdad). Helper puro
   testeable extraído de page.tsx.
7. **F1-01 — protocolo done-notification documental** (sin código): regla en el
   contexto core de ambos repos + disciplina CHANGELOG: (a) todo merge que toque
   un contrato cross-repo o shippee capacidad que el otro repo espera AÑADE
   entrada datada al CHANGELOG del repo que shippea; (b) si requiere acción del
   otro repo, nota datada `docs/YYYY-MM-DD-<repo>-to-<repo>-*.md` (convención ya
   existente); (c) al abrir sesión formal en un repo con trabajo cross-repo,
   revisar el CHANGELOG del hermano desde el último sync. Lado App: línea en su
   context core (commit local, bundle con próximo PR de App).

## Perímetro

Incluido: los 7 ítems según decisiones de arriba. 1 migración nueva
(`20260708_032_rate_limit_counter.sql`, self-register como las demás).
Excluido: HMAC del token (decisión #1, registrado); Upstash; reaper para
payment-forward (Stripe re-entrega) y `sendLifecycleEmailsForPayment` (emails
best-effort sin estado colgado); tocar el pull `project-status-fetch` (ya nunca
throwea, correcto); staff review views (contexto staff, sin engaño).

## Metodología de testing

- Vitest (repo usa npm: `npm.cmd test`). Unit: cutoff helper (statuses×fechas),
  contador DB mockeado (ventana/atomicidad la valida el SQL; el guard y fail-open
  se testean con mock), cap de regeneración (ruta con deps mockeadas — patrón de
  tests existente del repo), badge helper puro, reaper (senders/repos mockeados:
  umbrales, mapping de reverts, batch, marca forwarded).
- Migración: aplicada por el usuario en prod ANTES del merge (flujo Web: manual +
  drift gate `check-migrations` en prebuild).
- Manual en Preview antes del merge: proposal viva renderiza; checkout de una
  expirada → 410; página prototipo sigue sirviendo.

## Criterio de éxito

1. Proposal past-cutoff: sin contenido ni checkout (page + 410 en checkout/payment).
2. Rate-limit de token surfaces enforced cross-instance (contador en DB).
3. Regeneración de upgrade capada (≤3 generaciones LLM por sesión).
4. `prepare:false` activo + puerto documentado.
5. Reaper corriendo por cron: sin sesiones colgadas >umbral ni dead-letters
   permanentes en outbox.
6. Badge de workspace nunca muestra estado local congelado como si fuera live.
7. Protocolo done-notification escrito en ambos contextos core.
8. Suite verde + gate seguridad + validator + contexto core Web actualizado.

## Gate de seguridad (2026-07-08, sobre el diff de la rama)

Veredicto: **0 CRITICAL / 0 HIGH** — no bloquea COMPLETE. Disposición:

- **MED-1 (CORREGIDO en la rama):** la resolución de IP confiaba primero en
  `x-forwarded-for` (primer hop spoofeable en Vercel) → rotar el header
  estrenaba identidad en cada request (bypass del anti-scanner + writes sin
  bound en `rate_limit_counter`). Fix: orden plataforma-primero
  (`x-real-ip` → `x-vercel-forwarded-for` → XFF último recurso) en
  `lib/server/rate-limit.ts` y los dos `resolveRscClientIdentity` de las
  páginas públicas; tests actualizados. El cap adicional de identidades
  distintas por ventana se DESCARTA: con identidad platform-trusted, rotar
  identidades exige IPs reales (botnet), el insert es barato frente a las
  queries que la página ya hace, y el reaper barre cada hora.
- **LOW-1 (CORREGIDO):** la vista expirada ya no re-expone `deliveryRecipient`.
- **LOW-2 (residual ACEPTADO):** el cap SEC-M8 es TOCTOU-racy bajo POSTs
  concurrentes del owner autenticado (precisión por sesión, no el riesgo core);
  el drain real del budget global sigue cerrado por `assertBudgetAvailable`
  (advisory lock + hard-stop $200/mes). Upgrade path si se quiere precisión:
  check-and-consume atómico (`UPDATE ... WHERE corrections_used < 2 RETURNING`).
- **INFO-1:** la corrección del re-forward del reaper depende del dedupe
  App-side por external id (contrato documentado, verificado presente).
- **INFO-2:** comparación de Bearer no constant-time — mismo patrón que
  review-sla, impráctico sobre HTTPS con secreto de alta entropía; sin cambio.

## Lifecycle

Estado: ACTIVA (2026-07-08). Cierra la parte Web de la Ola E (backlog auditoría
master 2026-07). No supersede specs previas.
