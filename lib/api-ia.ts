/**
 * lib/api-ia.ts
 * Integraciones reutilizables de IA: OpenAI (gpt-4.1) y V0 (v0-sdk v0.16)
 *
 * Variables de entorno requeridas:
 *   OPENAI_API_KEY   – clave de OpenAI
 *   V0_API_KEY       – clave de V0 (se configura globalmente en v0-sdk)
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
  /** Modelo a usar (default: gpt-4.1) */
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

// `DEFAULT_V0_SYSTEM` was removed in the Bloque 11 follow-up. It always
// hardcoded single-view landing pages, which contradicts the Quality Layer
// (lib/maxwell/prototype-brief.ts) that adapts the prompt to the actual
// projectType. `V0CreateParams.systemPrompt` is now required so any future
// caller has to pass V0_PROTOTYPE_SYSTEM_PROMPT (or another deliberate
// alternative) — a missing system prompt is a compile error, not a silent
// landing-page surprise.

/**
 * Llama a OpenAI GPT-4.1 con soporte de texto, imagen e historial.
 */
export async function chatWithOpenAI(params: OpenAIParams): Promise<OpenAIResult> {
  const { prompt, imageUrl, history = [], systemPrompt, model = "gpt-4.1", signal } = params;

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
