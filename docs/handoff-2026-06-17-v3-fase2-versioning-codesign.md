# Handoff — NoonWeb → App: co-diseño de v3 Fase 2 (Versionado: Publish + Rollback)

**Fecha:** 2026-06-17
**Para:** quien trabaje **App-nooncode** (dev o sesión de agente).
**De:** NoonWeb (`noon-web-main`), tras verificar el lado App contra su código real.
**Objetivo:** congelar el contrato cross-repo de **Fase 2 (Publish + Rollback)** para
que ambos repos entren a Architecture en paralelo — mismo patrón que el co-diseño de
§9 (client-requests).

> Auto-contenido: no requiere leer el repo NoonWeb. Lo que NoonWeb ya verificó del
> lado App está citado abajo.

---

## 0. TL;DR — dos asks

1. **Co-firmar el transporte + la forma del feed de versiones.** NoonWeb propone
   **extender el `versions[]` del project-status read existente** con el estado de
   publicación (NO un push nuevo). Detalle §2.
2. **Responder 6 preguntas abiertas (Q-A..Q-F)** que bloquean Architecture de ambos
   lados — sobre todo **Q-A (autoría: ¿el cliente publica/rollback, o lo decide
   dev/PM?)**, que define si NoonWeb construye UI de acción o solo display. §4.

**Alcance (owner-locked, Mel 2026-05-25):** Phase 2 MVP = **Publish + Rollback**.
*Private Preview* y *Update Published Version* quedan **diferidos hasta demanda** — no
entran a este contrato.

---

## 1. Estado actual (verificado por NoonWeb en el repo del App)

- `project_versions` **existe** (migración `0069_project_versions.sql`). El productor
  del status (`lib/server/projects/client-status-read.ts:169-183`) lo lee filtrado a
  `state = 'ready_for_client_preview'`, select `version_sequence_number, mvp_demo_url,
  created_at`, y emite `versions[]` ordenado por sequence.
- **NO existe** capa de publicación: `version_publications` = 0 resultados; ningún
  `published_url` ni estado de publish en el feed; ningún endpoint de acción de
  versión en `app/api/integrations/website/` (hoy: project-status, client-request,
  client-comment, payment-confirmed, prototype-*).

→ Fase 2 es greenfield del lado App: la data de versiones existe, falta la capa de
publicación + el receptor de acción. NoonWeb ya consume el `versions[]` thin pero aún
no lo muestra (lo prepara Fase 2).

---

## 2. Ask #1 — Transporte + forma del feed (NoonWeb propone, App co-firma)

**Propuesta (D-1):** en vez del push `version-available` que bosquejaba el master
spec §20, **extender el `versions[]` del project-status read** (el mismo signed-read
que ya sirve a Slice 1a), agregando el estado de publicación. Razón: es estado-actual
(pull encaja), hay un solo read productor, y el consumidor de NoonWeb ya es
forward-compat para estos campos.

Forma propuesta del 200 (camelCase, como el resto del read; todo por `sanitizeForClient`):
```jsonc
"data": {
  "project": { "id", "name", "status" },
  "proposal": { ... } | null,
  "payment": { ... },
  "versions": [
    { "sequence": 1, "state": "ready_for_client_preview",
      "previewUrl": "<url|null>", "at": "<ISO>",
      "published": false }          // NUEVO por versión
  ],
  "publishedSequence": 2 | null,    // NUEVO — cuál sequence está publicada
  "publishedUrl": "<url|null>",     // NUEVO — URL pública client-facing
  "latestUpdate": { ... } | null,
  "serverTime": "<ISO>"
}
```
- `published_url` es client-safe por definición. Ningún campo §8.3 (`validation_outcome`,
  `originating_pipeline_run_id`, `mvp_content`, `origin`, comp/earnings/margin) debe
  cruzar — NoonWeb corre `assertNoInternalFields` + allowlist al recibir.
- **`versionRef = versionSequenceNumber`** (ya congelado en §9 B.4): la identidad de
  versión cross-repo es la sequence, nunca un UUID interno.

---

## 3. Ask #2 — Lo que agrega el App (sujeto a las respuestas de §4)

1. **Capa de publicación** — `version_publications` (historial: quién publicó, cuándo,
   qué sequence) **o** un puntero simple `published_version_sequence_number` +
   `published_url` en `projects`. El §20 pide "history timeline (who published, when)"
   → sugiere tabla. Decide el App (Q-D).
2. **Extender el feed** project-status `versions[]` + `publishedSequence`/`publishedUrl`
   (§2), por `sanitizeForClient`.
3. **Receptor `version-action`** — `POST /api/integrations/website/version-action`
   (HMAC, mismo patrón que su `client-request` receptor; idempotente por
   `externalActionId`):
   ```
   { "action": "publish" | "rollback", "projectId",
     "versionSequenceNumber", "externalActionId", "at" }
   → 200 { "idempotent": false, "publishedSequence", "publishedUrl", "requestId" }
   ```
   Ejecuta la publicación/rollback (mueve el puntero publicado) y responde el estado
   resultante; el cambio se refleja también en el siguiente pull del status (§2).

---

## 4. Preguntas abiertas (co-firma — bloquean Architecture)

- **Q-A · Autoría (la más importante):** ¿el **cliente** dispara Publish/Rollback
  desde el portal (master spec §20: "client can publish/rollback without leaving the
  portal") o lo decide **dev/PM** y NoonWeb solo refleja el estado (build-spec §4.4:
  rollback "autorizado por dev o PM/Admin")? Define si NoonWeb construye UI de acción
  (outbound `version-action`) o solo display + reflejo de estado.
- **Q-B · Transporte:** ¿confirman extender el `versions[]` del pull con
  `published`/`publishedSequence`/`publishedUrl` (§2) en vez del push `version-available`?
- **Q-C · Project types:** ¿Publish aplica solo a **web/web-app** en el MVP? ¿Qué pasa
  con los otros 6 types (Phase 5)?
- **Q-D · Modelo de publicación:** ¿`version_publications` (tabla con historial) o un
  puntero en `projects`?
- **Q-E · Rollback:** ¿rollback = mover el puntero publicado a una sequence anterior
  (atómico, idempotente)? ¿Hay versiones que no se puedan republicar?
- **Q-F · `version-action` shape + idempotencia:** ¿OK
  `{ action, projectId, versionSequenceNumber, externalActionId, at }`, idempotente por
  `externalActionId` (= id de la fila outbox de NoonWeb, reusado en cada retry)?

---

## 5. Qué construye NoonWeb (para que sepan que el consumidor es real)

Diseño completo en `noon-web-main/docs/2026-06-17-v3-fase2-versioning-publish-design.md`.
- **Slice 2a — Display de versiones** (historial + preview por versión + marca
  "Published") en el workspace autenticado, sobre el `versions[]` del pull. NoonWeb-only,
  ya construible (thin hasta que haya publish/multi-versión).
- **Slice 2b — Publish** y **Slice 2c — Rollback** (si Q-A = cliente): UI gateada +
  server action que persiste outbox local y reenvía firmado al receptor §3 (molde de
  `submit-request.ts` de §9), idempotente con dead-letter; consume `publishedUrl` del
  pull para mostrar el estado publicado.

NoonWeb se compromete a construir contra el contrato congelado con stubs firmados en
tests hasta que el App despliegue (como §9).

---

## 6. Secuencia
0. App responde §4 (Q-A..Q-F) → contrato congelado. *(Bloquea Architecture de ambos.)*
1. App: capa de publicación + feed extendido (§2) + receptor `version-action` (§3).
2. NoonWeb: Slice 2a (display) en paralelo — no depende del App. Luego 2b/2c contra el
   contrato. Pasos 1 y 2 se solapan.

---

## 7. Referencias
- Diseño NoonWeb: `noon-web-main/docs/2026-06-17-v3-fase2-versioning-publish-design.md`.
- Spec: master spec v3 §20 (versioning) — owner lock Phase 2 = Publish + Rollback.
- Patrón signed-read existente (App): `app/api/integrations/website/project-status/[projectId]/route.ts` + `lib/server/projects/client-status-read.ts`.
- Patrón receptor existente (App): `app/api/integrations/website/client-request/route.ts`.
- Identidad de versión cross-repo: `versionSequenceNumber` (congelado en el co-diseño §9, B.4).
