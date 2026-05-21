# Maxwell Studio — Quality Layer
## Handoff Document para Claude Code · Versión Definitiva

Fecha: 15 mayo 2026
Repo: `noon-web-main`
Objetivo: Mejorar la calidad visual de los prototipos que Maxwell genera via v0, añadiendo un sistema de 24 familias visuales con 72 referencias de sitios reales, extracción estructurada del brief del proyecto, y refuerzo visual en correcciones.

---

## Contexto del problema

`buildPrototypeBrief()` en `components/maxwell/studio-shell.tsx` genera ~5 líneas genéricas del historial del chat. v0 recibe instrucciones vagas sin dirección visual, sin contexto estructurado del producto, y sin referencias de estética. El resultado son prototipos genéricos.

**v0 genera solo el visual** — estructura, estética, layout. La funcionalidad real la implementa el desarrollador después. La dirección visual es la señal más importante que le podemos pasar. Los tokens adicionales invertidos en un mejor brief producen un resultado significativamente mejor.

---

## Principios del diseño

1. **Invisible para el usuario** — todo ocurre en el servidor, sin preguntas adicionales al cliente
2. **Server-side** — el brief se construye en `route.ts`, nunca en el cliente
3. **Cada sesión es independiente** — el contexto de un chat nunca contamina otro
4. **El style pack persiste en la sesión** — para reutilizarlo en correcciones sin reclasificar
5. **Correcciones también reciben contexto visual** — no solo la creación inicial
6. **Graceful degradation** — si el brief estructurado no está listo, el sistema funciona igual que hoy

---

## Archivos nuevos a crear

### 1. `lib/maxwell/style-packs.ts` ← YA EXISTE (no tocar)

24 familias visuales × 3 referencias. Ya escrito y compilando.

Exporta: `STYLE_PACKS`, `getStylePackById(id)`, `getStylePackByName(name)`, tipos `StylePack` y `StyleReference`.

### 2. `lib/maxwell/style-classifier.ts` ← YA EXISTE (no tocar)

Clasifica la sesión en una familia visual usando `gpt-4.1-mini`.

**Input:** `StudioSession` + string de contexto
**Output:** `StylePack`

**Fallback determinista por `projectType`:**
```
landing    → clean-professional
ecommerce  → commerce-retail
webapp     → tech-digital
mobile     → tech-digital
saas_ai    → tech-digital
```

Si todo falla → `clean-professional`.

### 3. `lib/maxwell/prototype-brief.ts` ← YA EXISTE — REESCRIBIR COMPLETO

El archivo fue creado antes de cerrar todas las decisiones. Está desactualizado en orden de secciones, firma de función, y le falta `buildCorrectionBrief()`. Reescribirlo completamente:

#### `buildPrototypeBrief(session, brief, messages, lastUserMsg, lastAssistantMsg, stylePack)`

```typescript
import type { StudioSession } from "./repositories";
import type { StudioBrief } from "./repositories";
import type { StylePack } from "./style-packs";

type HistoryMessage = { role: "user" | "assistant"; content: string; type?: string };

function distillContext(
  messages: HistoryMessage[],
  lastUserMsg: string,
  lastAssistantMsg: string,
): string {
  return messages
    .filter((m) => m.type !== "thinking" && m.type !== "system_event" && m.type !== "error")
    .concat(
      { role: "user", content: lastUserMsg },
      { role: "assistant", content: lastAssistantMsg },
    )
    .slice(-8)
    .map((m) => {
      const speaker = m.role === "user" ? "Client" : "Maxwell";
      return `${speaker}: ${m.content.replace(/\s+/g, " ").trim().slice(0, 300)}`;
    })
    .join("\n");
}

function buildReferencesBlock(pack: StylePack): string {
  return pack.refs
    .map((ref, i) =>
      ref.v0Hint
        ? `${i + 1}. ${ref.url} — ${ref.v0Hint}`
        : `${i + 1}. ${ref.url}`,
    )
    .join("\n");
}

export function buildPrototypeBrief(
  session: StudioSession,
  brief: StudioBrief | null,
  messages: HistoryMessage[],
  lastUserMsg: string,
  lastAssistantMsg: string,
  stylePack: StylePack,
): string {
  const context = distillContext(messages, lastUserMsg, lastAssistantMsg);
  const references = buildReferencesBlock(stylePack);
  const isLanding = session.projectType === "landing";

  const parts: string[] = [];

  // 1. MASTER INSTRUCTION
  parts.push(
    "// ─── 1. MASTER INSTRUCTION ───────────────────────────────────────────────────",
    "Frontend-only prototype. Static mock data only. No backend, no APIs.",
  );
  if (isLanding) {
    parts.push("EXCEPTION: This project IS a landing page — build it as requested.");
  }
  parts.push("");

  // 2. WHAT TO BUILD
  parts.push(
    "// ─── 2. WHAT TO BUILD ────────────────────────────────────────────────────────",
    "PRODUCT",
    session.goalSummary ?? session.initialPrompt,
    "",
    `TYPE: ${session.projectType ?? "unknown"}   COMPLEXITY: ${session.complexityHint ?? "unknown"}   LANG: ${session.language}`,
    "",
  );

  // 3. VISUAL DIRECTION
  parts.push(
    "// ─── 3. VISUAL DIRECTION ─────────────────────────────────────────────────────",
    `Style family: ${stylePack.name}`,
    `Feel: ${stylePack.feel}`,
    "",
    "References (adapt the aesthetic, not the content):",
    references,
    "",
  );

  // 4. PRODUCT CONTEXT (only if brief is available)
  if (brief) {
    parts.push("// ─── 4. PRODUCT CONTEXT ──────────────────────────────────────────────────────");
    if (brief.objective)    parts.push(`Objective: ${brief.objective}`);
    if (brief.users)        parts.push(`Users: ${brief.users}`);
    if (brief.primaryUser)  parts.push(`Primary user: ${brief.primaryUser}`);
    if (brief.coreFlow)     parts.push(`Core flow: ${brief.coreFlow}`);
    if (brief.platform)     parts.push(`Platform: ${brief.platform}`);
    if (brief.styleDirection) parts.push(`Style notes: ${brief.styleDirection}`);
    parts.push("");
  }

  // 5. CONVERSATION CONTEXT
  parts.push(
    "// ─── 5. CONVERSATION CONTEXT ────────────────────────────────────────────────",
    context,
  );

  return parts.join("\n").trim();
}
```

#### `buildCorrectionBrief(correctionPrompt, stylePack?)`

```typescript
export function buildCorrectionBrief(
  correctionPrompt: string,
  stylePack?: StylePack,
): string {
  if (!stylePack) return correctionPrompt;

  const refUrls = stylePack.refs.map((r) => r.url).join(", ");

  return [
    correctionPrompt,
    "",
    "[Visual direction — maintain this]:",
    `Style family: ${stylePack.name}`,
    `Feel: ${stylePack.feel}`,
    `References: ${refUrls}`,
  ].join("\n");
}
```

### 4. `lib/maxwell/brief-extractor.ts` ← NUEVO

```typescript
/**
 * lib/maxwell/brief-extractor.ts
 *
 * Extracts a structured product brief from the Maxwell chat history.
 * Called fire-and-forget when READY_FOR_PROTOTYPE is signaled.
 * Never throws — all errors are caught and logged.
 * The prototype route handles null brief gracefully (Opción C).
 */

import { chatWithOpenAI } from "@/lib/api-ia";
import { upsertStudioBrief } from "./repositories";

// Uses its own type — does NOT import ChatMessage from api-ia
// because that type allows content as OpenAI.Chat parts, which we don't need here.
type HistoryMessage = { role: "user" | "assistant"; content: string };

export async function extractAndSaveBrief(
  sessionId: string,
  history: HistoryMessage[],
): Promise<void> {
  try {
    const conversation = history
      .map((m) => `${m.role === "user" ? "Client" : "Maxwell"}: ${m.content}`)
      .join("\n");

    const { reply } = await chatWithOpenAI({
      model: "gpt-5.5",
      systemPrompt: `You are a product analyst. Extract structured information from this client conversation.
Reply with ONLY a valid JSON object. No explanation, no markdown, no backticks.
Use null for fields not mentioned in the conversation. All values must be strings or null.`,
      prompt: `Extract the following fields from this conversation:
{
  "objective": "what problem this product solves — one sentence",
  "users": "who are all the users of this product",
  "primaryUser": "the single most important user type",
  "coreFlow": "the main user flow — key screens or interactions in order",
  "platform": "web | mobile | both | unknown",
  "integrations": "external services or integrations mentioned, or null",
  "styleDirection": "any visual style preferences mentioned by the client, or null",
  "constraints": "any technical or business constraints mentioned, or null"
}

Conversation:
${conversation}`,
    });

    // Strip markdown fences if model adds them
    const clean = reply.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as Record<string, string | null>;

    await upsertStudioBrief({
      studioSessionId: sessionId,
      objective:       parsed.objective      ?? undefined,
      users:           parsed.users          ?? undefined,
      primaryUser:     parsed.primaryUser    ?? undefined,
      coreFlow:        parsed.coreFlow       ?? undefined,
      platform:        parsed.platform       ?? undefined,
      integrations:    parsed.integrations   ?? undefined,
      styleDirection:  parsed.styleDirection ?? undefined,
      constraints:     parsed.constraints    ?? undefined,
    });
  } catch (error) {
    // Fire-and-forget — log but never throw.
    // Prototype generation continues regardless.
    console.error("[brief-extractor] Failed to extract brief:", error);
  }
}
```

---

## Archivos existentes a modificar

### 5. `lib/api-ia.ts`

**Cambio A:** actualizar el modelo default de `gpt-4.1` a `gpt-5.5`:
```typescript
// Antes:
const { ..., model = "gpt-4.1", ... } = params;

// Después:
const { ..., model = "gpt-5.5", ... } = params;
```

**Cambio B:** eliminar `DEFAULT_V0_SYSTEM` completamente y hacer que `createV0Prototype` lance error si no se pasa `systemPrompt`:

```typescript
// Eliminar estas líneas (86-92):
const DEFAULT_V0_SYSTEM =
  "You are an expert frontend developer specializing in crafting beautiful, modern, and highly detailed single-view landing pages. " +
  // ... resto del string ...

// En createV0Prototype, reemplazar:
// Antes:
system: systemPrompt ?? DEFAULT_V0_SYSTEM,

// Después:
system: systemPrompt ?? (() => { throw new Error("systemPrompt is required for createV0Prototype"); })(),
```

O más limpio — hacer `systemPrompt` required en el tipo `V0CreateParams`:
```typescript
export type V0CreateParams = {
  prompt: string;
  systemPrompt: string; // ← quitar el "?" — ahora es required
};
```

**No tocar:** `lib/upgrade/generator.ts` y `lib/upgrade/analyzer.ts` — tienen `model: "gpt-4.1"` con override explícito, fuera del scope de este PR.

### 6. `lib/maxwell/repositories.ts`

**Cambio A:** añadir `style_pack_id` al tipo `SessionRow`:
```typescript
type SessionRow = {
  id: string; initial_prompt: string; status: string;
  owner_email: string | null; owner_name: string | null; owner_image: string | null;
  project_type: string | null; goal_summary: string | null;
  complexity_hint: string | null; language: string;
  corrections_used: number; max_corrections: number;
  proposal_requested_at: string | Date | null; created_at: string | Date; updated_at: string | Date;
  deleted_at?: string | Date | null;
  style_pack_id: string | null; // ← nuevo
};
```

**Cambio B:** añadir `stylePackId` al tipo `StudioSession`:
```typescript
export type StudioSession = {
  // ... todos los campos existentes sin cambio ...
  stylePackId: string | null; // ← nuevo — al final
};
```

**Cambio C:** añadir `stylePackId` al mapper `mapSession()`:
```typescript
function mapSession(r: SessionRow): StudioSession {
  return {
    id: r.id, initialPrompt: r.initial_prompt, status: r.status as StudioStatus,
    ownerEmail: r.owner_email, ownerName: r.owner_name, ownerImage: r.owner_image,
    projectType: r.project_type, goalSummary: r.goal_summary,
    complexityHint: r.complexity_hint, language: r.language,
    correctionsUsed: Number(r.corrections_used), maxCorrections: Number(r.max_corrections),
    proposalRequestedAt: toIsoTimestamp(r.proposal_requested_at),
    createdAt: toIsoTimestamp(r.created_at)!,
    updatedAt: toIsoTimestamp(r.updated_at)!,
    stylePackId: r.style_pack_id ?? null, // ← nuevo
  };
}
```

**Cambio D:** añadir función `setStylePackId` usando la sintaxis postgres.js del proyecto:
```typescript
export async function setStylePackId(
  sessionId: string,
  stylePackId: string,
): Promise<void> {
  const sql = getDb();
  const now = new Date().toISOString();
  await sql`
    UPDATE studio_session
    SET style_pack_id = ${stylePackId},
        updated_at    = ${now}
    WHERE id = ${sessionId}
  `;
}
```

### 7. `app/api/maxwell/chat/route.ts`

**Añadir import:**
```typescript
import { extractAndSaveBrief } from "@/lib/maxwell/brief-extractor";
```

**Cambio:** dentro de `if (shouldStartPrototypeBuild)`, después de `updateStudioSessionStatus`:
```typescript
if (shouldStartPrototypeBuild) {
  session = await updateStudioSessionStatus(session.id, "generating_prototype");
  // Fire-and-forget: extract structured brief from conversation.
  // Does not block response. Prototype route handles null brief gracefully.
  void extractAndSaveBrief(session.id, historyForOpenAI);
}
```

**Nota de tipo:** `historyForOpenAI` en `chat/route.ts` es `ChatMessage[]` de `api-ia.ts` que tiene `content: string | OpenAI.Chat.Completions.ChatCompletionContentPart[]`. Sin embargo, `getStudioMessagesForOpenAI()` siempre retorna `content: string`. El cast es seguro pero hay que añadirlo explícitamente:

```typescript
void extractAndSaveBrief(
  session.id,
  historyForOpenAI.map((m) => ({
    role: m.role as "user" | "assistant",
    content: typeof m.content === "string" ? m.content : "",
  })),
);
```

### 8. `app/api/maxwell/prototype/route.ts`

**Añadir imports:**
```typescript
import { getStudioBrief, setStylePackId } from "@/lib/maxwell/repositories";
import { classifyStylePack } from "@/lib/maxwell/style-classifier";
import {
  buildPrototypeBrief,
  buildCorrectionBrief,
} from "@/lib/maxwell/prototype-brief";
import { getStylePackById } from "@/lib/maxwell/style-packs";
```

**Schema — `action: create`** — reemplazar el campo `prompt` por mensajes crudos:
```typescript
const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  type: z.string().optional(),
});

const studioCreateSchema = z.object({
  action: z.literal("create"),
  messages: z.array(chatMessageSchema).max(50),
  last_user_msg: z.string().trim().min(1).max(4000),
  last_assistant_msg: z.string().trim().min(1).max(4000),
  session_id: z.string(),
});
```

**Schema — `action: update`** — NO CAMBIA. Mantener exactamente como está.

**Handler — `action: create`** — reemplazar llamada directa a v0:
```typescript
await updateStudioSessionStatus(session.id, "generating_prototype");

// ── Quality Layer ─────────────────────────────────────────────────────────
const stylePack = await classifyStylePack(session, payload.last_user_msg);
await setStylePackId(session.id, stylePack.id);
const brief = await getStudioBrief(session.id); // null-safe — graceful fallback
const prototypeBrief = buildPrototypeBrief(
  session,
  brief,
  payload.messages,
  payload.last_user_msg,
  payload.last_assistant_msg,
  stylePack,
);
// ─────────────────────────────────────────────────────────────────────────

let result: Awaited<ReturnType<typeof createV0Prototype>>;
try {
  result = await createV0Prototype({
    prompt: prototypeBrief,
    systemPrompt: V0_PROTOTYPE_SYSTEM_PROMPT,
  });
} catch (v0Error) {
  // ... manejo de error existente sin cambio ...
}
```

**Handler — `action: update`** — añadir refuerzo visual antes de llamar a v0:
```typescript
// Recover style pack for visual consistency across corrections
const stylePack = session.stylePackId
  ? getStylePackById(session.stylePackId)
  : undefined;

const correctionPrompt = buildCorrectionBrief(payload.prompt, stylePack);

let result: Awaited<ReturnType<typeof updateV0Prototype>>;
try {
  result = await updateV0Prototype({
    chatId: payload.chatId,
    prompt: correctionPrompt,
  });
} catch (v0Error) {
  // ... manejo de error existente sin cambio ...
}
```

### 9. `components/maxwell/studio-shell.tsx`

**Cambio A:** eliminar la función `buildPrototypeBrief()` del cliente — ahora vive server-side.

**Cambio B:** actualizar el payload del fetch de `action: create`:
```typescript
// Antes:
const prototypeBrief = buildPrototypeBrief(messages, lastUserMsg, lastAssistantMsg);
body: JSON.stringify({
  action: "create",
  prompt: prototypeBrief,
  ...(effectiveSessionId ? { session_id: effectiveSessionId } : {}),
})

// Después:
body: JSON.stringify({
  action: "create",
  messages: messages
    .filter((m) => m.type !== "thinking" && m.type !== "system_event" && m.type !== "error")
    .slice(-50)
    .map((m) => ({ role: m.role, content: m.content, type: m.type })),
  last_user_msg: lastUserMsg,
  last_assistant_msg: lastAssistantMsg,
  ...(effectiveSessionId ? { session_id: effectiveSessionId } : {}),
})
```

**No tocar:** payload de `action: update` — sigue enviando `prompt` crudo. `buildCorrectionBrief()` ocurre en el servidor.

---

## Migración de base de datos

### `supabase/migrations/20260515_013_studio_session_style_pack.sql`

```sql
-- Add style_pack_id to studio_session
-- Persists the classified visual style family for reuse in corrections.
-- No foreign key — references STYLE_PACKS constant in TypeScript, not a DB table.
ALTER TABLE studio_session
  ADD COLUMN IF NOT EXISTS style_pack_id TEXT;
```

---

## Modelos GPT por uso

| Uso | Modelo | Override | Razón |
|---|---|---|---|
| Maxwell chat (discovery) | `gpt-5.5` | Default global en `api-ia.ts` | Flagship — mejor razonamiento e instrucción |
| Clasificador de familias | `gpt-4.1-mini` | Explícito en `style-classifier.ts` | Tarea trivial — 1 de 24. Optimiza costo y latencia |
| Brief extractor | `gpt-5.5` | Explícito en `brief-extractor.ts` | Necesita entender matices del chat |
| Upgrade generator/analyzer | `gpt-4.1` | Explícito en `upgrade/` — no tocar | Feature separada, fuera del scope |

---

## Race condition — Opción C implementada

```
chat/route.ts
  → updateStudioSessionStatus("generating_prototype")
  → void extractAndSaveBrief(...)        ← fire-and-forget, no bloquea

studio-shell.tsx
  → POST /api/maxwell/prototype (action: create)

prototype/route.ts
  → classifyStylePack()                  ← siempre disponible
  → setStylePackId()
  → getStudioBrief()                     ← puede ser null
  → buildPrototypeBrief(session, null, ...) ← omite sección 4 si null
  → createV0Prototype(prototypeBrief)
```

Si `brief` es null → prototipo se genera con secciones 1-3 + 5. Mejor que hoy.
En la práctica el extractor termina antes de que el usuario interactúe con el estado de carga.

---

## landing override

`V0_PROTOTYPE_SYSTEM_PROMPT` contiene: *"Do NOT build a landing page unless specifically requested."*

`buildPrototypeBrief()` añade en sección 1 cuando `projectType === "landing"`:
```
EXCEPTION: This project IS a landing page — build it as requested.
```

Esto sobrescribe explícitamente la regla del system prompt para este caso.

---

## Estado final de cada archivo

| Archivo | Estado | Acción requerida |
|---|---|---|
| `lib/maxwell/style-packs.ts` | ✅ Listo | No tocar |
| `lib/maxwell/style-classifier.ts` | ✅ Listo | No tocar |
| `lib/maxwell/prototype-brief.ts` | ⚠️ Desactualizado | Reescribir completo según spec de este doc |
| `lib/maxwell/brief-extractor.ts` | 🆕 No existe | Crear según spec de este doc |
| `lib/api-ia.ts` | 🔧 Modificar | Default `gpt-5.5` + eliminar `DEFAULT_V0_SYSTEM` + hacer `systemPrompt` required en `V0CreateParams` |
| `lib/maxwell/repositories.ts` | 🔧 Modificar | `style_pack_id` en `SessionRow` + `stylePackId` en `StudioSession` + mapper + `setStylePackId()` |
| `app/api/maxwell/chat/route.ts` | 🔧 Modificar | Import `extractAndSaveBrief` + fire-and-forget con cast de tipo |
| `app/api/maxwell/prototype/route.ts` | 🔧 Modificar | Nuevo schema create + pipeline Quality Layer + corrección enriquecida |
| `components/maxwell/studio-shell.tsx` | 🔧 Modificar | Eliminar `buildPrototypeBrief()` + nuevo payload create |
| `supabase/migrations/20260515_013_studio_session_style_pack.sql` | 🆕 No existe | `ADD COLUMN style_pack_id TEXT` |

---

## Lo que NO cambia

- Schema de `action: update` en `route.ts` — solo cambia el handler, no el schema
- Payload de correcciones desde el cliente — sigue enviando `prompt` crudo
- `V0_PROTOTYPE_SYSTEM_PROMPT` en `prompts.ts` — no se toca
- Flujo de estados de la sesión — no cambia
- `lib/upgrade/` — fuera del scope de este PR
- `app/api/maxwell/prototype/poll/route.ts` — no necesita cambios
- `App-nooncode` — no genera prototipos, no necesita estos cambios
- Experiencia del usuario — 100% invisible, sin preguntas adicionales

---

## Archivos de referencia para Claude Code

Deben estar disponibles al inicio de la sesión:
- `lib/maxwell/style-packs.ts` — ya en el repo, no tocar
- `lib/maxwell/style-classifier.ts` — ya en el repo, no tocar
- `maxwell-style-packs.md` — catálogo de las 72 referencias aprobadas manualmente
- `NoonApp_Updated_Flow_Diagrams_v3.md` — diagramas de flujo del sistema completo
