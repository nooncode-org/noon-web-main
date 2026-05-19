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
  } = params;

  if (!prompt && !imageUrl) {
    throw new Error("Se requiere al menos un prompt o imageUrl.");
  }

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

  return { reply };
}

// ---------------------------------------------------------------------------
// V0 – Crear prototipo nuevo
// ---------------------------------------------------------------------------

/**
 * Crea un nuevo chat en V0 y devuelve el chatId y la URL del prototipo.
 */
export async function createV0Prototype(params: V0CreateParams): Promise<V0Result> {
  const { prompt, systemPrompt } = params;

  const result = await v0.chats.create({
    system: systemPrompt,
    message: prompt,
    responseMode: "async",
    modelConfiguration: {
      imageGenerations: false,
      thinking: false,
    },
  }) as { id: string; latestVersion?: { demoUrl?: string } };

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
 */
export async function updateV0Prototype(params: V0SendMessageParams): Promise<V0Result> {
  const { chatId, prompt } = params;

  const reply = await v0.chats.sendMessage({
    chatId,
    message: prompt,
    responseMode: "async",
  } as Parameters<typeof v0.chats.sendMessage>[0]) as { latestVersion?: { demoUrl?: string } };

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
};

/**
 * Consulta el estado actual de un chat/prototipo en V0
 */
export async function getV0PrototypeStatus(chatId: string): Promise<V0StatusResult> {
  try {
    const result = await v0.chats.getById({ chatId }) as {
      latestVersion?: { id?: string; status: "pending" | "completed" | "failed"; demoUrl?: string };
    };
    
    if (!result.latestVersion) {
      return { status: "pending" };
    }

    return {
      status: result.latestVersion.status,
      demoUrl: result.latestVersion.demoUrl,
      versionId: result.latestVersion.id,
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
