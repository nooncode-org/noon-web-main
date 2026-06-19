# NoonWeb — Diseño + co-diseño de B.4 (version-linking), lado web

- **Fecha:** 2026-06-19
- **Repo:** `noon-web-main`
- **Estado:** DRAFT para co-firma del App (pre-freeze). NoonWeb NO construye código hasta que el App co-firme la §3.
- **Predecesores congelados:** `docs/v3-client-requests-noonweb-design.md` (§9), `docs/2026-06-17-v3-fase2-versioning-publish-design.md` (Fase 2), `docs/2026-06-18-app-to-noonweb-v3-fase2-versioning-cosign-response.md` (co-firma Fase 2).

> ### 🔄 UPDATE 2026-06-19 — el App ya aceptó la mitad del contrato
>
> Auditoría de alineación posterior a la redacción de este doc: el contrato desplegado del App **ya acepta `versionRef`** en el `client-request` **desde 2026-06-18** (`App-nooncode/docs/integrations/cross-repo-webhook-v1.md:648`): `versionRef` OPCIONAL, *positive int ≤ 100000*, malformed → `400`, **un ref bien-formado pero aún no resoluble se ACEPTA + almacena** (sin FK, resolución lazy staff-side), **staff-internal — NUNCA ecoado en el outbound §7B**, omitir para un comentario general (NULL).
>
> **Efecto sobre las 6 preguntas de §3:** el **campo `versionRef` ya está resuelto** → **Q-B4-1** (recepción aditiva) ✅, **Q-B4-5** (referencia informativa en cualquier type) ✅, **Q-B4-6** (sin env nuevo) ✅, y la parte "no-ecoado" de **Q-B4-4** ✅. Lo que queda **genuinamente abierto es el clúster de rollback, todo gateado por Q-B4-2**: **Q-B4-2** (¿nuevo `type = rollback` vs reuso?) + **Q-B4-3** (targets válidos — depende del diseño de rollback) + la parte "mismas 5 estados para un rollback-request" de Q-B4-4.
>
> **El path de *referenciar* una versión ya es construible hoy** (el App lo acepta); solo el path de *solicitar rollback* espera la respuesta a **Q-B4-2**.
>
> **Ajustes a este doc por el contrato desplegado:** validación local = `1 ≤ versionRef ≤ 100000` (no solo `≥1`); y un ref no-resoluble **no se rechaza** (el App lo acepta+almacena) — contrario a lo que decía la redacción original de §2.2, ya corregida.

---

## 0. TL;DR

B.4 cierra el lazo **Fase 2 ↔ Fase 3 (§9)**. Hoy el cliente **ve** el historial de versiones (Slice 2a) y **publica** una versión (Slice 2b), pero **no puede referenciar una versión dentro de un request ni solicitar un rollback** — la Fase 2 dejó el rollback como staff-side App-interno y difirió explícitamente el canal del cliente a "§9 + `versionRef` (B.4)".

B.4 agrega ese eslabón con el **mínimo de superficie cross-repo**:

1. **Un campo de wire opcional y aditivo:** `versionRef` (= `versionSequenceNumber`) en el payload del client-request §9.
2. **Una señal de rollback** (decisión de co-diseño — recomendación: un 10º `type = rollback`).
3. **Alcance Opción B:** referenciar una versión en *cualquier* request + un botón **"Solicitar rollback a esta versión"** en cada fila del historial (display 2a), que abre el RequestBox pre-cargado.

**Cero env/secreto nuevo** (reusa el bridge HMAC). **1 migración NoonWeb** (025, columna `version_ref` aditiva). **De las 6 preguntas de co-diseño (§3), 4 ya están resueltas por el contrato desplegado del App (`versionRef` aceptado desde 2026-06-18 — ver UPDATE arriba); queda 1 genuinamente abierta: Q-B4-2 (la señal de rollback).**

---

## 1. Contexto y por qué (lo ya enviado)

- **Fase 2 (congelada 2026-06-18):** Publish = self-service del cliente; **Rollback = staff, App-interno** → NoonWeb NO tiene UI de rollback (sin Slice 2c). La co-firma del App registró: *"cliente solicita rollback" diferido a §9 + `versionRef` (B.4)*.
- **§9 (congelada 2026-06-16):** client-request con 9 `type` / 5 `clientPriority` / `body` 1..4000, idempotente por `externalRequestId`. El freeze resolvió **`versionRef = versionSequenceNumber`** pero lo marcó **DIFERIDO a B.4 → omitido en B.1**.
- **Verificado en código (2026-06-19):** el payload §9 actual NO lleva `versionRef` (`lib/noon-app-integration.ts` `buildClientRequestPayload`); la tabla `client_request` (migración 024) no tiene columna de versión; el identificador `versionSequenceNumber` ya está probado cross-repo en Publish 2b.

B.4 es la unión natural de las dos fases ya cerradas: la Fase 2 nos dio el historial de versiones que el cliente ve, y §9 nos dio el canal de requests. B.4 los conecta.

---

## 2. Qué cruza el wire (contrato propuesto — aditivo, back-compat)

### 2.1 Recap del payload §9 actual (no cambia)

`POST /api/integrations/website/client-request` (camelCase, HMAC, de-dup por `externalRequestId`):

```
{ externalRequestId, projectId, submittedBy, type, clientPriority, body, at }
```

### 2.2 El único campo nuevo

Se agrega **un campo opcional**:

| Campo | Tipo | Regla |
|-------|------|-------|
| `versionRef` | `integer` | Opcional/omitible. Presente: **`1..100000`**, **= `versionSequenceNumber`** (mismo id de Fase 2). El App resuelve `(projectId, versionRef)` lazy staff-side; un ref bien-formado pero no resoluble se **acepta+almacena** (no se rechaza). **Ya aceptado App-side desde 2026-06-18.** |

- **Back-compat:** ausente → request sin versión, idéntico al comportamiento B.1 actual. Ningún consumidor pre-B.4 se rompe.
- **Validación local NoonWeb (consistente con Publish 2b):** *shape* = `Number.isInteger(versionRef) && versionRef >= 1 && versionRef <= 100000` (el cap `100000` matchea el contrato desplegado del App; malformed → error limpio al cliente, sin llegar al App). Un ref bien-formado pero aún no resoluble **NO se rechaza**: el App lo acepta+almacena (resolución lazy staff-side). Para el botón de rollback el ref se elige del historial ya desplegado, así que resuelve por construcción.

### 2.3 Señal de "solicitar rollback"

Opción B separa dos intenciones: **referenciar** una versión (cualquier `type` + `versionRef`) vs **pedir un rollback**. Si `versionRef != null` por sí solo significara "rollback", no podríamos tener un `bug` que solo menciona la v3 sin que se lea como "volvé a la v3". Por eso la intención de rollback necesita una señal propia.

**Recomendación NoonWeb (sujeta a co-firma — el App es dueño del ruteo operativo):** un **10º `type = rollback`** (snake_case en el wire), declarado idéntico en ambos repos, con la regla: **`versionRef` REQUERIDO cuando `type = rollback`**, opcional para los otros 9. Esto le da al App una señal de ruteo limpia sin inspeccionar `versionRef` + `body`, y le da al cliente una etiqueta clara ("Solicitar rollback").

Alternativa si el App prefiere no tocar el vocabulario: reusar `adjustment`/`scope_change` + `versionRef` + convención de `body`. NoonWeb la puede implementar, pero pierde la señal de ruteo limpia. **Es decisión del App** (Q-B4-2).

---

## 3. Preguntas de co-diseño (el App debe co-firmar esto antes de que NoonWeb construya)

> **Estado al 2026-06-19 (ver UPDATE arriba):** el campo `versionRef` ya está aceptado App-side → **Q-B4-1 ✅ · Q-B4-5 ✅ · Q-B4-6 ✅** y la parte "no-ecoado" de **Q-B4-4 ✅**. **La ÚNICA pregunta que bloquea la construcción del rollback es Q-B4-2** (de ella dependen Q-B4-3 y la parte de estados de Q-B4-4).

- **Q-B4-1 — Recepción aditiva.** ¿El receptor `/api/integrations/website/client-request` (B.1, ya desplegado) acepta el `versionRef` opcional de forma aditiva y lo ignora con gracia cuando está ausente (back-compat)? ¿O requiere un cambio de schema del lado App?
- **Q-B4-2 — Señal de rollback.** ¿Adoptamos un 10º `type = rollback` (recomendación NoonWeb) o reusamos un type existente + `versionRef`? Si es nuevo type: confirmar el string exacto (`rollback`) y que el App lo agrega a su enum + a su colapso de estados.
- **Q-B4-3 — Targets válidos de rollback.** ¿Qué versiones son destinos válidos (para mostrar el botón solo donde corresponde)? Propuesta NoonWeb: ofrecerlo en toda versión que **no** sea la `publishedSequence` actual y dejar que el App rechace cualquier inválida server-side. ¿OK, o el App prefiere una regla más estrecha (p. ej. solo `state = previous_published`)?
- **Q-B4-4 — Máquina de estados.** ¿Un request de rollback fluye por las **mismas 5 estados client-visible** (`received → in_review → ...`) que cualquier request, o el App necesita algo distinto? Propuesta: las mismas 5; un rollback es un request más.
- **Q-B4-5 — `versionRef` en requests no-rollback.** ¿Puede cualquiera de los 9 types existentes (p. ej. `bug`) llevar `versionRef` como simple referencia, sin implicar acción sobre la versión? Propuesta: sí, es puramente informativo salvo cuando `type = rollback`.
- **Q-B4-6 — Sin env/secreto nuevo.** Confirmar que B.4 reusa el bridge HMAC existente (`NOON_WEBSITE_WEBHOOK_SECRET` / `NOON_APP_BASE_URL`) y no introduce env/secreto de ningún lado. (NoonWeb confirma que de su lado no agrega ninguno.)

---

## 4. Modelo de datos NoonWeb — migración 025 (aditiva, reversible)

Una sola columna sobre `client_request`, contenido **NoonWeb-owned e inmutable tras el create** (como `type`/`body`):

```sql
ALTER TABLE client_request
  ADD COLUMN IF NOT EXISTS version_ref INTEGER;

ALTER TABLE client_request
  ADD CONSTRAINT client_request_version_ref_check
  CHECK (version_ref IS NULL OR version_ref >= 1);
```

- Nullable: los requests sin versión (la mayoría) la dejan `NULL`.
- Reversible (`DROP COLUMN version_ref`). Self-register en `schema_migrations`, espeja la disciplina de 023/024.
- Patrón de aplicación: **migración-primero** (aplicar + verificar en la DB de Web ANTES de mergear el código), igual que 023/024.
- La **regla "`version_ref` requerido cuando `type = rollback`"** se valida en la server action (no como CHECK compuesto en DB), para mantener el mensaje de error client-legible y la columna simple.

---

## 5. Slices NoonWeb (post-freeze — no antes de la co-firma de §3)

### 5.1 Slice B4-a — write path

- **Vocabulario** (`lib/maxwell/client-requests.ts`): si Q-B4-2 = nuevo type, agregar `rollback` a `CLIENT_REQUEST_TYPES` + label ("Request rollback") + (si aplica) el CHECK de `type` en una migración. Módulo puro, client-safe.
- **Payload** (`lib/noon-app-integration.ts`): `buildClientRequestPayload` / `sendClientRequestToNoonApp` ganan `versionRef?: number` (omitido del objeto cuando es `null`/`undefined`, para no ensuciar el wire).
- **Persistencia** (`repositories.ts`): `createClientRequest` acepta `versionRef?: number | null`; `getClientRequestsByWorkspace` lo devuelve para el display.
- **Server action** (`_actions/submit-request.ts`): validar shape de `versionRef`; si `type = rollback`, exigir `versionRef`; persistir; reenviar (mismo flujo persist-then-forward, dead-letter).

### 5.2 Slice B4-b — UI

- **RequestBox** (`_components/request-box.tsx`): selector opcional **"Regarding version"** poblado desde el `versions[]` del pull (que la página ya tiene). Cuando se elige `type = rollback`, el selector pasa a requerido.
- **VersionsSection** (`page.tsx`): botón **"Solicitar rollback a esta versión"** en las filas elegibles (Q-B4-3), que abre el RequestBox pre-cargado (`type = rollback`, `versionRef = sequence`, body por defecto editable).
- **Log de requests:** mostrar `version_ref` en la fila ("Re: versión N") cuando esté presente.

---

## 6. Gates y disciplina (sin cambios respecto de §9/Fase 2)

- **Gate Q-10:** un request (rollback incluido) exige proyecto payment-activated (mapeado a `noon_app_project_id`) + bridge configurado. Reusa el guard de `submit-request.ts`.
- **Rate-limit:** reusa el namespace `maxwell.client-request` (no se agrega uno nuevo).
- **Anti-leak:** el `versionRef` es un entero client-safe que NoonWeb origina; no toca el receptor inbound de estado (Slice B §9 ya es `.strict()` allowlist). Sin nuevos campos sensibles.
- **Minimización:** sin cambios; `submittedBy` sigue siendo el id opaco HMAC.
- **4 gates verdes** (eslint / tsc / vitest / build) antes de cualquier PR; migración 025 aplicada+verificada antes del merge.

---

## 7. Secuencia y dependencias

1. **El App co-firma §3** (las 6 preguntas) → contrato congelado. *(estado actual: pendiente)*
2. NoonWeb construye **B4-a** (write path) contra el contrato congelado; la migración 025 se aplica+verifica primero.
3. NoonWeb construye **B4-b** (UI).
4. **Smoke bilateral** como §9/Fase 2: con un workspace mapeado, enviar un request con `versionRef` + un rollback-request desde la UI; confirmar que el App recibe `versionRef`, lo resuelve, y el estado vuelve por el receptor de Slice B §9 (las mismas 5 estados).

**Dependencia dura:** el App debe aceptar `versionRef` (aditivo) y fijar la señal de rollback (Q-B4-2) antes de que NoonWeb mergee. Mientras tanto, el forward de un rollback-request degrada limpio (error del App) igual que cualquier request no soportado.

---

## 8. Checklist de asks-back (lo que NoonWeb necesita del App para destrabar Architecture)

- [x] Q-B4-1 — `versionRef` aditivo aceptado por el receptor existente, ignorado si ausente. **✅ RESUELTA** (aceptado App-side desde 2026-06-18, `cross-repo-webhook-v1.md:648`).
- [ ] **Q-B4-2 — Señal de rollback: nuevo `type = rollback` (recomendado) vs reuso. String exacto confirmado. ⬅️ ÚNICA ABIERTA — bloquea el path de rollback.**
- [ ] Q-B4-3 — Regla de targets válidos de rollback. *(depende de Q-B4-2)*
- [~] Q-B4-4 — Rollback-request usa las mismas 5 estados client-visible. **Parte "no-ecoado" ✅** (el App nunca ecoa `versionRef` en §7B); la parte de estados depende de Q-B4-2.
- [x] Q-B4-5 — `versionRef` informativo permitido en los types existentes. **✅ RESUELTA** (el App lo define como "feedback on a version"; omitir para comentario general).
- [x] Q-B4-6 — Cero env/secreto nuevo, ambos lados. **✅ CONFIRMADA** (`versionRef` no agrega env).
