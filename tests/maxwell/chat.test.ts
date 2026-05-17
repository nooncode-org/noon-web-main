/**
 * tests/maxwell/chat.test.ts
 *
 * End-to-end tests para `POST /api/maxwell/chat`.
 *
 * `chatWithOpenAI`, auth, ownership, prompts y los repositorios de Maxwell
 * van mockeados. La validación Zod, los rebounds de estado, los guards
 * (`canReceiveMessage`), la extracción de signals (`[READY_FOR_PROTOTYPE]`,
 * `[PROJECT_NAME:…]`, `[PROJECT_TYPE:…]`, `[COMPLEXITY:…]`, `<think>…</think>`)
 * y los flujos reply/regenerate se ejercitan reales.
 *
 * Coverage matrix:
 *  - Zod: ni message ni prompt → 400; reply_to + regenerate juntos → 400; image_url no-URL → 400
 *  - Boot: sin OPENAI_API_KEY → 503
 *  - Auth: viewer ausente → 401
 *  - Session existente: no encontrada → 404; ownership fail → 403
 *  - Estado: rebound generating_prototype → clarifying; rebound revision_requested → prototype_ready
 *  - Estado: !canReceiveMessage (converted) → 409
 *  - Sesión nueva (sin session_id): se crea
 *  - reply_to: target inexistente → 404; target no-assistant o no-chat → 400; happy path inyecta contexto
 *  - regenerate: target inexistente → 404; target no es el último assistant chat → 409; happy path NO añade userMessage
 *  - Signals: readyForPrototype + projectName/Type/Complexity persistidos; <think> persiste mensaje thinking
 *  - Resiliencia: DB connectivity error → 503; AbortError-like → 499
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimitForTests } from "@/lib/server/rate-limit";
import type { StudioMessage, StudioSession } from "@/lib/maxwell/repositories";

vi.mock("@/lib/api-ia", () => ({
  chatWithOpenAI: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedViewer: vi.fn(),
}));

vi.mock("@/lib/auth/ownership", () => ({
  viewerOwnsStudioSession: vi.fn(() => true),
}));

vi.mock("@/lib/maxwell/prompts", () => ({
  MAXWELL_CHAT_SYSTEM_PROMPT: "SYSTEM",
  MAXWELL_CHAT_POST_PROPOSAL_APPENDIX: "\nAPPENDIX",
}));

vi.mock("@/lib/maxwell/repositories", () => ({
  createStudioSession: vi.fn(),
  getStudioSession: vi.fn(),
  updateStudioSessionStatus: vi.fn(),
  appendStudioMessage: vi.fn(),
  getStudioMessagesForOpenAI: vi.fn(async () => []),
  getStudioMessage: vi.fn(),
  getStudioMessages: vi.fn(async () => []),
  appendStudioEvent: vi.fn(async () => undefined),
}));

import * as apiIa from "@/lib/api-ia";
import * as authSession from "@/lib/auth/session";
import * as ownership from "@/lib/auth/ownership";
import * as repos from "@/lib/maxwell/repositories";
import { POST } from "@/app/api/maxwell/chat/route";

const ROUTE = "http://localhost/api/maxwell/chat";

function fakeSession(overrides: Partial<StudioSession> = {}): StudioSession {
  return {
    id: "session-1",
    initialPrompt: "Build a thing",
    status: "clarifying",
    ownerEmail: "owner@noon.dev",
    ownerName: "Owner",
    ownerImage: null,
    projectType: null,
    goalSummary: null,
    complexityHint: null,
    language: "en",
    correctionsUsed: 0,
    maxCorrections: 2,
    proposalRequestedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function fakeMessage(overrides: Partial<StudioMessage> = {}): StudioMessage {
  return {
    id: "msg-1",
    studioSessionId: "session-1",
    role: "assistant",
    messageType: "chat",
    content: "Hi there",
    createdAt: new Date().toISOString(),
    feedback: null,
    ...overrides,
  };
}

function postReq(body: unknown) {
  return new Request(ROUTE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
  // Reset the in-process rate-limit buckets so chat tests do not share state with the
  // global limiter (each chat test issues its own POST and the "anonymous" identity is
  // shared across the whole file). See lib/server/rate-limit.ts for the helper.
  __resetRateLimitForTests();

  vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue({
    email: "owner@noon.dev",
    name: "Owner",
    image: null,
  });
  vi.mocked(ownership.viewerOwnsStudioSession).mockReturnValue(true);

  // Default: session existe en estado clarifying
  vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());
  vi.mocked(repos.updateStudioSessionStatus).mockImplementation(
    async (_id, status, patch) => fakeSession({ status, ...(patch as Partial<StudioSession>) }),
  );
  vi.mocked(repos.appendStudioMessage).mockImplementation(async (input) =>
    fakeMessage({
      id: `msg-${Math.random().toString(36).slice(2, 8)}`,
      role: input.role,
      messageType: input.messageType,
      content: input.content,
      studioSessionId: input.studioSessionId,
    }),
  );

  // Default reply de Maxwell sin signals
  vi.mocked(apiIa.chatWithOpenAI).mockResolvedValue({ reply: "Sounds good." });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ============================================================================
// Zod validation
// ============================================================================

describe("chat — Zod validation", () => {
  it("400 cuando ni message ni prompt están presentes", async () => {
    const res = await POST(postReq({ session_id: "s1" }));
    expect(res.status).toBe(400);
  });

  it("400 cuando reply_to_message_id y regenerate_assistant_message_id van juntos", async () => {
    const res = await POST(postReq({
      message: "hola",
      reply_to_message_id: "m1",
      regenerate_assistant_message_id: "m2",
    }));
    expect(res.status).toBe(400);
  });

  it("400 cuando image_url no es URL válida", async () => {
    const res = await POST(postReq({ message: "hola", image_url: "not-a-url" }));
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// Boot / auth
// ============================================================================

describe("chat — boot & auth", () => {
  it("503 cuando OPENAI_API_KEY no está configurada", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const res = await POST(postReq({ message: "hola" }));
    expect(res.status).toBe(503);
  });

  it("401 cuando no hay viewer autenticado", async () => {
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue(null);
    const res = await POST(postReq({ message: "hola" }));
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// Session existente
// ============================================================================

describe("chat — session existente", () => {
  it("404 cuando session_id no se encuentra", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(null);
    const res = await POST(postReq({ message: "hola", session_id: "missing" }));
    expect(res.status).toBe(404);
  });

  it("403 cuando el viewer no es owner", async () => {
    vi.mocked(ownership.viewerOwnsStudioSession).mockReturnValue(false);
    const res = await POST(postReq({ message: "hola", session_id: "session-1" }));
    expect(res.status).toBe(403);
  });
});

// ============================================================================
// Sesión nueva
// ============================================================================

describe("chat — sesión nueva", () => {
  it("crea sesión cuando no se envía session_id", async () => {
    vi.mocked(repos.createStudioSession).mockResolvedValue(fakeSession({ status: "intake" }));

    const res = await POST(postReq({ message: "Quiero una landing" }));
    expect(res.status).toBe(200);
    expect(repos.createStudioSession).toHaveBeenCalledWith(
      expect.objectContaining({
        initialPrompt: "Quiero una landing",
        ownerEmail: "owner@noon.dev",
      }),
    );
    // intake debe transicionar a clarifying
    expect(repos.updateStudioSessionStatus).toHaveBeenCalledWith("session-1", "clarifying");
  });

  it("acepta el alias 'prompt' en lugar de 'message'", async () => {
    vi.mocked(repos.createStudioSession).mockResolvedValue(fakeSession({ status: "intake" }));
    const res = await POST(postReq({ prompt: "Quiero una app" }));
    expect(res.status).toBe(200);
    expect(repos.createStudioSession).toHaveBeenCalledWith(
      expect.objectContaining({ initialPrompt: "Quiero una app" }),
    );
  });
});

// ============================================================================
// Rebounds de estado y canReceiveMessage
// ============================================================================

describe("chat — rebounds de estado", () => {
  it("rebota generating_prototype → clarifying antes de aceptar el mensaje", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(
      fakeSession({ status: "generating_prototype" }),
    );
    const res = await POST(postReq({ message: "hola", session_id: "session-1" }));
    expect(res.status).toBe(200);
    expect(repos.updateStudioSessionStatus).toHaveBeenCalledWith("session-1", "clarifying");
  });

  it("rebota revision_requested → prototype_ready antes de aceptar el mensaje", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(
      fakeSession({ status: "revision_requested" }),
    );
    const res = await POST(postReq({ message: "hola", session_id: "session-1" }));
    expect(res.status).toBe(200);
    expect(repos.updateStudioSessionStatus).toHaveBeenCalledWith("session-1", "prototype_ready");
  });

  it("409 cuando la sesión está en un estado terminal (converted)", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(
      fakeSession({ status: "converted" }),
    );
    const res = await POST(postReq({ message: "hola", session_id: "session-1" }));
    expect(res.status).toBe(409);
  });
});

// ============================================================================
// reply_to_message_id
// ============================================================================

describe("chat — reply_to_message_id", () => {
  it("404 cuando el reply target no existe", async () => {
    vi.mocked(repos.getStudioMessage).mockResolvedValue(null);
    const res = await POST(postReq({
      message: "hola",
      session_id: "session-1",
      reply_to_message_id: "missing",
    }));
    expect(res.status).toBe(404);
  });

  it("404 cuando el reply target pertenece a otra sesión", async () => {
    vi.mocked(repos.getStudioMessage).mockResolvedValue(
      fakeMessage({ studioSessionId: "OTHER" }),
    );
    const res = await POST(postReq({
      message: "hola",
      session_id: "session-1",
      reply_to_message_id: "msg-x",
    }));
    expect(res.status).toBe(404);
  });

  it("400 cuando el reply target no es assistant chat", async () => {
    vi.mocked(repos.getStudioMessage).mockResolvedValue(
      fakeMessage({ role: "user", messageType: "chat" }),
    );
    const res = await POST(postReq({
      message: "hola",
      session_id: "session-1",
      reply_to_message_id: "msg-x",
    }));
    expect(res.status).toBe(400);
  });

  it("happy path: inyecta el contexto del reply en el prompt enviado a OpenAI", async () => {
    vi.mocked(repos.getStudioMessage).mockResolvedValue(
      fakeMessage({ id: "msg-x", role: "assistant", messageType: "chat", content: "Mensaje previo" }),
    );

    await POST(postReq({
      message: "Mi pregunta",
      session_id: "session-1",
      reply_to_message_id: "msg-x",
    }));

    expect(apiIa.chatWithOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Mensaje previo"),
      }),
    );
  });
});

// ============================================================================
// regenerate_assistant_message_id
// ============================================================================

describe("chat — regenerate_assistant_message_id", () => {
  it("404 cuando el target no existe", async () => {
    vi.mocked(repos.getStudioMessage).mockResolvedValue(null);
    const res = await POST(postReq({
      message: "hola",
      session_id: "session-1",
      regenerate_assistant_message_id: "missing",
    }));
    expect(res.status).toBe(404);
  });

  it("400 cuando el target no es assistant chat", async () => {
    vi.mocked(repos.getStudioMessage).mockResolvedValue(
      fakeMessage({ role: "assistant", messageType: "thinking" }),
    );
    const res = await POST(postReq({
      message: "hola",
      session_id: "session-1",
      regenerate_assistant_message_id: "msg-x",
    }));
    expect(res.status).toBe(400);
  });

  it("409 cuando el target no es el último assistant chat", async () => {
    const target = fakeMessage({ id: "msg-x", role: "assistant", messageType: "chat" });
    const newer = fakeMessage({ id: "msg-y", role: "assistant", messageType: "chat" });
    vi.mocked(repos.getStudioMessage).mockResolvedValue(target);
    vi.mocked(repos.getStudioMessages).mockResolvedValue([target, newer]);

    const res = await POST(postReq({
      message: "redo",
      session_id: "session-1",
      regenerate_assistant_message_id: "msg-x",
    }));
    expect(res.status).toBe(409);
  });

  it("happy path: NO crea userMessage nuevo y registra evento message_regenerated", async () => {
    const target = fakeMessage({ id: "msg-x", role: "assistant", messageType: "chat", content: "old" });
    const userBefore = fakeMessage({ id: "msg-u", role: "user", messageType: "chat", content: "ask" });
    vi.mocked(repos.getStudioMessage).mockResolvedValue(target);
    vi.mocked(repos.getStudioMessages).mockResolvedValue([userBefore, target]); // target is last assistant chat

    const res = await POST(postReq({
      message: "redo",
      session_id: "session-1",
      regenerate_assistant_message_id: "msg-x",
    }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    // No user_message en la respuesta cuando es regenerate
    expect(body.user_message).toBeUndefined();

    // Solo se persiste el assistant nuevo (no un nuevo "user" message)
    const userAppendCalls = vi
      .mocked(repos.appendStudioMessage)
      .mock.calls.filter(([arg]) => arg.role === "user");
    expect(userAppendCalls).toHaveLength(0);

    expect(repos.appendStudioEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "message_regenerated" }),
    );
  });
});

// ============================================================================
// Extracción de signals
// ============================================================================

describe("chat — extracción de signals", () => {
  it("limpia y persiste señales [READY_FOR_PROTOTYPE]/[PROJECT_NAME]/[PROJECT_TYPE]/[COMPLEXITY]", async () => {
    vi.mocked(apiIa.chatWithOpenAI).mockResolvedValue({
      reply:
        "Listo. [READY_FOR_PROTOTYPE] [PROJECT_NAME: Noon Landing] " +
        "[PROJECT_TYPE: web_landing] [COMPLEXITY: medio] Vamos.",
    });

    const res = await POST(postReq({ message: "go", session_id: "session-1" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;

    // El reply en respuesta no debe contener los tokens
    expect(body.reply).not.toMatch(/READY_FOR_PROTOTYPE|PROJECT_NAME|PROJECT_TYPE|COMPLEXITY/);
    expect(body.readyForPrototype).toBe(true);

    // updateStudioSessionStatus debe haber recibido goalSummary/projectType/complexityHint
    const calls = vi.mocked(repos.updateStudioSessionStatus).mock.calls;
    const sessionUpdateCall = calls.find(
      ([, , patch]) => patch && Object.keys(patch).length > 0,
    );
    expect(sessionUpdateCall).toBeDefined();
    expect(sessionUpdateCall![2]).toMatchObject({
      goalSummary: "Noon Landing",
      projectType: "web_landing",
      complexityHint: "medio",
    });

    // Y la transición final a generating_prototype
    expect(repos.updateStudioSessionStatus).toHaveBeenCalledWith(
      "session-1",
      "generating_prototype",
    );
  });

  it("persiste un mensaje 'thinking' separado cuando hay <think>...</think>", async () => {
    vi.mocked(apiIa.chatWithOpenAI).mockResolvedValue({
      reply: "<think>razonando interno</think>Respuesta visible.",
    });

    const res = await POST(postReq({ message: "hola", session_id: "session-1" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.thinking).toBe("razonando interno");
    expect(body.reply).toBe("Respuesta visible.");

    // Debió persistirse un assistant/thinking + un assistant/chat
    const messageTypes = vi
      .mocked(repos.appendStudioMessage)
      .mock.calls.map(([arg]) => arg.messageType);
    expect(messageTypes).toContain("thinking");
    expect(messageTypes).toContain("chat");
  });

  it("usa el system prompt extendido cuando la sesión está post-propuesta (proposal_sent)", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(
      fakeSession({ status: "proposal_sent" }),
    );

    await POST(postReq({ message: "consulta post-propuesta", session_id: "session-1" }));

    expect(apiIa.chatWithOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("APPENDIX"),
      }),
    );
  });
});

// ============================================================================
// Resiliencia: DB / abort
// ============================================================================

describe("chat — resiliencia", () => {
  it("503 con code DB_CONNECTIVITY_ERROR cuando un repo lanza ETIMEDOUT", async () => {
    const dbErr = Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" });
    vi.mocked(repos.appendStudioMessage).mockRejectedValueOnce(dbErr);

    const res = await POST(postReq({ message: "hola", session_id: "session-1" }));
    expect(res.status).toBe(503);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.code).toBe("DB_CONNECTIVITY_ERROR");
  });

  it("499 cuando chatWithOpenAI lanza un AbortError-like", async () => {
    const abortErr = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.mocked(apiIa.chatWithOpenAI).mockRejectedValueOnce(abortErr);

    const res = await POST(postReq({ message: "hola", session_id: "session-1" }));
    expect(res.status).toBe(499);
  });

  it("500 genérico cuando chatWithOpenAI lanza un error desconocido", async () => {
    vi.mocked(apiIa.chatWithOpenAI).mockRejectedValueOnce(new Error("openai down"));

    const res = await POST(postReq({ message: "hola", session_id: "session-1" }));
    expect(res.status).toBe(500);
  });
});
