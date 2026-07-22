/**
 * tests/maxwell/workspace-page.test.tsx
 *
 * Integration coverage for the client portal PAGE itself — the decisions that
 * live nowhere else: which pre-workspace screen a client lands on, which tabs
 * exist, what the chat is allowed to do, and when the review/dunning banners
 * appear.
 *
 * There is no database locally, so this is how the portal is verified without
 * waiting for a real paying client to exist. The page is an async Server
 * Component: we call it as a function and inspect the element tree it returns.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

const h = vi.hoisted(() => ({
  authMock: vi.fn(),
  ownsMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFoundMock: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  getStudioSessionMock: vi.fn(),
  getWorkspaceMock: vi.fn(),
  getCommentsMock: vi.fn(),
  getRequestsMock: vi.fn(),
  getUpdatesMock: vi.fn(),
  getProposalMock: vi.fn(),
  getStudioVersionMock: vi.fn(),
  getMilestonesMock: vi.fn(),
  fetchStatusMock: vi.fn(),
}));

// `geist` ships next/font bindings that only resolve inside Next's bundler.
// The portal pulls them in transitively via the shared sidebar chrome.
vi.mock("geist/font/sans", () => ({ GeistSans: { variable: "", className: "" } }));
vi.mock("geist/font/mono", () => ({ GeistMono: { variable: "", className: "" } }));

vi.mock("@/auth", () => ({ auth: h.authMock }));
vi.mock("@/lib/auth/ownership", () => ({ viewerOwnsStudioSession: h.ownsMock }));
vi.mock("next/navigation", () => ({ redirect: h.redirectMock, notFound: h.notFoundMock }));
vi.mock("@/lib/maxwell/project-status-fetch", () => ({
  fetchNoonAppProjectStatus: h.fetchStatusMock,
}));
// Keep the pure helpers real; only the DB-touching reads are mocked.
vi.mock("@/lib/maxwell/repositories", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/maxwell/repositories")>()),
  getStudioSession: h.getStudioSessionMock,
  getClientWorkspaceBySession: h.getWorkspaceMock,
  getClientCommentsByWorkspace: h.getCommentsMock,
  getClientRequestsByWorkspace: h.getRequestsMock,
  getWorkspaceUpdates: h.getUpdatesMock,
  getLatestProposalRequest: h.getProposalMock,
  getLatestStudioVersion: h.getStudioVersionMock,
  getAiMvpMilestonesByProjectId: h.getMilestonesMock,
}));

import WorkspacePage from "@/app/[locale]/maxwell/workspace/[sessionId]/page";
import { WorkspaceChat } from "@/components/maxwell/workspace-chat";
import { WorkspaceTabs } from "@/components/maxwell/workspace-tabs";
import { VersionReviewBanner } from "@/components/maxwell/workspace-version-review-banner";

const SESSION_ID = "sess-1";

// ── element-tree helpers ────────────────────────────────────────────────────
type AnyEl = ReactElement<Record<string, unknown>>;

/** Every element in the returned tree, including those passed as props. */
function collect(node: unknown, out: AnyEl[] = []): AnyEl[] {
  if (node == null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const n of node) collect(n, out);
    return out;
  }
  const el = node as AnyEl;
  if (!("type" in el)) return out;
  out.push(el);
  const props = (el.props ?? {}) as Record<string, unknown>;
  for (const value of Object.values(props)) collect(value, out);
  return out;
}

function find(tree: AnyEl[], type: unknown): AnyEl | undefined {
  return tree.find((el) => el.type === type);
}

/** For components local to the page module (not exported, so not importable). */
function byName(tree: AnyEl[], name: string): AnyEl | undefined {
  return tree.find(
    (el) => typeof el.type === "function" && (el.type as { name?: string }).name === name,
  );
}

function textOf(node: unknown, acc: string[] = []): string {
  if (node == null || typeof node === "boolean") return acc.join(" ");
  if (typeof node === "string" || typeof node === "number") {
    acc.push(String(node));
    return acc.join(" ");
  }
  if (Array.isArray(node)) {
    for (const n of node) textOf(n, acc);
    return acc.join(" ");
  }
  const el = node as AnyEl;
  const props = (el.props ?? {}) as Record<string, unknown>;
  for (const value of Object.values(props)) textOf(value, acc);
  return acc.join(" ");
}

const render = async () =>
  collect(
    await WorkspacePage({ params: Promise.resolve({ locale: "en", sessionId: SESSION_ID }) }),
  );

const version = (over: Record<string, unknown> = {}) => ({
  sequence: 3,
  state: "ready_for_client_preview",
  at: "2026-07-20T10:00:00.000Z",
  previewUrl: "https://v3.preview.example",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.authMock.mockResolvedValue({ user: { email: "client@example.com", name: "Ana" } });
  h.ownsMock.mockReturnValue(true);
  h.getStudioSessionMock.mockResolvedValue({
    id: SESSION_ID,
    goalSummary: "Ops dashboard",
    initialPrompt: "build me a dashboard",
    ownerEmail: "client@example.com",
    language: "en",
  });
  h.getWorkspaceMock.mockResolvedValue({
    id: "ws-1",
    noonAppProjectId: "proj-1",
    workspaceStatus: "in_development",
    latestUpdateSummary: null,
    createdAt: "2026-07-01T10:00:00.000Z",
  });
  h.getCommentsMock.mockResolvedValue([]);
  h.getRequestsMock.mockResolvedValue([]);
  h.getUpdatesMock.mockResolvedValue([]);
  h.getMilestonesMock.mockResolvedValue([]);
  h.getStudioVersionMock.mockResolvedValue(null);
  h.getProposalMock.mockResolvedValue({
    id: "prop-1",
    status: "paid",
    publicToken: "tok-1",
    paymentModality: "membership",
    approvedCurrency: "USD",
    approvedAmountUsd: 4500,
    monthlyAmountUsd: 200,
    stripeCustomerId: null,
  });
  h.fetchStatusMock.mockResolvedValue({
    status: "ok",
    data: {
      project: { status: "in_development" },
      versions: [],
      publishedUrl: null,
      membership: null,
      proposal: null,
      latestUpdate: null,
    },
  });
});

describe("client portal — access", () => {
  it("sends a signed-out visitor to sign in, carrying the destination", async () => {
    h.authMock.mockResolvedValue(null);
    await expect(render()).rejects.toThrow(/REDIRECT:.*signin/);
    expect(h.getWorkspaceMock).not.toHaveBeenCalled();
  });

  it("hides the project from someone who doesn't own it", async () => {
    h.ownsMock.mockReturnValue(false);
    await expect(render()).rejects.toThrow("NOT_FOUND");
    // 404, never a "you can't see this" that confirms the project exists.
    expect(h.getWorkspaceMock).not.toHaveBeenCalled();
  });

  it("shows the provisioning screen when payment landed but the workspace hasn't", async () => {
    h.getWorkspaceMock.mockResolvedValue(null);
    const tree = await render();
    // Children of a Server Component aren't invoked, so we assert on the
    // element the page chose to return, not on what it would render into.
    expect(byName(tree, "WorkspacePreparing")).toBeDefined();
    expect(find(tree, WorkspaceTabs)).toBeUndefined();
  });

  it("sends an unpaid client back to their proposal, not to a lookalike portal", async () => {
    h.getWorkspaceMock.mockResolvedValue(null);
    // A proposal that is not in a paid/awaiting state belongs on the payment
    // screens — never on a portal-shaped stub.
    h.getProposalMock.mockResolvedValue({ status: "sent", publicToken: "tok-1" });
    await expect(render()).rejects.toThrow("NOT_FOUND");

    h.getProposalMock.mockResolvedValue({ status: "payment_pending", publicToken: "tok-1" });
    await expect(render()).rejects.toThrow(/REDIRECT:.*proposal\/tok-1/);
  });
});

describe("client portal — tabs", () => {
  it("opens with Overview + Chat only, before anything has been built", async () => {
    const tabs = find(await render(), WorkspaceTabs);
    expect((tabs?.props.tabs as { id: string }[]).map((t) => t.id)).toEqual([
      "overview",
      "chat",
    ]);
  });

  it("adds Versions once versions exist, and Domains once the site is live", async () => {
    h.fetchStatusMock.mockResolvedValue({
      status: "ok",
      data: {
        project: { status: "delivered" },
        versions: [version({ state: "published" })],
        publishedUrl: "https://opsdash.nooncode.dev",
        membership: null,
        proposal: null,
        latestUpdate: null,
      },
    });
    const tabs = find(await render(), WorkspaceTabs);
    expect((tabs?.props.tabs as { id: string }[]).map((t) => t.id)).toEqual([
      "overview",
      "chat",
      "versions",
      "domain",
    ]);
  });

  it("flags Versions for attention only while a build awaits the client", async () => {
    h.fetchStatusMock.mockResolvedValue({
      status: "ok",
      data: {
        project: { status: "in_development" },
        versions: [version()],
        publishedUrl: null,
        membership: null,
        proposal: null,
        latestUpdate: null,
      },
    });
    const tabs = find(await render(), WorkspaceTabs);
    const versionsTab = (tabs?.props.tabs as { id: string; pending?: string }[]).find(
      (t) => t.id === "versions",
    );
    expect(versionsTab?.pending).toBe("action");
  });
});

describe("client portal — the chat's real capabilities", () => {
  it("can always send a message, even before the project reaches the App", async () => {
    h.getWorkspaceMock.mockResolvedValue({
      id: "ws-1",
      noonAppProjectId: null, // not App-mapped yet
      workspaceStatus: "in_development",
      latestUpdateSummary: null,
      createdAt: "2026-07-01T10:00:00.000Z",
    });
    h.fetchStatusMock.mockResolvedValue(null);
    const chat = find(await render(), WorkspaceChat);
    const real = chat?.props.real as Record<string, unknown>;
    expect(typeof real.send).toBe("function");
    // No tracked requests / uploads until the App can route them — offering
    // them would produce buttons that always fail.
    expect(real.formalize).toBeUndefined();
    expect(real.reply).toBeUndefined();
    expect(real.attach).toBeUndefined();
  });

  it("unlocks tracked requests and replies once the project is App-mapped", async () => {
    const chat = find(await render(), WorkspaceChat);
    const real = chat?.props.real as Record<string, unknown>;
    expect(typeof real.formalize).toBe("function");
    expect(typeof real.reply).toBe("function");
  });

  it("hands the chat the merged thread, not just the client's messages", async () => {
    h.getCommentsMock.mockResolvedValue([
      { id: "c1", body: "hola", createdAt: "2026-07-20T09:00:00.000Z" },
    ]);
    h.getUpdatesMock.mockResolvedValue([
      {
        id: "u1",
        title: "v2 shipped",
        content: null,
        updateType: "status_update",
        materialUrl: null,
        createdAt: "2026-07-20T10:00:00.000Z",
      },
    ]);
    h.getRequestsMock.mockResolvedValue([
      {
        id: "r1",
        type: "bug",
        clientPriority: "high",
        body: "el logo se ve mal",
        clientVisibleState: "in_progress",
        createdAt: "2026-07-20T11:00:00.000Z",
        updates: [],
      },
    ]);
    const chat = find(await render(), WorkspaceChat);
    const real = chat?.props.real as { messages: { id: string; from: string }[] };
    expect(real.messages.map((m) => m.id)).toEqual(["c-c1", "u-u1", "r-r1"]);
    expect(real.messages.map((m) => m.from)).toEqual(["client", "dev", "client"]);
  });

  it("passes the live site so the client can mark an area on it", async () => {
    h.fetchStatusMock.mockResolvedValue({
      status: "ok",
      data: {
        project: { status: "delivered" },
        versions: [version({ state: "published" })],
        publishedUrl: "https://opsdash.nooncode.dev",
        membership: null,
        proposal: null,
        latestUpdate: null,
      },
    });
    const chat = find(await render(), WorkspaceChat);
    expect(chat?.props.siteUrl).toBe("https://opsdash.nooncode.dev");
  });
});

describe("client portal — what demands the client's attention", () => {
  it("surfaces the review decision when a build is waiting on them", async () => {
    h.fetchStatusMock.mockResolvedValue({
      status: "ok",
      data: {
        project: { status: "in_development" },
        versions: [version()],
        publishedUrl: null,
        membership: null,
        proposal: null,
        latestUpdate: null,
      },
    });
    const banner = find(await render(), VersionReviewBanner);
    expect(banner?.props.sequence).toBe(3);
    // It must be able to actually publish, not just look like it can.
    expect(typeof banner?.props.publishAction).toBe("function");
  });

  it("stays quiet when the latest build is already live", async () => {
    h.fetchStatusMock.mockResolvedValue({
      status: "ok",
      data: {
        project: { status: "delivered" },
        versions: [version({ state: "published" })],
        publishedUrl: "https://opsdash.nooncode.dev",
        membership: null,
        proposal: null,
        latestUpdate: null,
      },
    });
    expect(find(await render(), VersionReviewBanner)).toBeUndefined();
  });

  it("interrupts with the failed-payment notice, and only then", async () => {
    h.fetchStatusMock.mockResolvedValue({
      status: "ok",
      data: {
        project: { status: "in_development" },
        versions: [],
        publishedUrl: null,
        membership: { status: "past_due" },
        proposal: null,
        latestUpdate: null,
      },
    });
    expect(textOf(await render())).toContain("didn't go through");

    h.fetchStatusMock.mockResolvedValue({
      status: "ok",
      data: {
        project: { status: "in_development" },
        versions: [],
        publishedUrl: null,
        membership: { status: "active" },
        proposal: null,
        latestUpdate: null,
      },
    });
    expect(textOf(await render())).not.toContain("didn't go through");
  });

  it("tells a one-time buyer nothing recurring is coming", async () => {
    h.getProposalMock.mockResolvedValue({
      id: "prop-1",
      status: "paid",
      publicToken: "tok-1",
      paymentModality: "one_time",
      approvedCurrency: "USD",
      approvedAmountUsd: 4500,
      monthlyAmountUsd: null,
      stripeCustomerId: null,
    });
    const text = textOf(await render());
    expect(text).toContain("One-time");
    expect(text).toContain("nothing recurring");
  });
});
