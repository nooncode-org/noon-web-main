# Handoff → App (NoonApp) — NoonWeb empieza a poblar `generated_html` con el CÓDIGO del prototipo

**Date:** 2026-06-06 · **From:** NoonWeb · **To:** App (NoonApp) devs
**Trigger:** handoff `docs/handoffs/2026-06-06-noonweb-prototype-flow-handoff.md` (App repo) §5 — "send the CODE, not just a URL".
**TL;DR:** NoonWeb va a empezar a mandar el código fuente de V0 en el campo **existente** `prototype.generated_html`. **App no necesita cambios** para que Opus lo consuma (ya lo hace, Iter 9). Hay un cleanup opcional y un heads-up sobre el srcDoc fallback.

---

## 1. Qué cambia en NoonWeb

Hoy NoonWeb captura solo el `demo_url` de V0 y nunca el código → App recibe `generated_html = null` y Opus no puede preservar el diseño (escala a humano). Lo estamos cerrando: NoonWeb va a capturar `latestVersion.files[]` de V0, serializarlos y enviarlos en `prototype.generated_html` en cada share.

**Formato del valor** — los múltiples archivos de V0 en un solo string, con bloques delimitados por archivo:

```
// === file: app/page.tsx ===
<contenido del archivo>

// === file: components/hero.tsx ===
<contenido del archivo>
```

Pensado para que Opus lo lea como código y reconstruya el árbol. Si prefieren otro formato (p.ej. JSON del array `{name, content}`), es un cambio chico de nuestro lado — avisen.

---

## 2. Por qué App NO necesita cambios

Verificado contra el estado actual del repo de App:

- **Contrato** `docs/integrations/cross-repo-webhook-v1.md` §5A: `prototype.generated_html` ya está definido (string nullable, opcional).
- **Schema** `lib/server/website-integration.ts` (`websitePrototypeSharePrototypeSchema`): `generated_html: optionalHtmlSchema` ya lo acepta (sin validar formato — solo recorta vacío→null). El refine exige `deployed_url` OR `generated_html`; mandamos ambos.
- **Persistencia** (mismo archivo): `generated_html: input.payload.prototype.generated_html ?? null` ya mapea a la columna `prototype_workspaces.generated_html`.
- **Consumo Opus** `lib/server/ai-mvp/steps/context.ts` (~L94-98): `content: data.generated_html ?? data.generated_content` — ya prefiere `generated_html`, con el comentario "the v3 share flow persists the prototipo CODE on `generated_html`". Esto es justo lo que vamos a poblar.

En cuanto NoonWeb despliegue, `generated_html` deja de ser null y Opus recibe código real. **No hay cambio de contrato ni de release acoplado.**

---

## 3. Cleanup opcional (no bloqueante) — placeholder en `generated_content`

En el handler de share (`lib/server/website-integration.ts`, bloque de persistencia ~L2410-2418) hay:

```ts
generated_content: input.payload.prototype.deployed_url ?? null,   // mete el demo URL en la columna de código
```

`generated_content` (migración 0046, "v0 source code for audit") está recibiendo el `deployed_url`. No es bloqueante porque Opus prefiere `generated_html`, pero queda inconsistente: la columna "de código" guarda una URL. Sugerencia: setearla a `null` (o al `generated_html` recibido) en vez del demo URL. A criterio de los devs de App.

---

## 4. Heads-up — el srcDoc fallback del signed-read vs. guardar código en `generated_html`

`generated_html` arrastra una semántica dual sin reconciliar dentro de App:

- Migración `0063` / ADR-028 + mapping del signed-read (`lib/server/website-integration.ts` ~L2833): describe `generated_html` como **HTML renderable para iframe `srcDoc`** ("never source code ... would render as plain text").
- Iter 9 (`context.ts`): usa `generated_html` como **el código fuente** que mejora Opus.

Como V0 produce TSX multi-archivo (no HTML standalone), guardar código ahí significa que **si el signed-read sirviera ese `generated_html` a un cliente que lo renderice como `srcDoc`, se vería como texto plano**.

Por qué NO rompe el flujo real (lado NoonWeb): el client page `/maxwell/prototipo/[token]` usa `deployedUrl` como render primario y `generatedHtml` (srcDoc) **solo como fallback cuando no hay deployedUrl**. En el share siempre mandamos `deployed_url`, así que el fallback nunca se dispara. Pero conviene que App lo sepa: la descripción "srcDoc fallback" de `generated_html` quedó obsoleta tras Iter 9 (reversión de F-06). Si en algún momento App quiere un srcDoc renderable de verdad, necesitaría una columna/campo aparte — hoy no es necesario.

---

## 5. Checklist de coordinación
- [ ] App confirma el formato del valor de `generated_html` (bloques delimitados u otro).
- [ ] (Opcional) App limpia el placeholder `generated_content: deployed_url`.
- [ ] (FYI) App registra que la semántica "srcDoc" de `generated_html` quedó obsoleta tras Iter 9.
- [ ] NoonWeb: capturar `files[]` de V0, persistir, enviar `generated_html` (Track 1, en marcha).
- [ ] Smoke cross-repo: un share real deja código legible en `prototype_workspaces.generated_html` y Opus lo consume.

---

## 6. Referencias (App repo)
- Handoff origen: `docs/handoffs/2026-06-06-noonweb-prototype-flow-handoff.md` §5.
- Contrato: `docs/integrations/cross-repo-webhook-v1.md` §5A.
- Schema + persistencia + signed-read mapping: `lib/server/website-integration.ts`.
- Consumo Opus: `lib/server/ai-mvp/steps/context.ts` (Iter 9; commits `1b9a84c`, `df523d0`).
- Columnas: migración `0046` (`generated_content`), migración `0063` / ADR-028 (`generated_html`).
