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
  // Fase A · E2.3 — the staged script (real text lives in prompts.ts; here
  // it is a marker so the tests assert WHICH appendix the route chose).
  MAXWELL_CHAT_STAGE_SCRIPT_APPENDIX: "\nSTAGE_SCRIPT",
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
  setStudioDirection: vi.fn(async () => undefined),
}));

// Fase A · E2.4 — reading the client's own attached reference.
vi.mock("@/lib/maxwell/client-reference", () => ({
  readClientReference: vi.fn(),
}));

// Fase A · E3.5 — the client pasting a LINK as their reference.
vi.mock("@/lib/maxwell/client-reference-guard", () => ({
  guardClientReferenceUrl: vi.fn(),
}));
vi.mock("@/lib/maxwell/reference-study/study", () => ({
  studyReference: vi.fn(),
}));

import * as apiIa from "@/lib/api-ia";
import * as authSession from "@/lib/auth/session";
import * as ownership from "@/lib/auth/ownership";
import * as repos from "@/lib/maxwell/repositories";
import * as clientReference from "@/lib/maxwell/client-reference";
import { guardClientReferenceUrl } from "@/lib/maxwell/client-reference-guard";
import { studyReference } from "@/lib/maxwell/reference-study/study";
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
    stylePackId: null,
    direction: null,
    prototypeWorkspaceId: null,
    shareToken: null,
    shareTokenUrl: null,
    prototypeSharedAt: null,
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
        "[PROJECT_TYPE: landing] [COMPLEXITY: medio] Vamos.",
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
      projectType: "landing",
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

// ============================================================================
// Fase A · E2.3 — the staged script rides on the brain flag
// ============================================================================

describe("chat — staged script (Fase A flag)", () => {
  it("with the brain OFF the system prompt is untouched (today's Maxwell)", async () => {
    await POST(postReq({ message: "hola", session_id: "session-1" }));

    const call = vi.mocked(apiIa.chatWithOpenAI).mock.calls[0][0];
    expect(call.systemPrompt).toBe("SYSTEM");
  });

  it("with the brain ON Maxwell gets the staged script", async () => {
    vi.stubEnv("MAXWELL_BRAIN_ENABLED", "1");

    await POST(postReq({ message: "hola", session_id: "session-1" }));

    const call = vi.mocked(apiIa.chatWithOpenAI).mock.calls[0][0];
    expect(call.systemPrompt).toBe("SYSTEM\nSTAGE_SCRIPT");
  });

  it("post-proposal sessions keep their own appendix, not the script", async () => {
    vi.stubEnv("MAXWELL_BRAIN_ENABLED", "1");
    vi.mocked(repos.getStudioSession).mockResolvedValue(
      fakeSession({ status: "proposal_sent" }),
    );

    await POST(postReq({ message: "hola", session_id: "session-1" }));

    const call = vi.mocked(apiIa.chatWithOpenAI).mock.calls[0][0];
    expect(call.systemPrompt).toBe("SYSTEM\nAPPENDIX");
  });
});

// The real script's load-bearing promises, pinned against the actual text:
// references optional, and the hurried client is never sent back through
// the stages (owner rules, docs/maxwell/fase-a-spec.md §1).
describe("staged script content", () => {
  it("keeps references optional and never rewinds the hurried client", async () => {
    const prompts = await vi.importActual<typeof import("@/lib/maxwell/prompts")>(
      "@/lib/maxwell/prompts",
    );
    const script = prompts.MAXWELL_CHAT_STAGE_SCRIPT_APPENDIX;

    expect(script).toContain("Session mode: staged discovery");
    expect(script).toContain("The script sets the ORDER; the client sets the PACE");
    expect(script).toContain("they can skip this");
    expect(script).toContain("It does NOT have to be a website");
    expect(script).toContain("do NOT send them back through the stages");
  });
});

// ============================================================================
// Fase A · E2.4 — the client's OWN reference, attached in the chat
// ============================================================================

describe("chat — client's own reference (Fase A flag)", () => {
  const reading = {
    understood: "Veo que buscas tonos cálidos y un aire artesanal.",
    palette: ["#8a6f4d"],
    styleNotes: ["madera clara"],
    notCovered: ["estructura de secciones"],
    usable: true,
  };

  function attachReq() {
    return postReq({
      message: "esta es mi referencia",
      session_id: "session-1",
      image_url: "https://cdn.example/ref.jpg",
    });
  }

  it("with the brain OFF an attachment is never analyzed (today's behaviour)", async () => {
    await POST(attachReq());

    expect(clientReference.readClientReference).not.toHaveBeenCalled();
    expect(repos.setStudioDirection).not.toHaveBeenCalled();
    const call = vi.mocked(apiIa.chatWithOpenAI).mock.calls[0][0];
    expect(call.prompt).not.toContain("INTERNAL");
  });

  it("reads it, stores it as THEIR direction, and asks them to confirm", async () => {
    vi.stubEnv("MAXWELL_BRAIN_ENABLED", "1");
    vi.mocked(clientReference.readClientReference).mockResolvedValue(reading);

    await POST(attachReq());

    // Provisional: confirmedAt null until they say yes.
    expect(repos.setStudioDirection).toHaveBeenCalledWith(
      "session-1",
      expect.objectContaining({ source: "client_images", confirmedAt: null, reading }),
    );

    const call = vi.mocked(apiIa.chatWithOpenAI).mock.calls[0][0];
    expect(call.prompt).toContain(reading.understood);
    expect(call.prompt).toContain("ask if that is right");
    // Owner's rule: a readable image is never sent back for a better one.
    expect(call.prompt).toContain("never ask for a better one");
  });

  it("when it cannot be read at all, Maxwell climbs the gentle ladder", async () => {
    vi.stubEnv("MAXWELL_BRAIN_ENABLED", "1");
    vi.mocked(clientReference.readClientReference).mockResolvedValue({
      ...reading,
      usable: false,
    });

    await POST(attachReq());

    // Nothing is stored from an unreadable reference.
    expect(repos.setStudioDirection).not.toHaveBeenCalled();
    const call = vi.mocked(apiIa.chatWithOpenAI).mock.calls[0][0];
    expect(call.prompt).toContain("higher-quality version");
    expect(call.prompt).toContain("last resort");
    expect(call.prompt).toContain("never blaming them");
  });
});

describe("chat — one-tap reference answers (E2.4)", () => {
  it("strips the token and returns the three labels in the session's language", async () => {
    vi.stubEnv("MAXWELL_BRAIN_ENABLED", "1");
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession({ language: "es" }));
    vi.mocked(apiIa.chatWithOpenAI).mockResolvedValue({
      reply: "¿Tienes alguna referencia que te guste? [REFERENCE_OPTIONS]",
    });

    const res = await POST(postReq({ message: "hola", session_id: "session-1" }));
    const json = await res.json();

    // The token never reaches the client.
    expect(json.reply).not.toContain("REFERENCE_OPTIONS");
    expect(json.reply).toContain("¿Tienes alguna referencia");
    expect(json.reference_options).toEqual({
      hasMine: "Tengo mi referencia",
      chooseForMe: "Busquen ustedes",
      skip: "Omitir",
    });
  });

  it("is null on any other message", async () => {
    vi.stubEnv("MAXWELL_BRAIN_ENABLED", "1");
    const res = await POST(postReq({ message: "hola", session_id: "session-1" }));
    expect((await res.json()).reference_options).toBeNull();
  });
});

describe("chat — up to 3 images of ONE reference (E2.4)", () => {
  it("merges singular + array, caps at 3, and hands them ALL to the reader", async () => {
    vi.stubEnv("MAXWELL_BRAIN_ENABLED", "1");
    vi.mocked(clientReference.readClientReference).mockResolvedValue({
      understood: "Tonos cálidos.",
      palette: [],
      styleNotes: [],
      notCovered: [],
      usable: true,
    });

    await POST(
      postReq({
        message: "mi referencia",
        session_id: "session-1",
        image_url: "https://cdn.example/a.jpg",
        image_urls: ["https://cdn.example/b.jpg", "https://cdn.example/c.jpg"],
      }),
    );

    expect(clientReference.readClientReference).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrls: [
          "https://cdn.example/a.jpg",
          "https://cdn.example/b.jpg",
          "https://cdn.example/c.jpg",
        ],
      }),
    );
    // Maxwell sees every image too, not just the first.
    expect(vi.mocked(apiIa.chatWithOpenAI).mock.calls[0][0].imageUrls).toHaveLength(3);
  });

  it("refuses more than 3 images", async () => {
    const res = await POST(
      postReq({
        message: "x",
        session_id: "session-1",
        image_urls: ["https://a.example/1.jpg", "https://a.example/2.jpg", "https://a.example/3.jpg", "https://a.example/4.jpg"],
      }),
    );
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// Fase A · E3.5 — the client pastes a LINK as their reference
// ============================================================================

describe("chat — client's reference URL (Fase A flag)", () => {
  const dossier = {
    judged: {
      heroRecipe: "full-bleed photo, headline 85px overlaid",
      whyItWorks: ["one brown carries the brand", "two lines answer what+where"],
    },
  };

  function linkReq() {
    return postReq({
      message: "me gusta esta: https://poilane.example/menu",
      session_id: "session-1",
    });
  }

  it("with the brain OFF a pasted link is just text (no guard, no study)", async () => {
    await POST(linkReq());

    expect(guardClientReferenceUrl).not.toHaveBeenCalled();
    expect(studyReference).not.toHaveBeenCalled();
  });

  it("guards the URL before any browser opens it, studies it, and confirms", async () => {
    vi.stubEnv("MAXWELL_BRAIN_ENABLED", "1");
    vi.mocked(guardClientReferenceUrl).mockResolvedValue({
      ok: true,
      url: "https://poilane.example/menu",
    });
    vi.mocked(studyReference).mockResolvedValue({
      dossier: dossier as never,
      source: "fresh",
      stale: false,
    });

    await POST(linkReq());

    // The guard runs FIRST — the study only sees a URL it approved.
    expect(guardClientReferenceUrl).toHaveBeenCalledWith("https://poilane.example/menu");
    expect(studyReference).toHaveBeenCalledWith("https://poilane.example/menu");
    expect(repos.setStudioDirection).toHaveBeenCalledWith(
      "session-1",
      expect.objectContaining({ source: "client_url", confirmedAt: null }),
    );

    const call = vi.mocked(apiIa.chatWithOpenAI).mock.calls[0][0];
    expect(call.prompt).toContain("ask if that is right");
    expect(call.prompt).toContain("their CURRENT site or a page they admire");
  });

  it("a refused URL never reaches the study, and the client is told plainly", async () => {
    vi.stubEnv("MAXWELL_BRAIN_ENABLED", "1");
    vi.mocked(guardClientReferenceUrl).mockResolvedValue({ ok: false, reason: "private" });

    await POST(linkReq());

    expect(studyReference).not.toHaveBeenCalled();
    expect(repos.setStudioDirection).not.toHaveBeenCalled();
    const call = vi.mocked(apiIa.chatWithOpenAI).mock.calls[0][0];
    expect(call.prompt).toContain("could not open");
    expect(call.prompt).toContain("Do not mention any technical reason");
  });

  it("does not re-study once a direction exists (one study per session)", async () => {
    vi.stubEnv("MAXWELL_BRAIN_ENABLED", "1");
    vi.mocked(repos.getStudioSession).mockResolvedValue(
      fakeSession({
        direction: { primaryUrl: "https://x.example", source: "pool", confirmedAt: null },
      }),
    );

    await POST(linkReq());

    expect(guardClientReferenceUrl).not.toHaveBeenCalled();
    expect(studyReference).not.toHaveBeenCalled();
  });
});
