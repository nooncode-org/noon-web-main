# Diseño — v3 Fase 2: Versionado / Publish + Rollback (lado NoonWeb)

**Fecha:** 2026-06-17
**Repo:** `noon-web-main` (NoonWeb).
**Origen:** master spec §20 (`archivos-pedro/noon-web/roadmap/v3-master-spec-2026-05-25.md`),
build-spec `docs/2026-06-14-noonweb-client-portal-v3-handoff.md` §4.4/§7, decisión
de owner 2026-05-25 (Phase 2 = **Publish + Rollback** MVP).
**Estado:** **CONTRATO CONGELADO (2026-06-18).** El handoff de co-diseño
(`docs/handoff-2026-06-17-v3-fase2-versioning-codesign.md`) se envió al App; el App
respondió con `docs/2026-06-18-app-to-noonweb-v3-fase2-versioning-cosign-response.md`,
co-firmando el transporte (Ask #1) y resolviendo Q-A..Q-F. Ver §9 abajo. Ambos repos
entran a Architecture/implementación en paralelo; NoonWeb arranca por **Slice 2a (display)**.

> Sigue el ritmo de §9: (a) verificación del estado real en ambos repos, (b)
> decisiones de diseño tomadas (marcadas), (c) wires propuestos, (d) preguntas
> abiertas que bloquean Architecture y se co-firman con el App, (e) slices.

---

## 0. Alcance (owner-locked)

**Phase 2 MVP = Publish + Rollback.** (`project_v3_owner_decisions`, 2026-05-25, Q2.)
- **Publish** — promover una versión a la URL pública client-facing.
- **Rollback** — volver a una versión publicada anterior.
- **DIFERIDOS hasta demanda concreta:** *Private Preview* (render de versión no
  publicada en URL firmada) y *Update Published Version*. NO se construyen ahora.
- Soporte de versiones para proyectos **web / web-app** (build-spec §4.4). Qué
  significa "publicar" para los otros 6 project types = **pregunta abierta** (§7).

---

## 1. Aclaración de nombres (evitar el solapamiento de "version")

| Término | Qué es | Dónde |
|---|---|---|
| **prototipo v0 / `studio_version`** | iteraciones del prototipo PRE-pago dentro de Studio | NoonWeb `studio_version` |
| **`project_versions` (App)** | versiones del proyecto POST-pago (system of record) | App, migración `0069_project_versions` |
| **published version** | la `project_version` promovida a la URL pública | App — capa de publicación **aún inexistente** |

Fase 2 trabaja sobre **`project_versions` del App** y su publicación. NADA que ver
con `studio_version` (prototipo) ni con el prop `hasWorkspace`/preview del Studio.

---

## 2. Estado actual verificado (contra código, ambos repos)

### NoonWeb (consumidor)
- El project-status read (Slice 1a) **ya trae `versions[]`** — `lib/maxwell/project-status-types.ts:38-45`:
  `{ sequence, state:"ready_for_client_preview", previewUrl, at }`. **Slice 1a NO las
  pinta** (`:36` "Slice 1a does not render them yet ... version display / publish /
  rollback is Fase 2").
- El schema **no usa `.strict()` a propósito** (`:21-24`): "Fase 2 will add fields to
  `versions[]` (`published`/`published_url`)" → el consumidor ya tolera campos
  aditivos del productor. **El terreno está preparado para el pull.**
- Plomería HMAC ambos sentidos lista (`lib/noon-app-integration.ts`:
  `postNoonAppWebhook`/`signNoonAppEnvelope` outbound, `readSignedNoonAppRawJson`
  inbound). Patrón de receptor probado (§9 Slice B, `proposal-review-decision`).
- Sanitización defensiva al recibir: `assertNoInternalFields` + allowlist Zod.

### App (system of record)
- `project_versions` **existe** (migración `0069`). El productor del status
  (`lib/server/projects/client-status-read.ts:169-183`) lo lee filtrado a
  `ready_for_client_preview`, select `version_sequence_number, mvp_demo_url,
  created_at`, y emite `versions[]` ordenado.
- **NO existe:** tabla/columna de publicación (`version_publications` = 0 matches),
  ningún `published_url` ni estado de publish en el feed, ningún endpoint de acción
  (`app/api/integrations/website/` no tiene `version-action`/publish — solo
  project-status, client-request, client-comment, payment-confirmed, prototype-*).

**Conclusión:** Fase 2 es **greenfield cross-repo**. El App tiene la DATA de
versiones pero le falta toda la capa de publicación + el receptor de acción; NoonWeb
recibe el `versions[]` thin pero no lo muestra ni tiene UI de publish. **Requiere
co-diseño + build en ambos lados** (más grande que §9, que ya tenía endpoints).

---

## 3. Decisiones de diseño TOMADAS (marcadas — Pedro puede redirigir)

### D-1 · Transporte del estado de versiones/publish (App → Web) = **EXTENDER EL PULL** ✅ CONFIRMADO (Pedro, 2026-06-17)
Recomendación: **extender el `versions[]` del project-status read** que ya
consumimos, agregándole el estado de publicación + `published_url`, en vez de un push
`version-available` separado (como bosquejaba el master spec §20).
**Por qué:** (1) consistente con 1a/§9 (pull/signed-read, keyeado por projectId);
(2) el App ya tiene UN solo read productor; (3) nuestro schema ya es forward-compat
para `published`/`published_url` a propósito; (4) menos superficie nueva (no hay
receptor inbound nuevo). El estado de versión es **estado-actual** (pull encaja),
no un evento append-only.
*Alternativa si preferís:* push `version-available` (App→Web) a un receptor nuevo.

### D-2 · Acción Publish/Rollback (Web → App) = **OUTBOX OUTBOUND** estilo §9 Slice A
La acción del cliente se persiste local + se reenvía firmada (HMAC) al App vía
`postNoonAppWebhook`, idempotente, con dead-letter si el App 5xx — mismo molde que
`submit-request.ts`. El App ejecuta la publicación/rollback y el resultado se refleja
en el siguiente pull del status (D-1). **El App es quien ejecuta**; NoonWeb solo
captura la intención y la muestra.

### D-3 · Secuencia = **CO-DISEÑO PRIMERO** (no código aún) ✅ CONFIRMADO (Pedro, 2026-06-17)
El valor del display de historial está **acoplado** a que exista Publish (hoy el App
solo emite 1 versión `ready_for_client_preview` → el "historial" sería 1 fila). Por
eso conviene congelar el contrato Publish/Rollback con el App ANTES de construir,
en vez de shipear un display-only thin. *Alternativa:* Slice 2a display-only ya
(NoonWeb-only sobre el `versions[]` actual), co-diseño después.

---

## 4. Diseño propuesto

### 4.1 Lo que agrega el App (co-diseño — §7 lo cierra)
1. **Capa de publicación** — `version_publications` (o un puntero
   `published_version_sequence_number` + `published_url` en el proyecto). App = SoR.
2. **Extender el feed** project-status `versions[]` con, por versión: `published`
   (bool) + a nivel proyecto `publishedUrl` (string|null) + `publishedSequence`
   (cuál está publicada). Pasa por `sanitizeForClient` (sin fugas §8.3).
3. **Receptor `version-action`** `POST /api/integrations/website/version-action`
   (HMAC, idempotente): `{ action:"publish"|"rollback", projectId, versionSequenceNumber, externalActionId, at }`
   → ejecuta + responde ack. (Reusa el patrón de su `client-request` receptor.)

### 4.2 Lo que construye NoonWeb
- **Display (2a):** historial de versiones desde `versions[]` (sequence, previewUrl,
  fecha, marca de "Published") + preview por versión. En el workspace autenticado.
- **Acción Publish/Rollback (2b/2c):** UI gateada (auth + workspace mapeado, como el
  RequestBox) → server action `submit-version-action.ts` (molde `submit-request.ts`):
  valida, deriva nada nuevo, persiste outbox local + reenvía firmado al receptor del
  App, dead-letter si falla. Consume el estado publicado del pull (D-1) → muestra
  "Published" + la URL pública.
- **Mapping de copy** de estados de versión (NoonWeb dueño del label, §8.1).
- **`versionRef = versionSequenceNumber`** ya congelado en §9 (B.4) — reusar la misma
  identidad de versión cross-repo (ningún UUID interno cruza).

### 4.3 Slices
- **2a — Display de versiones** (NoonWeb-only sobre `versions[]` actual). Thin hasta
  que haya >1 versión / publish. Sin dependencia del App.
- **2b — Publish** (outbound action + consumir `published`/`publishedUrl` del pull).
  Gateado por el receptor + el feed extendido del App.
- **2c — Rollback** (misma vía outbound, `action:"rollback"`). Gateado por el App.

---

## 5. Seguridad / aislamiento (§8.3)
- Todo lo que cruza App→cliente pasa por `sanitizeForClient` (App) + allowlist Zod +
  `assertNoInternalFields` (NoonWeb). El `versions[]` extendido **no** debe traer
  `validation_outcome`, `originating_pipeline_run_id`, `mvp_content`, `origin`
  (denylist §3.2 del plan). El `published_url` es client-safe por definición.
- La acción Publish/Rollback es server-to-server firmada; el rate-limit del cliente
  lo hace NoonWeb en su server action (el receptor confía en el HMAC).
- **Autoría:** el master spec §20 dice "client can publish/rollback from the portal";
  el build-spec §4.4 dice rollback "autorizado por dev o PM/Admin". **Tensión a
  resolver en co-diseño** (§7 Q-A) — define si NoonWeb muestra la acción al cliente
  o solo refleja un estado que decide el App.

---

## 6. Fuera de alcance (diferido por owner / contrato)
- *Private Preview* y *Update Published Version* (owner: diferidos hasta demanda).
- Publish para project types no-web (pendiente de definición — §7 Q-C).
- Status feed §6/§21 que linkea a publicaciones (Phase 6, depende de Phase 2).

---

## 7. Preguntas abiertas que bloquean Architecture (co-firma con el App)

> **RESUELTAS 2026-06-18 — ver §9.** El App co-firmó y resolvió Q-A..Q-F. Lo de abajo es
> el planteo original (histórico); las respuestas congeladas están en §9.1.
- **Q-A · Autoría:** ¿el **cliente** dispara Publish/Rollback desde el portal (master
  spec §20) o lo decide dev/PM y NoonWeb solo refleja el estado (build-spec §4.4)?
  Esto define si construimos UI de acción (2b/2c) o solo display (2a).
- **Q-B · Transporte:** ¿confirman extender el `versions[]` del project-status read
  con `published`/`publishedUrl`/`publishedSequence` (D-1, pull) en vez del push
  `version-available`?
- **Q-C · Project types:** ¿"Publish" aplica solo a web/web-app en el MVP? ¿Qué pasa
  con los otros 6 types (Phase 5)?
- **Q-D · Modelo de publicación:** ¿`version_publications` (tabla con historial de
  quién publicó/cuándo) o un puntero simple en `projects`? Afecta el "history
  timeline (who published, when)" del §20.
- **Q-E · Rollback:** ¿rollback = mover el puntero publicado a una sequence anterior
  (idempotente, atómico)? ¿Hay versiones "archivadas" que no se pueden republicar?
- **Q-F · `version-action` shape + idempotencia:** confirmar
  `{ action, projectId, versionSequenceNumber, externalActionId, at }` + llave de
  idempotencia (`externalActionId` = id de la fila outbox, reusado en retries).

---

## 8. Secuencia propuesta
0. **Pedro confirma este diseño** (sobre todo D-1/D-3 y Q-A) → recién ahí se arma el
   handoff de co-diseño al App con §7.
1. Co-firma del contrato con el App (§7 cerrado) — bloquea Architecture de ambos.
2. NoonWeb **2a** (display) en paralelo (no depende del App; thin hasta que haya
   publish/multi-versión).
3. App entrega: capa de publicación + feed extendido + receptor `version-action`.
4. NoonWeb **2b** (Publish) contra el contrato congelado (stubs firmados en tests hasta
   que el App despliegue). **Sin Slice 2c (rollback UI) en el MVP** — ver §9 Q-A.

---

## 9. CONTRATO CONGELADO — respuesta de co-firma del App (2026-06-18)

El App respondió en `docs/2026-06-18-app-to-noonweb-v3-fase2-versioning-cosign-response.md`.
Las preguntas abiertas §7 (Q-A..Q-F) quedan **RESUELTAS y CONGELADAS**. Ambos repos pueden
construir en paralelo contra esta forma.

### 9.1 Resoluciones

- **Q-A · Autoría — el spec SEPARA autoridad (no es binaria):**
  **Publish = cliente** (self-service desde el portal, master spec §20.2);
  **Rollback = staff** (dev-autorizado / PM/Admin ejecuta DENTRO del App, §20.7).
  Decisión de alcance del owner (2026-06-18): en el MVP el **rollback lo ejecuta staff
  App-interno** y el resultado se refleja en el siguiente pull. **NoonWeb NO construye UI
  de rollback** — solo **Publish + display**. El "cliente *solicita* rollback" se **difiere**
  y se pliega luego a §9 client-requests con `versionRef` (B.4). → **No hay Slice 2c.**
- **Q-B · Transporte — CO-FIRMADO:** extender el `versions[]` del project-status pull
  (no un push nuevo). Como propuso D-1.
- **Q-C · Project types:** Publish aplica **solo a `web` / `web-app`** en el MVP; los otros
  6 → fase posterior. El receptor del App rechaza publish para types no-web.
- **Q-D · Modelo (decisión App, transparente para NoonWeb):** el estado de publicación vive
  en la propia `project_versions` (state CHECK ensanchado + columnas) + audit en
  `project_activities`; un puntero en `projects` es solo caché de lectura. NoonWeb solo
  consume el pull + la respuesta del receptor; no le importa la tabla.
- **Q-E · Rollback:** mover el puntero publicado a una sequence anterior, **atómico +
  idempotente**; solo versiones validadas (`ready_for_client_preview`+) son publicables;
  ejecuta staff (MVP), no cruza el wire.
- **Q-F · `version-action` shape (solo `publish` en el MVP):**
  `POST /api/integrations/website/version-action`
  `{ action:"publish", projectId, versionSequenceNumber, externalActionId, at }`
  → `200 { idempotent, publishedSequence, publishedUrl, requestId }`. Idempotente por
  `externalActionId` (UNIQUE app-level), **body flat + HTTP 200 en first-write y replay**
  (igual que los receptores existentes), HMAC reusado (`NOON_WEBSITE_WEBHOOK_SECRET`,
  **sin secreto nuevo**). `action:"rollback"` se rechaza en el MVP.

### 9.2 Forma congelada del pull (refinamiento del App sobre la propuesta §2)

El App **agregó un `state` client-visible por versión** (allowlist con default neutral,
patrón F-2 de `CLIENT_VISIBLE_PROJECT_STATUSES`) además del booleano `published`, para que
2a renderice el historial sin inferir:

```jsonc
"data": {
  "project":  { "id", "name", "status" },
  "proposal": { ... } | null,
  "payment":  { "activated", "status" },
  "versions": [
    {
      "sequence": 1,
      "state": "ready_for_client_preview" | "published" | "previous_published" | "rolled_back",
      "previewUrl": "<url|null>",
      "at": "<ISO>",
      "published": false            // NUEVO — conveniencia, === (state === 'published')
    }
  ],
  "publishedSequence": 2 | null,    // NUEVO — qué sequence está publicada (null si ninguna)
  "publishedUrl": "<url|null>",     // NUEVO — URL pública client-facing actual
  "latestUpdate": { ... } | null,
  "serverTime": "<ISO>"
}
```

**Impacto en el consumidor de NoonWeb (hallazgo de implementación):** el schema actual de
`lib/maxwell/project-status-types.ts` tenía `state: z.literal("ready_for_client_preview")`.
El comentario forward-compat anticipaba **campos nuevos** (tolerados sin `.strict()`), pero
NO un **cambio de los valores de `state`** — un `z.literal` rechazaría `"published"` y haría
fallar el `versions[]` completo → todo el status read del portal. Slice 2a convierte `state`
a `z.string()` (como `project.status`) y delega el allowlist + default neutral al copy-mapping
(`version-status-labels.ts`), espejando el patrón `mapProjectStatusToMeta`. NoonWeb es dueño
del label (§8.1) y cualquier estado interno/no mapeado degrada a neutral, nunca cruza.

### 9.3 Alcance NoonWeb post-freeze

- **Slice 2a — Display de versiones** (este slice): historial + preview por versión + marca
  "Published"/"Previous published"/"Rolled back" usando el `state` por versión, sobre el
  `versions[]` del pull. **0 dependencia del App** — construible ya; thin hasta que el App
  emita >1 versión / publique.
- **Slice 2b — Publish:** UI de acción gateada (solo web/web-app) + server action outbox
  (molde `submit-request.ts`) → receptor §9.1 Q-F; consume `publishedUrl`/`publishedSequence`
  del pull. Contra stubs firmados hasta que el App despliegue.
- **Sin Slice 2c** (rollback) en el MVP (Q-A).
