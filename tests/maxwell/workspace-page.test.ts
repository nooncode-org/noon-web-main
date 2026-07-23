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

// The page reads the viewer through the shared session helper (which carries
// the dev bypass), so that is what gets mocked.
vi.mock("@/lib/auth/session", () => ({ getAuthenticatedViewer: h.authMock }));
// The server actions the page imports pull in `@/auth` → next-auth → next/server,
// which doesn't resolve under vitest. Stub it; the page never calls it directly.
vi.mock("@/auth", () => ({
  auth: vi.fn(async () => null),
  isGoogleAuthConfigured: () => false,
  isEmailAuthConfigured: () => false,
  getDevBypassEmail: () => null,
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
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
import { VersionRowMenu } from "@/components/maxwell/workspace-version-menu";
import { AddDomainButtons } from "@/components/maxwell/workspace-add-domain";
import { RequestChangeChip } from "@/components/maxwell/workspace-quick-access";
import { WorkspaceCodePanel, MembershipUpsellCard } from "@/components/maxwell/workspace-onetime-cards";

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
  h.authMock.mockResolvedValue({ email: "client@example.com", name: "Ana", image: null });
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

describe("client portal — the preview is never an empty box", () => {
  it("shows the approved prototype as the preview until the first version lands", async () => {
    // The client approved this in the studio BEFORE paying (owner 2026-07-22):
    // it IS the preview while the MVP is built from it.
    h.getStudioVersionMock.mockResolvedValue({ previewUrl: "https://proto.example" });
    const text = textOf(await render());

    expect(text).toContain("https://proto.example");
    expect(text).toContain("Approved by you");
    // The waiting placeholder — and the invented deadline — are gone.
    expect(text).not.toContain("first preview is on the way");
    expect(text).not.toContain("3–5 business days");
  });

  it("never promises an invented deadline, even without a prototype on file", async () => {
    // Default fixture: no studio version. The rare fallback keeps the calm
    // placeholder but commits to no made-up date.
    const text = textOf(await render());
    expect(text).toContain("first preview is on the way");
    expect(text).not.toContain("business days");
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

  it("goes read-only once the membership has actually ended", async () => {
    h.fetchStatusMock.mockResolvedValue({
      status: "ok",
      data: {
        project: { status: "delivered" },
        versions: [version()],
        publishedUrl: "https://opsdash.nooncode.dev",
        membership: { status: "ended" },
        proposal: null,
        latestUpdate: null,
      },
    });
    const tree = await render();
    const text = textOf(tree);

    // Says so — including that the SITE is offline but nothing was deleted —
    // and offers the way back.
    expect(text).toContain("membership has ended");
    expect(text).toContain("site is offline");
    expect(text).toContain("nothing was deleted");
    expect(text).toMatch(/Reactivate|Manage/);

    // "Saved" without a horizon is a promise we can't keep forever. The owner
    // set 12 months (2026-07-22); the client is told the window, not just that
    // their work survived.
    expect(text).toContain("12 months");

    // Nothing is taken away: the thread stays, and it stays readable.
    const chat = find(tree, WorkspaceChat);
    const real = chat?.props.real as Record<string, unknown>;
    expect(chat?.props.readOnly).toBeDefined();
    expect(Array.isArray(real.messages)).toBe(true);

    // But no new work can be asked for, on ANY surface.
    expect(real.formalize).toBeUndefined();
    expect(real.reply).toBeUndefined();
    expect(real.attach).toBeUndefined();
    expect(find(tree, VersionReviewBanner)).toBeUndefined();
    const rows = tree.filter((el) => el.type === VersionRowMenu);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.props.canPublish).toBe(false);
      expect(row.props.canRequestLive).toBe(false);
    }
    expect(find(tree, AddDomainButtons)?.props.hidden).toBe(true);
  });

  it("a failed payment does NOT lock the portal — Stripe is still retrying", async () => {
    h.fetchStatusMock.mockResolvedValue({
      status: "ok",
      data: {
        project: { status: "in_development" },
        versions: [version()],
        publishedUrl: null,
        membership: { status: "past_due" },
        proposal: null,
        latestUpdate: null,
      },
    });
    const chat = find(await render(), WorkspaceChat);
    expect(chat?.props.readOnly).toBeUndefined();
    expect((chat?.props.real as Record<string, unknown>).formalize).toBeDefined();
  });

  it("a membership set to end keeps working until the period closes", async () => {
    h.fetchStatusMock.mockResolvedValue({
      status: "ok",
      data: {
        project: { status: "in_development" },
        versions: [version()],
        publishedUrl: null,
        // "cancelled" = scheduled to end; they paid through this period.
        membership: { status: "cancelled", currentPeriodEnd: "2026-02-15T12:00:00.000Z" },
        proposal: null,
        latestUpdate: null,
      },
    });
    const tree = await render();
    expect(find(tree, WorkspaceChat)?.props.readOnly).toBeUndefined();
    expect(textOf(tree)).not.toContain("membership has ended");
  });

  it("warns during the paid-through window, naming the exact date", async () => {
    h.fetchStatusMock.mockResolvedValue({
      status: "ok",
      data: {
        project: { status: "in_development" },
        versions: [version()],
        publishedUrl: "https://opsdash.nooncode.dev",
        // Paid Jan 15, cancelled Jan 29 → served through Feb 15. Noon UTC on
        // purpose: a midnight-UTC fixture renders as the previous day in any
        // timezone behind UTC, which looks like a bug and is not one.
        membership: { status: "cancelled", currentPeriodEnd: "2026-02-15T12:00:00.000Z" },
        proposal: null,
        latestUpdate: null,
      },
    });
    const text = textOf(await render());
    // The date itself, not "ends soon" — vagueness is how people miss it.
    expect(text).toContain("Feb 15, 2026");
    // The consequence is named: the site goes offline (one rule for everyone,
    // static or not — owner decision 2026-07-22), and staying online until the
    // date is the promise of the month they already paid.
    expect(text).toContain("stays online until then");
    expect(text).toContain("goes offline");
    expect(text).toMatch(/Renew|Manage/);
  });

  it("still warns when the end date hasn't been reported yet", async () => {
    h.fetchStatusMock.mockResolvedValue({
      status: "ok",
      data: {
        project: { status: "in_development" },
        versions: [],
        publishedUrl: null,
        membership: { status: "cancelled" }, // no currentPeriodEnd
        proposal: null,
        latestUpdate: null,
      },
    });
    const text = textOf(await render());
    expect(text).toContain("set to end");
    expect(text).not.toContain("Invalid Date");
  });

  it("tells a one-time buyer what hosting costs and when it renews", async () => {
    useOneTimeProposal();
    const text = textOf(await render());
    expect(text).toContain("One-time");
    // The old copy promised "nothing recurring" — false under the owner's
    // model: the build is paid once, hosting renews yearly.
    expect(text).not.toContain("nothing recurring");
    // And it names the PRICE, not a vague "renews yearly" (owner 2026-07-23).
    expect(text).toContain("$300");
    expect(text).toMatch(/renews at .*\/year/);
    // The domain is billed separately — never folded into the hosting figure.
    expect(text).toContain("domain is billed separately");
  });
});

// ── One-time plan (owner model, 2026-07-22): the FULL portal, chat included —
// but the chat is support/questions only, versions are read-only, and their
// two cards (Your code + the membership upsell) appear. ─────────────────────
function useOneTimeProposal() {
  h.getProposalMock.mockResolvedValue({
    id: "prop-1",
    status: "paid",
    publicToken: "tok-1",
    paymentModality: "one_time",
    approvedCurrency: "USD",
    approvedAmountUsd: 4500,
    monthlyAmountUsd: 200,
    stripeCustomerId: null,
  });
}

describe("client portal — one-time plan", () => {
  it("keeps the chat but strips the change machinery from it", async () => {
    useOneTimeProposal();
    const tree = await render();
    const chat = find(tree, WorkspaceChat);
    const real = chat?.props.real as Record<string, unknown>;

    // The chat exists (their support + handoff channel)…
    expect(chat).toBeDefined();
    expect(chat?.props.oneTime).toBe(true);
    // …but Track-as-request (the change/bug pipeline) is membership-only,
    // while replying to the team's questions stays (that's support).
    expect(real.formalize).toBeUndefined();
    expect(real.reply).toBeDefined();
    expect(String(real.expectationLine)).toContain("questions about your project");
  });

  it("shows versions read-only: no publish, no make-it-live, no review ask", async () => {
    useOneTimeProposal();
    h.fetchStatusMock.mockResolvedValue({
      status: "ok",
      data: {
        project: { status: "in_development" },
        versions: [version(), version({ sequence: 2, state: "published", published: true })],
        publishedUrl: "https://opsdash.nooncode.dev",
        membership: null,
        proposal: null,
        latestUpdate: null,
      },
    });
    const tree = await render();

    // v3 is ready_for_client_preview — for a membership that's a decision;
    // for a one-time buyer it must ask NOTHING.
    expect(find(tree, VersionReviewBanner)).toBeUndefined();
    const menus = tree.filter((el) => el.type === VersionRowMenu);
    expect(menus.length).toBeGreaterThan(0);
    for (const menu of menus) {
      expect(menu.props.canPublish).toBe(false);
      expect(menu.props.canRequestLive).toBe(false);
    }
    // And the Versions tab carries no amber "resolve this" dot.
    const tabs = find(tree, WorkspaceTabs)?.props.tabs as { id: string; pending?: string }[];
    expect(tabs.find((t) => t.id === "versions")?.pending).toBeUndefined();
    // No "Request a change" chip either — that channel is the membership.
    // (Client components keep their copy inside — assert by element, not text.)
    expect(find(tree, RequestChangeChip)).toBeUndefined();
  });

  it("gives them their code and the path to a membership, priced monthly-only", async () => {
    useOneTimeProposal();
    h.fetchStatusMock.mockResolvedValue({
      status: "ok",
      data: {
        project: { status: "delivered" },
        versions: [version({ sequence: 2, state: "published", published: true })],
        publishedUrl: "https://opsdash.nooncode.dev",
        membership: null,
        proposal: null,
        latestUpdate: null,
      },
    });
    const tree = await render();

    // They paid for the build → the source is theirs, in its own Code tab.
    expect(find(tree, WorkspaceCodePanel)).toBeDefined();
    const tabs = find(tree, WorkspaceTabs)?.props.tabs as { id: string }[];
    expect(tabs.some((t) => t.id === "code")).toBe(true);
    // The upsell sells ongoing development, priced as the monthly ALONE —
    // their activation (the build) is already paid, never re-charged. The
    // card receives the bare monthly and states the delivered status.
    const upsell = find(tree, MembershipUpsellCard);
    expect(upsell?.props.monthlyAmountUsd).toBe(200);
    expect(upsell?.props.delivered).toBe(true);
  });

  it("a membership client sees none of the one-time surfaces", async () => {
    // Default fixture = membership. Same delivered/live scenario.
    h.fetchStatusMock.mockResolvedValue({
      status: "ok",
      data: {
        project: { status: "delivered" },
        versions: [version(), version({ sequence: 2, state: "published", published: true })],
        publishedUrl: "https://opsdash.nooncode.dev",
        membership: { status: "active", currentPeriodEnd: "2026-08-15T12:00:00.000Z" },
        proposal: null,
        latestUpdate: null,
      },
    });
    const tree = await render();

    expect(find(tree, WorkspaceCodePanel)).toBeUndefined();
    expect(find(tree, MembershipUpsellCard)).toBeUndefined();
    // No "Code" tab either.
    const tabs = find(tree, WorkspaceTabs)?.props.tabs as { id: string }[];
    expect(tabs.some((t) => t.id === "code")).toBe(false);
    // Their review decision + change channel stay intact.
    expect(find(tree, VersionReviewBanner)).toBeDefined();
    expect(find(tree, RequestChangeChip)).toBeDefined();
    const chat = find(tree, WorkspaceChat);
    expect(chat?.props.oneTime).toBe(false);
    expect((chat?.props.real as Record<string, unknown>).formalize).toBeDefined();
  });
});
