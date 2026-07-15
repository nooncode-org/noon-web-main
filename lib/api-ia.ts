/**
 * lib/api-ia.ts
 * Integraciones reutilizables de IA: OpenAI + V0 (v0-sdk v0.16).
 *
 * Modelo default:
 *   gpt-5.5 (GA en OpenAI desde 2026-04-23). El default se resuelve via
 *   `process.env.OPENAI_DEFAULT_MODEL ?? "gpt-5.5"` para permitir rollback
 *   sin redeploy si surge un problema (rate limit, cost spike, etc.) —
 *   setear `OPENAI_DEFAULT_MODEL=gpt-4.1` en Vercel y reload, vuelve al
 *   modelo previo en segundos.
 *
 *   Cost note: gpt-5.5 cuesta ~5x input + 3x output vs gpt-4.1
 *   ($5/M in + $30/M out vs ~$2.50/$10). Aceptable para FASE 1
 *   internal-only; re-evaluar si exposure crece.
 *
 * Variables de entorno:
 *   OPENAI_API_KEY        – clave OpenAI (requerida).
 *   V0_API_KEY            – clave V0 (requerida; configurada globalmente por v0-sdk).
 *   OPENAI_DEFAULT_MODEL  – opcional; override del modelo default por env.
 *                           Usar "gpt-4.1" para rollback al modelo previo,
 *                           o un snapshot fijo como "gpt-5.5-2026-04-23".
 */

import OpenAI from "openai";
import { v0 } from "v0-sdk";

import {
  assertBudgetAvailable,
  recordLLMCall,
  type LLMCategory,
} from "@/lib/server/llm-budget";

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type ChatMessage = {
  role: "user" | "assistant";
  content: string | OpenAI.Chat.Completions.ChatCompletionContentPart[];
};

export type OpenAIParams = {
  /** Mensaje del usuario (texto) */
  prompt?: string;
  /** URL de imagen opcional para visión */
  imageUrl?: string;
  /** Historial previo de mensajes */
  history?: ChatMessage[];
  /** Prompt de sistema */
  systemPrompt?: string;
  /** Modelo a usar. Default = resolveDefaultOpenAIModel() ("gpt-5.5" or env override). */
  model?: string;
  /** Optional abort signal for user-initiated cancellation. */
  signal?: AbortSignal;
  /**
   * G-D2 LLM budget category tag — used by the budget ledger to break
   * down monthly spend per Maxwell surface. Defaults to "unlabeled"
   * for backward compat; new callers should always pass a specific
   * category. Grep `recordLLMCall(` to see the live categories.
   */
  category?: LLMCategory;
  /**
   * Optional stable id used for traceability in the budget ledger
   * (e.g. `${studioSessionId}:${turnIndex}`). Best-effort; recorded
   * only when present.
   */
  requestId?: string | null;
};

export type OpenAIResult = {
  reply: string;
};

export type V0CreateParams = {
  /** Descripcion del prototipo a generar */
  prompt: string;
  /**
   * System prompt for v0. Required (Bloque 11 follow-up): the previous
   * `DEFAULT_V0_SYSTEM` fallback always built single-view landing pages,
   * which conflicted with the Quality Layer prompt's project-type-aware
   * direction. The single in-tree caller (`app/api/maxwell/prototype/route.ts`)
   * passes `V0_PROTOTYPE_SYSTEM_PROMPT` explicitly; making this required
   * surfaces any future caller that forgets to pass one at compile time
   * instead of silently rendering a generic landing.
   */
  systemPrompt: string;
};

export type V0SendMessageParams = {
  /** ID del chat de V0 existente */
  chatId: string;
  /** Mensaje de modificacion */
  prompt: string;
};

export type V0Result = {
  chatId: string;
  demoUrl: string;
};

// ---------------------------------------------------------------------------
// OpenAI – Chat con soporte de vision e historial
// ---------------------------------------------------------------------------

const DEFAULT_OPENAI_SYSTEM =
  "You are a helpful assistant.";

/**
 * Resolves the default OpenAI chat model. Returns `process.env.OPENAI_DEFAULT_MODEL`
 * if set and non-empty after trim, else falls back to `"gpt-5.5"`.
 *
 * Exposed (not inlined) so callers that need to log which model was selected
 * — or tests that mock env — can call it directly. Re-evaluates on every
 * call so env changes via `vi.stubEnv` are picked up without module reload.
 */
export function resolveDefaultOpenAIModel(): string {
  const fromEnv = process.env.OPENAI_DEFAULT_MODEL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : "gpt-5.5";
}

// `DEFAULT_V0_SYSTEM` was removed in the Bloque 11 follow-up. It always
// hardcoded single-view landing pages, which contradicts the Quality Layer
// (lib/maxwell/prototype-brief.ts) that adapts the prompt to the actual
// projectType. `V0CreateParams.systemPrompt` is now required so any future
// caller has to pass V0_PROTOTYPE_SYSTEM_PROMPT (or another deliberate
// alternative) — a missing system prompt is a compile error, not a silent
// landing-page surprise.

/**
 * Llama a OpenAI con soporte de texto, imagen e historial. Modelo default
 * resuelto via {@link resolveDefaultOpenAIModel} ("gpt-5.5" o env override).
 */
export async function chatWithOpenAI(params: OpenAIParams): Promise<OpenAIResult> {
  const {
    prompt,
    imageUrl,
    history = [],
    systemPrompt,
    model = resolveDefaultOpenAIModel(),
    signal,
    category = "unlabeled",
    requestId,
  } = params;

  if (!prompt && !imageUrl) {
    throw new Error("Se requiere al menos un prompt o imageUrl.");
  }

  // G-D2: hard-stop check BEFORE the LLM call. Throws
  // `LLMBudgetExceededError` (caught by callers and translated to a
  // 503 with a friendly message). Designed as anomaly detection — with
  // the existing prototype-quota caps, this should never fire on
  // legitimate traffic. Race-safe via advisory lock.
  await assertBudgetAvailable();

  let userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] | string;

  if (imageUrl && prompt) {
    userContent = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: imageUrl } },
    ];
  } else if (imageUrl) {
    userContent = [{ type: "image_url", image_url: { url: imageUrl } }];
  } else {
    userContent = prompt!;
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt ?? DEFAULT_OPENAI_SYSTEM },
    ...(history as OpenAI.Chat.Completions.ChatCompletionMessageParam[]),
    { role: "user", content: userContent },
  ];

  const completion = await getOpenAIClient().chat.completions.create(
    { model, messages },
    { signal },
  );

  const reply =
    completion.choices[0]?.message?.content ?? "No se pudo generar una respuesta.";

  // G-D2: record actual token usage post-response. Fire-and-forget at
  // the call-site level — `recordLLMCall` never throws to the caller.
  // We await it here only because `chatWithOpenAI` is awaited anyway;
  // the cost of the extra DB insert is ~5-10ms.
  await recordLLMCall({
    category,
    provider: "openai",
    // Echo the API-reported model (may differ from `model` arg when an
    // alias like "gpt-5.5" resolves to a dated snapshot like "gpt-5.5-2026-04-23").
    model: completion.model ?? model,
    inputTokens: completion.usage?.prompt_tokens ?? null,
    outputTokens: completion.usage?.completion_tokens ?? null,
    requestId,
    metadata: {
      finish_reason: completion.choices[0]?.finish_reason ?? null,
    },
  });

  return { reply };
}

// ---------------------------------------------------------------------------
// V0 – Crear prototipo nuevo
// ---------------------------------------------------------------------------

/**
 * Crea un nuevo chat en V0 y devuelve el chatId y la URL del prototipo.
 *
 * G-D2: assert budget BEFORE the v0 call, record cost AFTER. v0 does
 * not surface token counts, so we use the per-call flat estimate from
 * `lib/server/llm-pricing.ts` ("v0:default").
 */
export async function createV0Prototype(params: V0CreateParams): Promise<V0Result> {
  const { prompt, systemPrompt } = params;

  await assertBudgetAvailable();

  const result = await v0.chats.create({
    system: systemPrompt,
    message: prompt,
    responseMode: "async",
    modelConfiguration: {
      imageGenerations: false,
      thinking: false,
    },
  }) as { id?: string; latestVersion?: { demoUrl?: string } };

  await recordLLMCall({
    category: "v0_prototype_create",
    provider: "v0",
    model: "default",
    requestId: result?.id ?? null,
    metadata: {
      response_mode: "async",
    },
  });

  // Seen live 2026-07-14: the SDK can resolve without an id, and letting it
  // through crashed downstream with a raw TypeError. Throw a typed message so
  // the route's v0_create catch reverts the session and surfaces the retry copy.
  if (!result?.id) {
    throw new Error("v0 chats.create returned no chat id.");
  }

  return {
    chatId: result.id,
    demoUrl: result.latestVersion?.demoUrl ?? "",
  };
}

// ---------------------------------------------------------------------------
// V0 – Modificar prototipo existente
// ---------------------------------------------------------------------------

/**
 * Envia un mensaje a un chat de V0 ya existente para modificar el prototipo.
 *
 * G-D2: assert budget BEFORE the v0 call, record cost AFTER. Same
 * flat-per-call pricing as createV0Prototype.
 */
export async function updateV0Prototype(params: V0SendMessageParams): Promise<V0Result> {
  const { chatId, prompt } = params;

  await assertBudgetAvailable();

  const reply = await v0.chats.sendMessage({
    chatId,
    message: prompt,
    responseMode: "async",
  } as Parameters<typeof v0.chats.sendMessage>[0]) as { latestVersion?: { demoUrl?: string } };

  await recordLLMCall({
    category: "v0_prototype_update",
    provider: "v0",
    model: "default",
    requestId: chatId,
    metadata: {
      response_mode: "async",
    },
  });

  return {
    chatId,
    demoUrl: reply.latestVersion?.demoUrl ?? "",
  };
}

// ---------------------------------------------------------------------------
// V0 – Obtener estado de generación
// ---------------------------------------------------------------------------

export type V0StatusResult = {
  status: "pending" | "completed" | "failed";
  demoUrl?: string;
  versionId?: string;
  /**
   * Per-file source code of the generated prototype, as returned by the V0 SDK
   * (`latestVersion.files`). Captured so the poll endpoint can persist the code
   * on the studio_version and the share flow can forward it to App as
   * `prototype.generated_html` (the post-payment Opus pipeline reads it).
   * Structurally compatible with `V0SourceFile` in
   * `lib/maxwell/serialize-v0-source.ts` (kept inline to avoid coupling this
   * low-level integration module to lib/maxwell).
   */
  files?: { name: string; content: string }[];
};

/**
 * Consulta el estado actual de un chat/prototipo en V0
 */
export async function getV0PrototypeStatus(chatId: string): Promise<V0StatusResult> {
  try {
    const result = await v0.chats.getById({ chatId }) as {
      latestVersion?: {
        id?: string;
        status: "pending" | "completed" | "failed";
        demoUrl?: string;
        files?: { name?: string; content?: string }[];
      };
    };

    if (!result.latestVersion) {
      return { status: "pending" };
    }

    const files = Array.isArray(result.latestVersion.files)
      ? result.latestVersion.files
          .filter((f): f is { name: string; content: string } =>
            typeof f?.name === "string" && typeof f?.content === "string",
          )
          .map((f) => ({ name: f.name, content: f.content }))
      : undefined;

    return {
      status: result.latestVersion.status,
      demoUrl: result.latestVersion.demoUrl,
      versionId: result.latestVersion.id,
      ...(files && files.length > 0 ? { files } : {}),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    // V0 can be eventually consistent immediately after creation.
    if (message.includes("404") || message.includes("chat_not_found")) {
      return { status: "pending" };
    }
    throw error;
  }
}
