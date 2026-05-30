# 📬 Handoff App-nooncode — 2026-05-30 — Demo URL en columna equivocada

> **Lado afectado:** App-nooncode (generación + signed-read). El lado Web está correcto, no hay nada que tocar ahí. Este doc describe un bug de datos en App, con evidencia de DB, para que los devs de App lo corrijan en la fuente.

---

## 🐞 Síntoma (reportado en Web)

En la página pública del prototipo (`/maxwell/prototipo/[token]`, "Tu prototipo"), el preview muestra **la URL del demo de v0 como texto plano** sobre fondo blanco, en lugar de renderizar el prototipo:

```
https://demo-kzmpmz6v5tp32sqgbjnm.vusercontent.net?__v0_token=eyJhbGciOiJkaXIiLC...
```

---

## 🔍 Causa raíz (verificada en la DB de App)

La App guardó la **URL del preview de v0 en la columna equivocada** de `prototype_workspaces`.

Query sobre el proyecto Supabase de App (`pdotsdahsrnnsoroxbfe`), workspace `c48e417c-08d4-45a8-b698-95e0a3dd965c` (creado 2026-05-30 22:06 UTC):

| Columna | Valor |
|---|---|
| `demo_url` | **NULL** |
| `generated_html` | **NULL** |
| `chat_url` | NULL |
| `v0_chat_id` | NULL |
| `generated_content` | **`https://demo-kzmpmz6v5tp32sqgbjnm.vusercontent.net?__v0_token=...`** ← la URL del síntoma |

O sea: la URL del demo terminó en `generated_content` en vez de `demo_url`.

### Por qué se ve como texto en Web

El contrato del signed-read (ADR-024) que Web consume mapea:

- `demo_url` → `prototype.deployedUrl` → Web hace `<iframe src=...>` (carga el preview).
- contenido HTML → `prototype.generatedHtml` → Web hace `<iframe srcDoc=...>` (renderiza HTML inline).

Como `demo_url` viene NULL y el campo de contenido trae **la URL como string**, Web recibe `generatedHtml = "<la URL>"` y hace `srcDoc="https://demo-...net?..."`. Un `srcDoc` cuyo cuerpo es una URL **se pinta como texto plano** → el síntoma.

El componente de Web (`app/[locale]/maxwell/prototipo/[token]/_components/prototipo-frame.tsx`) está correcto: prefiere `deployedUrl` (iframe `src`) y solo cae a `srcDoc` cuando no hay URL. Le está llegando el dato en el campo incorrecto.

---

## 📉 Es una regresión reciente

Estado de las 4 `prototype_workspaces` (más recientes primero):

| Workspace | Creada | `demo_url` | `generated_content` | ¿Funciona en el preview? |
|---|---|---|---|---|
| `c48e417c` | 2026-05-30 | **NULL** | la URL del demo | ❌ (este reporte) |
| `97d22b2e` | 2026-05-27 | poblado ✅ | (texto) | ✅ |
| `ced3bca7` | 2026-05-27 | poblado ✅ | (texto) | ✅ |
| `5c0c6bf8` | 2026-05-26 | **NULL** | (413 chars) | ❌ probable |

Los del 05-27 tienen `demo_url` poblado y renderizan bien. El de 05-30 (y al menos otro) lo tienen NULL con la URL en `generated_content`. Algo cambió en el flujo de generación de App entre el 27 y el 30.

Probable correlación: el manejo de v0 chat-mode anotado en el smoke del D-slice (Gap #1, 2026-05-26 — el poll producía `versionId`s nuevos cada ~30s y la signature no se estabilizaba). Si el path que persiste el resultado cambió, pudo empezar a escribir la URL en `generated_content` en vez de en `demo_url`.

---

## ✅ Lo que necesita el lado App

1. **Persistir la URL del demo de v0 en `demo_url`** (no en `generated_content`). `generated_content` / `generated_html` deberían contener HTML cuando exista, nunca la URL.
2. **Backfill de las filas afectadas** (al menos `c48e417c` y `5c0c6bf8`): mover el valor de `generated_content` a `demo_url` cuando `generated_content` sea una URL `https://demo-*.vusercontent.net` y `demo_url` esté NULL. Verificar que no haya más casos con el mismo patrón.
3. **Confirmar el mapeo del signed-read**: que `prototype.deployedUrl` salga de `demo_url` y `prototype.generatedHtml` solo de HTML real. Si hoy hace coalesce de `generated_content` hacia `generatedHtml`, ese coalesce es lo que expone la URL como "HTML".

Con `demo_url` poblado, Web renderiza el iframe correctamente sin ningún cambio adicional.

---

## 🔒 Decisión del lado Web

Se evaluó un guard defensivo en Web (detectar que `generatedHtml` es en realidad una URL y tratarla como `deployedUrl`). **Se decidió NO hacerlo**: el dato debe corregirse en la fuente (App). Web queda esperando el campo correcto. Si más adelante se quiere el guard como defensa-en-profundidad, queda anotado como follow-up, no como fix.

---

## 📚 Refs

| Doc | Para qué |
|---|---|
| `app/[locale]/maxwell/prototipo/[token]/_components/prototipo-frame.tsx` | Render Web (correcto) — referencia del contrato deployedUrl/generatedHtml |
| `lib/maxwell/prototipo-render-types.ts` | Tipo `PrototipoRenderData` + mapper de UX states (incl. `ready.preparing` cuando ambos campos son null) |
| ADR-024 (App-nooncode) | Contrato del GET signed-read cross-repo |

---

## TL;DR

La generación de App está guardando la URL del demo de v0 en `prototype_workspaces.generated_content` en vez de `demo_url`. El signed-read la expone como `generatedHtml`, y Web la renderiza como texto en un `srcDoc`. Fix: persistir en `demo_url` + backfill de las filas afectadas. Web no cambia.
