/**
 * tests/maxwell/prototype-poll.test.ts
 *
 * End-to-end tests para `GET /api/maxwell/prototype/poll`.
 *
 * Repos, auth, helper de v0 (`getV0PrototypeStatus`) y `fetch` global
 * (usado por `isPreviewUrlReady`) van mockeados. La lógica del handler
 * (validación de query, gating, confirmation token, dedupe por URL/version,
 * persistencia de version, transiciones de estado) se ejercita real.
 *
 * Coverage matrix:
 *  - Query: faltan chatId/sessionId/action → 400
 *  - Boot: sin V0_API_KEY → 503
 *  - Auth: viewer ausente → 401; ownership fail → 403
 *  - Session: no encontrada → 404
 *  - v0 status: pending / failed / completed sin demoUrl
 *  - Confirmation token: primer poll completed devuelve token; segundo poll lo valida
 *  - Preview readiness: HTML 200 vs no-HTML / 404 / fetch error
 *  - Dedupe: action=update con URL/version previo igual; latestVersion ya commited
 *  - Persistencia: action=create commitea version + status prototype_ready
 *  - Persistencia: action=update commitea version + transición revision_applied → prototype_ready
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioSession, StudioVersion } from "@/lib/maxwell/repositories";

vi.mock("@/lib/api-ia", () => ({
  getV0PrototypeStatus: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedViewer: vi.fn(),
}));

vi.mock("@/lib/auth/ownership", () => ({
  viewerOwnsStudioSession: vi.fn(() => true),
}));

vi.mock("@/lib/maxwell/repositories", () => ({
  getStudioSession: vi.fn(),
  createStudioVersion: vi.fn(),
  getLatestStudioVersion: vi.fn(),
  updateStudioSessionStatus: vi.fn(),
  appendStudioMessage: vi.fn(),
}));

import * as apiIa from "@/lib/api-ia";
import * as authSession from "@/lib/auth/session";
import * as ownership from "@/lib/auth/ownership";
import * as repos from "@/lib/maxwell/repositories";
import { GET } from "@/app/api/maxwell/prototype/poll/route";
import {
  MAX_PROTOTYPE_POLL_ATTEMPTS,
  POLL_RESCUE_AFTER_ATTEMPTS,
} from "@/lib/maxwell/prototype-poll-policy";

const ROUTE_BASE = "http://localhost/api/maxwell/prototype/poll";

function buildUrl(params: Record<string, string | undefined>) {
  const url = new URL(ROUTE_BASE);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

function fakeSession(overrides: Partial<StudioSession> = {}): StudioSession {
  return {
    id: "session-1",
    initialPrompt: "Build a thing",
    status: "generating_prototype",
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
    prototypeWorkspaceId: null,
    shareToken: null,
    shareTokenUrl: null,
    prototypeSharedAt: null,
    ...overrides,
  };
}

function fakeVersion(overrides: Partial<StudioVersion> = {}): StudioVersion {
  return {
    id: "version-1",
    studioSessionId: "session-1",
    versionNumber: 1,
    previewUrl: "https://preview.v0.dev/p1?token=xyz",
    v0ChatId: "chat-1",
    changeSummary: null,
    source: "initial",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Stubs `globalThis.fetch` con una respuesta HTML 200 (preview "lista").
 * Devuelve el spy para assertions.
 */
function stubPreviewFetch(opts: {
  ok?: boolean;
  contentType?: string;
  status?: number;
  reject?: boolean;
} = {}) {
  const spy = vi.fn(async () => {
    if (opts.reject) throw new Error("network down");
    return {
      ok: opts.ok ?? true,
      status: opts.status ?? 200,
      headers: {
        get: (key: string) => (key.toLowerCase() === "content-type" ? (opts.contentType ?? "text/html; charset=utf-8") : null),
      },
    } as unknown as Response;
  });
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

const completionToken = (versionId: string, demoUrl: string) =>
  `${versionId}|${demoUrl.split("?")[0]}`;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("V0_API_KEY", "test-v0-key");
  vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue({
    email: "owner@noon.dev",
    name: "Owner",
    image: null,
  });
  vi.mocked(ownership.viewerOwnsStudioSession).mockReturnValue(true);
  vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());
  vi.mocked(repos.getLatestStudioVersion).mockResolvedValue(null);
  vi.mocked(repos.createStudioVersion).mockResolvedValue(fakeVersion());
  vi.mocked(repos.updateStudioSessionStatus).mockResolvedValue(fakeSession());
  vi.mocked(repos.appendStudioMessage).mockResolvedValue({
    id: "msg-1",
    studioSessionId: "session-1",
    role: "assistant",
    messageType: "prototype_announcement",
    content: "Prototype Version 1 generated.",
    createdAt: new Date().toISOString(),
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ============================================================================
// Validación de query
// ============================================================================

describe("prototype/poll — query validation", () => {
  it("400 cuando faltan los 3 params requeridos", async () => {
    const res = await GET(buildUrl({}));
    expect(res.status).toBe(400);
  });

  it("400 cuando falta solo chatId", async () => {
    const res = await GET(buildUrl({ session_id: "s", action: "create" }));
    expect(res.status).toBe(400);
  });

  it("400 cuando falta solo session_id", async () => {
    const res = await GET(buildUrl({ chatId: "c", action: "create" }));
    expect(res.status).toBe(400);
  });

  it("400 cuando falta solo action", async () => {
    const res = await GET(buildUrl({ chatId: "c", session_id: "s" }));
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// Boot / configuración
// ============================================================================

describe("prototype/poll — boot guard", () => {
  it("503 cuando V0_API_KEY no está configurado", async () => {
    vi.stubEnv("V0_API_KEY", "");
    const res = await GET(buildUrl({ chatId: "c", session_id: "s", action: "create" }));
    expect(res.status).toBe(503);
  });
});

// ============================================================================
// Auth & ownership
// ============================================================================

describe("prototype/poll — auth gating", () => {
  it("401 cuando no hay viewer autenticado", async () => {
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue(null);
    const res = await GET(buildUrl({ chatId: "c", session_id: "s", action: "create" }));
    expect(res.status).toBe(401);
  });

  it("404 cuando la sesión no existe", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(null);
    const res = await GET(buildUrl({ chatId: "c", session_id: "s", action: "create" }));
    expect(res.status).toBe(404);
  });

  it("403 cuando el viewer no es owner de la sesión", async () => {
    vi.mocked(ownership.viewerOwnsStudioSession).mockReturnValue(false);
    const res = await GET(buildUrl({ chatId: "c", session_id: "s", action: "create" }));
    expect(res.status).toBe(403);
  });
});

// ============================================================================
// v0 status: pending / failed
// ============================================================================

describe("prototype/poll — v0 status", () => {
  it("status=pending pasa-through sin tocar la sesión", async () => {
    vi.mocked(apiIa.getV0PrototypeStatus).mockResolvedValue({ status: "pending" });
    const res = await GET(buildUrl({ chatId: "c", session_id: "s", action: "create" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("pending");
    expect(repos.updateStudioSessionStatus).not.toHaveBeenCalled();
    expect(repos.createStudioVersion).not.toHaveBeenCalled();
  });

  it("status=failed revierte la sesión a 'clarifying'", async () => {
    vi.mocked(apiIa.getV0PrototypeStatus).mockResolvedValue({ status: "failed" });
    const res = await GET(buildUrl({ chatId: "c", session_id: "session-1", action: "create" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("failed");
    expect(repos.updateStudioSessionStatus).toHaveBeenCalledWith("session-1", "clarifying");
    expect(repos.createStudioVersion).not.toHaveBeenCalled();
  });

  it("status=completed sin demoUrl reverte y devuelve failed con mensaje", async () => {
    vi.mocked(apiIa.getV0PrototypeStatus).mockResolvedValue({
      status: "completed",
      versionId: "v-1",
      // demoUrl ausente
    });
    const res = await GET(buildUrl({ chatId: "c", session_id: "session-1", action: "create" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("failed");
    expect(body.message).toMatch(/demo url is missing/i);
    expect(repos.updateStudioSessionStatus).toHaveBeenCalledWith("session-1", "clarifying");
  });
});

// ============================================================================
// Confirmation token guard (anti-race)
// ============================================================================

describe("prototype/poll — confirmation token guard", () => {
  it("primer poll completed sin token devuelve completion_token y status=pending", async () => {
    const demoUrl = "https://preview.v0.dev/abc?token=xyz";
    vi.mocked(apiIa.getV0PrototypeStatus).mockResolvedValue({
      status: "completed",
      versionId: "v-1",
      demoUrl,
    });
    const res = await GET(buildUrl({ chatId: "c", session_id: "session-1", action: "create" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("pending");
    expect(body.completion_token).toBe(completionToken("v-1", demoUrl));
    // No debe persistir nada todavía
    expect(repos.createStudioVersion).not.toHaveBeenCalled();
    expect(repos.updateStudioSessionStatus).not.toHaveBeenCalled();
  });

  it("segundo poll con confirmation_token correcto procede a verificar preview", async () => {
    const demoUrl = "https://preview.v0.dev/abc?token=xyz";
    vi.mocked(apiIa.getV0PrototypeStatus).mockResolvedValue({
      status: "completed",
      versionId: "v-1",
      demoUrl,
    });
    stubPreviewFetch({ ok: true });

    const res = await GET(
      buildUrl({
        chatId: "c",
        session_id: "session-1",
        action: "create",
        confirmation_token: completionToken("v-1", demoUrl),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("completed");
    expect(repos.createStudioVersion).toHaveBeenCalled();
  });
});

// ============================================================================
// Preview readiness
// ============================================================================

describe("prototype/poll — preview readiness", () => {
  const demoUrl = "https://preview.v0.dev/abc?token=xyz";
  const baseArgs = {
    chatId: "c",
    session_id: "session-1",
    action: "create",
    confirmation_token: completionToken("v-1", demoUrl),
  };

  beforeEach(() => {
    vi.mocked(apiIa.getV0PrototypeStatus).mockResolvedValue({
      status: "completed",
      versionId: "v-1",
      demoUrl,
    });
  });

  it("preview no-HTML (text/plain) → status=pending y no commitea", async () => {
    stubPreviewFetch({ ok: true, contentType: "text/plain" });
    const res = await GET(buildUrl(baseArgs));
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("pending");
    expect(repos.createStudioVersion).not.toHaveBeenCalled();
  });

  it("preview HTTP 404 → status=pending", async () => {
    stubPreviewFetch({ ok: false, status: 404 });
    const res = await GET(buildUrl(baseArgs));
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("pending");
    expect(repos.createStudioVersion).not.toHaveBeenCalled();
  });

  it("preview fetch error (network) → status=pending sin lanzar 500", async () => {
    stubPreviewFetch({ reject: true });
    const res = await GET(buildUrl(baseArgs));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("pending");
    expect(repos.createStudioVersion).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Dedupe (action=update con URL/version anterior)
// ============================================================================

describe("prototype/poll — dedupe en update", () => {
  const demoUrl = "https://preview.v0.dev/abc?token=xyz";
  const token = completionToken("v-1", demoUrl);

  beforeEach(() => {
    vi.mocked(apiIa.getV0PrototypeStatus).mockResolvedValue({
      status: "completed",
      versionId: "v-1",
      demoUrl,
    });
    stubPreviewFetch({ ok: true });
  });

  it("update con previous_demo_url igual a demoUrl actual → pending (v0 aún no rotó)", async () => {
    const res = await GET(
      buildUrl({
        chatId: "c",
        session_id: "session-1",
        action: "update",
        previous_demo_url: "https://preview.v0.dev/abc?token=old",
        confirmation_token: token,
      }),
    );
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("pending");
    expect(repos.createStudioVersion).not.toHaveBeenCalled();
  });

  it("update con previous_version_id igual a versionId actual → pending", async () => {
    const res = await GET(
      buildUrl({
        chatId: "c",
        session_id: "session-1",
        action: "update",
        previous_version_id: "v-1",
        confirmation_token: token,
      }),
    );
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("pending");
    expect(repos.createStudioVersion).not.toHaveBeenCalled();
  });

  it("create con latestVersion.previewUrl ya igual al demoUrl → pending (dedupe DB)", async () => {
    vi.mocked(repos.getLatestStudioVersion).mockResolvedValue(
      fakeVersion({ previewUrl: demoUrl }),
    );
    const res = await GET(
      buildUrl({
        chatId: "c",
        session_id: "session-1",
        action: "create",
        confirmation_token: token,
      }),
    );
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("pending");
    expect(repos.createStudioVersion).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Persistencia happy path
// ============================================================================

describe("prototype/poll — persistencia happy path", () => {
  const demoUrl = "https://preview.v0.dev/abc?token=xyz";
  const token = completionToken("v-1", demoUrl);

  beforeEach(() => {
    vi.mocked(apiIa.getV0PrototypeStatus).mockResolvedValue({
      status: "completed",
      versionId: "v-1",
      demoUrl,
    });
    stubPreviewFetch({ ok: true });
  });

  it("action=create: commitea version, anuncia, transiciona a prototype_ready", async () => {
    vi.mocked(repos.createStudioVersion).mockResolvedValue(
      fakeVersion({ versionNumber: 1, source: "initial" }),
    );

    const res = await GET(
      buildUrl({
        chatId: "chat-1",
        session_id: "session-1",
        action: "create",
        confirmation_token: token,
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("completed");
    expect(body.session_status).toBe("prototype_ready");
    expect(body.version_number).toBe(1);

    expect(repos.createStudioVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        studioSessionId: "session-1",
        previewUrl: demoUrl,
        v0ChatId: "chat-1",
        source: "initial",
      }),
    );
    expect(repos.appendStudioMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageType: "prototype_announcement",
        role: "assistant",
      }),
    );
    expect(repos.updateStudioSessionStatus).toHaveBeenCalledWith(
      "session-1",
      "prototype_ready",
    );
  });

  it("action=update con prompt: persiste correction_request del usuario y dos transiciones", async () => {
    vi.mocked(repos.createStudioVersion).mockResolvedValue(
      fakeVersion({ versionNumber: 2, source: "correction", changeSummary: "Add hero" }),
    );

    const res = await GET(
      buildUrl({
        chatId: "chat-1",
        session_id: "session-1",
        action: "update",
        prompt: "Add hero",
        confirmation_token: token,
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("completed");
    expect(body.session_status).toBe("prototype_ready");
    expect(body.version_number).toBe(2);

    expect(repos.createStudioVersion).toHaveBeenCalledWith(
      expect.objectContaining({ source: "correction", changeSummary: "Add hero" }),
    );
    // El usuario debe ver su correction_request persistida
    expect(repos.appendStudioMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: "user", messageType: "correction_request", content: "Add hero" }),
    );
    // Doble transición: revision_applied → prototype_ready
    expect(repos.updateStudioSessionStatus).toHaveBeenCalledWith("session-1", "revision_applied");
    expect(repos.updateStudioSessionStatus).toHaveBeenCalledWith("session-1", "prototype_ready");
  });
});

// ============================================================================
// Acción desconocida
// ============================================================================

// ============================================================================
// Bounded loop — give up at the hard cap (revert + failed)
// ============================================================================

describe("prototype/poll — give up at the poll budget cap", () => {
  it("create: attempt en el cap con v0 pending → failed POLL_TIMEOUT + revierte a clarifying", async () => {
    vi.mocked(apiIa.getV0PrototypeStatus).mockResolvedValue({ status: "pending" });
    const res = await GET(
      buildUrl({
        chatId: "c",
        session_id: "session-1",
        action: "create",
        attempt: String(MAX_PROTOTYPE_POLL_ATTEMPTS),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("failed");
    expect(body.code).toBe("POLL_TIMEOUT");
    expect(repos.updateStudioSessionStatus).toHaveBeenCalledWith("session-1", "clarifying");
    expect(repos.createStudioVersion).not.toHaveBeenCalled();
  });

  it("update: attempt sobre el cap → failed + revierte revision_requested a prototype_ready", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(
      fakeSession({ status: "revision_requested" }),
    );
    vi.mocked(apiIa.getV0PrototypeStatus).mockResolvedValue({ status: "pending" });
    const res = await GET(
      buildUrl({
        chatId: "c",
        session_id: "session-1",
        action: "update",
        attempt: String(MAX_PROTOTYPE_POLL_ATTEMPTS + 5),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("failed");
    expect(body.code).toBe("POLL_TIMEOUT");
    expect(repos.updateStudioSessionStatus).toHaveBeenCalledWith("session-1", "prototype_ready");
    expect(repos.createStudioVersion).not.toHaveBeenCalled();
  });

  it("no se rinde antes del cap (attempt-1 con pending → pending normal)", async () => {
    vi.mocked(apiIa.getV0PrototypeStatus).mockResolvedValue({ status: "pending" });
    const res = await GET(
      buildUrl({
        chatId: "c",
        session_id: "session-1",
        action: "create",
        attempt: String(MAX_PROTOTYPE_POLL_ATTEMPTS - 1),
      }),
    );
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("pending");
    expect(repos.updateStudioSessionStatus).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Bounded loop — rescue an unstable-signature completion
// ============================================================================

describe("prototype/poll — rescue de firma inestable", () => {
  const demoUrl = "https://preview.v0.dev/abc?token=xyz";
  const staleToken = "old-version|https://preview.v0.dev/old";

  beforeEach(() => {
    vi.mocked(apiIa.getV0PrototypeStatus).mockResolvedValue({
      status: "completed",
      versionId: "v-1",
      demoUrl,
    });
    stubPreviewFetch({ ok: true });
  });

  it("completed con token desfasado por debajo del umbral → sigue pending (espera estabilización)", async () => {
    const res = await GET(
      buildUrl({
        chatId: "c",
        session_id: "session-1",
        action: "create",
        confirmation_token: staleToken,
        attempt: String(POLL_RESCUE_AFTER_ATTEMPTS - 1),
      }),
    );
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("pending");
    expect(repos.createStudioVersion).not.toHaveBeenCalled();
  });

  it("completed con token desfasado en el umbral + preview lista → commitea igual (rescate)", async () => {
    const res = await GET(
      buildUrl({
        chatId: "chat-1",
        session_id: "session-1",
        action: "create",
        confirmation_token: staleToken,
        attempt: String(POLL_RESCUE_AFTER_ATTEMPTS),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("completed");
    expect(repos.createStudioVersion).toHaveBeenCalled();
    expect(repos.updateStudioSessionStatus).toHaveBeenCalledWith("session-1", "prototype_ready");
  });

  it("rescate sigue exigiendo preview lista (no commitea URL fría)", async () => {
    stubPreviewFetch({ ok: false, status: 404 });
    const res = await GET(
      buildUrl({
        chatId: "c",
        session_id: "session-1",
        action: "create",
        confirmation_token: staleToken,
        attempt: String(POLL_RESCUE_AFTER_ATTEMPTS),
      }),
    );
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("pending");
    expect(repos.createStudioVersion).not.toHaveBeenCalled();
  });
});

describe("prototype/poll — acción desconocida", () => {
  it("action no soportada con status completed cae al 'unknown' final", async () => {
    const demoUrl = "https://preview.v0.dev/abc?token=xyz";
    vi.mocked(apiIa.getV0PrototypeStatus).mockResolvedValue({
      status: "completed",
      versionId: "v-1",
      demoUrl,
    });
    stubPreviewFetch({ ok: true });

    const res = await GET(
      buildUrl({
        chatId: "c",
        session_id: "session-1",
        action: "delete-everything",
        confirmation_token: completionToken("v-1", demoUrl),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("unknown");
  });
});

