# Handoff — App → NoonWeb: respuesta de co-firma de B.4 (version-linking, §9)

**Fecha:** 2026-06-20
**Para:** equipo **NoonWeb** (`noon-web-main`) — dev o sesión de agente.
**De:** App-nooncode.
**En respuesta a:** `noon-web-main/docs/2026-06-19-v3-b4-version-linking-noonweb-codesign.md` (su DRAFT de co-diseño de B.4).
**Objetivo:** **cerrar las 6 preguntas de su §3** y **congelar el contrato de B.4** para que NoonWeb entre a Architecture/build. 4 ya estaban resueltas por el contrato desplegado del App; este doc **decide Q-B4-2** (la única genuinamente abierta) y **corrige Q-B4-3**.

> Auto-contenido. Valores verificados 2026-06-20 contra el código real del App:
> - Contrato del wire: `docs/integrations/cross-repo-webhook-v1.md` §5C (incl. `versionRef` línea 648).
> - Vocabulario + estados + colapso client-visible: `lib/projects/client-request-types.ts`.
> - Máquina de estados §9.4: `lib/projects/client-request-state-machine.ts`.
> - Scope-eval §10 (B.3b): `lib/projects/client-request-scope-eval.ts`.
> - Ejecución staff del rollback (Fase 2 S3): `app/api/projects/[projectId]/versions/[versionSequenceNumber]/rollback/route.ts` + RPC `rollback_project_version` (migración 0093, en prod).

---

## 0. TL;DR

1. **Su auditoría acierta.** El App **ya acepta `versionRef`** desde 2026-06-18 (B.4 / PR #186 / migración 0085) → **Q-B4-1 ✅ · Q-B4-5 ✅ · Q-B4-6 ✅** y la parte "no-ecoado" de **Q-B4-4 ✅**. El path de *referenciar* una versión en cualquier request es **construible hoy**.
2. **Q-B4-2 DECIDIDO → adoptamos el 10º `type = rollback`** (su recomendación). Wire string exacto: **`rollback`** (snake_case). El App lo agrega a su vocabulario + CHECK + matriz de scope-eval. **Regla congelada: `versionRef` es REQUERIDO cuando `type = rollback`** (el App lo valida server-side como `400`, además de la validación client-side de NoonWeb).
3. **Q-B4-3 CORREGIDO.** El App **NO rechaza targets de rollback al recibir** — su postura es *dangling-accept* (sin FK; un `versionRef` bien-formado pero no-resoluble se acepta+almacena). La validación y **ejecución** del rollback viven **staff-side** (panel Fase 2 S3, ya en prod). El cliente **pide**, el staff **decide y ejecuta**. El filtro UI de NoonWeb (ofrecer el botón solo en versiones no-actuales) es **buen UX que aceptamos como convención**, pero **no es contrato App-enforced**.
4. **Q-B4-4 confirmado completo.** Un rollback-request fluye por las **mismas 5 estados client-visible** que cualquier request. La máquina de estados del App es **type-agnostic** (opera solo sobre `state`, nunca mira `type`) → cero cambio de estados.
5. **Cero env/secreto nuevo, ambos lados.** Reusa el bridge HMAC.

**Estado:** contrato de B.4 **CONGELADO**. NoonWeb puede entrar a Architecture/build de B4-a + B4-b. El App abre **una nueva iteración pequeña** para shippear el `type = rollback` (vocabulario + 1 migración CHECK aditiva + 1 entrada de matriz + refinamiento de validación). **Orden de despliegue duro** en §4.

---

## 1. Las 4 ya resueltas por el contrato desplegado (confirmación formal)

| # | Confirmación |
|---|---|
| **Q-B4-1 ✅** | El receptor `POST /api/integrations/website/client-request` (B.1, en prod) acepta `versionRef` **opcional y aditivo** desde 2026-06-18. Ausente → comportamiento B.1 idéntico (back-compat total). Sin cambio de schema App-side para la *recepción* del campo. Ref: `cross-repo-webhook-v1.md` §5C.2 línea 648 + nota B.4. |
| **Q-B4-5 ✅** | Cualquiera de los types existentes puede llevar `versionRef` como **referencia puramente informativa** ("feedback sobre la versión N"); no implica acción sobre la versión. Omitir = comentario general (se almacena `NULL`). |
| **Q-B4-6 ✅** | B.4 **no agrega env ni secreto** de ningún lado. Reusa `NOON_WEBSITE_WEBHOOK_SECRET` + el keying `projectId == projects.id == client_workspace.noon_app_project_id`. (El único env nuevo de §9 fue `NOON_WEBSITE_CLIENT_REQUEST_STATE_URL`, el target **outbound** de B.2 — no lo toca B.4.) |
| **Q-B4-4 (parte "no-ecoado") ✅** | `versionRef` es **staff-internal (§8.3)**: **nunca** se ecoa en el outbound §7B, cuyo body se mantiene exactamente en los 4 campos congelados (`externalRequestId · clientVisibleState · revision · at`). Verificado en `client-request-types.ts` (`collapseToClientVisibleState` + comentario §8.3) y en el contrato §7B. |

**Detalle del campo (congelado, sin cambios):** `versionRef` opcional, `integer`, **`1 ≤ versionRef ≤ 100000`**, **= `versionSequenceNumber`** (mismo id que Publish 2b). Malformed (no-entero / ≤0 / `> 100000` / NaN) → `400 CLIENT_REQUEST_INVALID_PAYLOAD`. **Bien-formado-pero-no-resoluble → se ACEPTA + almacena** (sin FK; resolución lazy, dangling-tolerant en la lectura staff). Esto cubre su corrección de §2.2: un ref no-resoluble **no** se rechaza.

> **Sobre su validación local (NoonWeb §2.2):** correcto validar `Number.isInteger(versionRef) && versionRef >= 1 && versionRef <= 100000` client-side para que el cliente reciba un error limpio. El App es el backstop autoritativo (mismo cap `100000`).

---

## 2. Q-B4-2 — DECIDIDO: 10º `type = rollback`

Adoptamos su recomendación. Razón de fondo (la que cierra la discusión "nuevo type vs reuso"):

- **Reusar `scope_change` mis-clasifica:** la matriz de scope-eval del App (B.3b, `client-request-scope-eval.ts`) mapea `scope_change → requires_new_proposal`. Un rollback a una versión **ya publicada y entregada** **no** es scope nuevo vendible → no debería sugerir una nueva propuesta. Reusar `adjustment` (`→ in_scope`) acierta el verdict pero pierde la señal de ruteo y mezcla dos intenciones.
- **Un `type` dedicado** da (a) verdict de scope correcto, (b) señal de ruteo limpia para el staff sin inspeccionar `versionRef`+`body`, (c) etiqueta clara para el cliente.
- **Costo App acotado:** la máquina de estados y el outbound son **type-agnostic** → no cambian. Solo se toca el vocabulario, la matriz de scope-eval y un CHECK aditivo (`client_requests` es noon_migrator-owned → lane limpia, sin owner-trap).

### 2.1 Reglas congeladas de `rollback`

| Regla | Valor |
|---|---|
| Wire string | **`rollback`** (snake_case), 10º valor del enum `type`. |
| `versionRef` | **REQUERIDO** cuando `type = rollback` (los otros 9 lo dejan opcional). El App valida server-side: `type = rollback` sin `versionRef` → **`400 CLIENT_REQUEST_INVALID_PAYLOAD`**. |
| `versionRef` no-resoluble en un rollback | **Se acepta+almacena igual** (dangling-tolerant). No se cae un rollback-request por una carrera de mirroring de versiones; el staff resuelve y decide. |
| Estados | Las **mismas 5 client-visible** (Q-B4-4). Es un request más. |
| Scope verdict (App-interno) | **`in_scope`** — revertir trabajo ya entregado no es scope nuevo; no dispara la sugerencia "requiere nueva propuesta". Staff-internal, nunca cruza el wire. |
| Autoridad de ejecución | **Staff** (Fase 2: rollback = autoridad staff). El request es **suggest-not-force**: surface al staff, que ejecuta vía el panel S3. Ver §3. |

> **NoonWeb declara el mismo set** de su lado (`CLIENT_REQUEST_TYPES` + label "Solicitar rollback") y valida `type ∈ {los 10}` + `versionRef` requerido cuando `rollback` **antes** de reenviar.

### 2.2 Qué construye el App (nueva iteración, en paralelo a su build)

- Agregar `rollback` a `CLIENT_REQUEST_TYPES` (→ 10) + label es-MX en `client-request-types.ts`.
- Migración aditiva: re-emitir el CHECK de `client_requests.type` con los **10** valores (cuidado con el *CHECK-superset trap* — el re-add debe cargar el set completo actual). Lane limpia (tabla noon_migrator-owned). **Apply-before-merge.**
- Entrada en la matriz de scope-eval: `rollback → in_scope` (el *exhaustiveness guard* del módulo lo obliga) + bump del `SCOPE_EVALUATOR_VERSION` (audit-trail).
- Refinamiento del schema Zod del receptor: `type = rollback ⇒ versionRef` requerido (`400` si falta).
- Doc/contrato (`cross-repo-webhook-v1.md` §5C.10 pasa de 9 → 10 types; nota de la regla `versionRef`-requerido) + ADR + master-spec §9.1.

Esto es **App-interno**; no cambia ningún shape que ya esté congelado salvo el enum `type` (de 9 a 10, aditivo y back-compat).

---

## 3. Q-B4-3 — CORRECCIÓN: targets de rollback

Su doc asume *"ofrecerlo en toda versión que no sea la `publishedSequence` actual y dejar que el App rechace cualquier inválida server-side"*. **El App no rechaza al recibir.** Postura real:

- **Recepción = dangling-accept.** No hay FK; un `versionRef` bien-formado se acepta+almacena aunque apunte a una versión actual, inexistente, o aún no mirrored. **El App no juzga la validez del target en el receptor.**
- **La validación + ejecución del rollback es staff-side**, en el panel Fase 2 S3 (`rollback_project_version`, en prod). Ahí viven las reglas reales (T3/T4 con reemplazo, T5 sin reemplazo, idempotencia, authz EXECUTE=admin/pm). El **cliente pide**; el **staff decide y ejecuta o declina**. Esto es exactamente el diferido de Fase 2 ("client-rollback-request → §9 + versionRef B.4") y respeta el split de autoridad (rollback = staff) + el principio suggest-not-force.
- **Su filtro UI** (mostrar "Solicitar rollback a esta versión" solo en versiones distintas de la publicada actual) es **buen UX y lo aceptamos como convención de presentación**, pero **no es un contrato que el App imponga**. Si por una carrera el cliente pide rollback a un target que el staff considera inválido, el staff simplemente no lo ejecuta — el request queda como cualquier otro y fluye por sus 5 estados (p. ej. termina en `under_internal_review`/`completed` según lo que el staff decida).

**Neto:** NoonWeb decide los targets que *ofrece*; el App acepta lo que llegue (bien-formado) y deja la decisión final al staff. Ninguna versión "válida" o "inválida" cambia el código de respuesta del receptor.

---

## 4. Modelo de datos NoonWeb (su §4) + orden de despliegue

- Su migración **025** (`version_ref INTEGER` + CHECK `version_ref IS NULL OR version_ref >= 1`) es correcta y simétrica con la del App. **Sugerencia menor (no bloqueante):** alinear el CHECK a `>= 1 AND <= 100000` para empatar el cap del App, o mantener `>= 1` en DB y el rango completo `1..100000` en la server action (su enfoque declarado) — cualquiera sirve, el App es el backstop.
- La regla `version_ref` requerido cuando `type = rollback` **en la server action** (no como CHECK compuesto) — coincidimos.

**Orden de despliegue duro (Q-B4-2):**

1. El **path de referencia** (`versionRef` en cualquier type) es construible y **mergeable hoy** — el App ya lo acepta. No depende de nada nuevo del App.
2. El **path de rollback** requiere que el App **despliegue primero** el `type = rollback` (CHECK incluyendo el 10º valor aplicado en prod). Hasta entonces, un `type = rollback` reenviado **degrada limpio** con `400 CLIENT_REQUEST_INVALID_PAYLOAD` (su §7 ya lo contempla). → **NoonWeb no habilita el path de rollback en prod hasta que el App confirme `rollback` desplegado.** Avisaremos cuando la migración esté aplicada+verificada.

---

## 5. Checklist de asks-back (espejo de su §8)

- [x] **Q-B4-1** — `versionRef` aditivo aceptado, ignorado si ausente. **✅** (en prod desde 2026-06-18).
- [x] **Q-B4-2** — Señal de rollback: **nuevo `type = rollback`**, string exacto **`rollback`**, `versionRef` requerido cuando aplica. El App lo agrega a enum + CHECK + matriz scope-eval. **✅ DECIDIDO.**
- [x] **Q-B4-3** — Targets de rollback: **el App no valida al recibir (dangling-accept); staff valida+ejecuta**. Filtro UI de NoonWeb = convención UX, no contrato. **✅ CORREGIDO + cerrado.**
- [x] **Q-B4-4** — Rollback-request usa **las mismas 5 estados** (máquina type-agnostic) + `versionRef` nunca ecoado. **✅** completo.
- [x] **Q-B4-5** — `versionRef` informativo en los types existentes. **✅.**
- [x] **Q-B4-6** — Cero env/secreto nuevo, ambos lados. **✅.**

**Contrato de B.4 CONGELADO.** Las 6 preguntas resueltas.

---

## 6. Secuencia (post-freeze)

1. **Co-diseño B.4: CERRADO.** (este doc + su DRAFT del 2026-06-19).
2. **NoonWeb:** entra a build de **B4-a** (write path: vocabulario `rollback`, `versionRef` en payload + persistencia + server action) y **B4-b** (UI: selector "Regarding version" + botón de rollback + log con `Re: versión N`), contra este contrato. Migración 025 aplicada+verificada primero.
3. **App (en paralelo):** nueva iteración para shippear el `type = rollback` (§2.2), apply-before-merge de la migración CHECK. El path de *referencia* (`versionRef`) ya está en prod.
4. **Gate de habilitación del path de rollback:** el App confirma `rollback` desplegado → NoonWeb activa el path de rollback en prod.
5. **Smoke bilateral** (como §9/Fase 2): workspace mapeado → enviar un request con `versionRef` en un type normal + un `type=rollback` desde la UI; confirmar que el App recibe `versionRef`, lo resuelve staff-side, y el estado vuelve por el receptor §7B (las mismas 5 estados).

---

## 7. Referencias

- Su co-diseño: `noon-web-main/docs/2026-06-19-v3-b4-version-linking-noonweb-codesign.md`.
- Contrato del wire (App): `App-nooncode/docs/integrations/cross-repo-webhook-v1.md` §5C (`versionRef` línea 648).
- Vocabulario / estados / colapso: `App-nooncode/lib/projects/client-request-types.ts`.
- Máquina de estados §9.4: `App-nooncode/lib/projects/client-request-state-machine.ts`.
- Scope-eval §10 (B.3b): `App-nooncode/lib/projects/client-request-scope-eval.ts`.
- B.4 versionRef (ya en prod): ADR-037 + migración 0085 + `specs/v3-client-requests-b4-version-linking.md`.
- Rollback staff (Fase 2 S3): ADR-040 + migración 0093 + `app/api/projects/[projectId]/versions/[versionSequenceNumber]/rollback/route.ts`.
- Co-firmas previas: `2026-06-16-app-to-noonweb-client-requests-cosign-response.md` (§9), `2026-06-18-app-to-noonweb-v3-fase2-versioning-cosign-response.md` (Fase 2).
