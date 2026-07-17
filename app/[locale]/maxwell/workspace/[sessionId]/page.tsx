import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { buildSignInHref } from "@/lib/auth/redirect";
import {
  getStudioSession,
  getClientWorkspaceBySession,
  getClientCommentsByWorkspace,
  getClientRequestsByWorkspace,
  getWorkspaceUpdates,
  getLatestProposalRequest,
  getLatestStudioVersion,
  getAiMvpMilestonesByProjectId,
  isProposalAwaitingWorkspace,
} from "@/lib/maxwell/repositories";
import type { ProposalStatus } from "@/lib/maxwell/repositories";
import {
  AI_MVP_MILESTONE_COPY,
  pickCurrentMilestone,
} from "@/lib/maxwell/ai-mvp-milestone-copy";
import {
  WORKSPACE_STATUS_META,
  WORKSPACE_STATUS_UNAVAILABLE_META,
  resolveWorkspaceStatusSource,
  type WorkspaceStatus,
} from "@/lib/maxwell/workspace-status";
import { fetchNoonAppProjectStatus } from "@/lib/maxwell/project-status-fetch";
import {
  formatProposalAmount,
  mapMembershipStatusToMeta,
  mapProjectStatusToMeta,
} from "@/lib/maxwell/project-status-labels";
import {
  isPublishableVersionState,
  isPublishedVersion,
  mapVersionStateToMeta,
} from "@/lib/maxwell/version-status-labels";
import { buildActivityFeed } from "@/lib/maxwell/activity-feed";
import { getContactHref } from "@/lib/site-config";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import { ROLLBACK_REQUEST_ENABLED } from "@/lib/maxwell/client-requests";
import { MEMBERSHIP_BILLING_ENABLED } from "@/lib/maxwell/membership-billing";
import { ProposalSidebar } from "@/components/maxwell/proposal-sidebar";
import { WorkspaceTabs } from "@/components/maxwell/workspace-tabs";
import { AutoRefresh } from "@/components/maxwell/auto-refresh";
import { CommentBox } from "./_components/comment-box";
import { RequestBox } from "./_components/request-box";
import { ManageMembershipButton } from "./_components/manage-membership-button";
import { VersionPublishButton } from "./_components/version-publish-button";
import { VersionRollbackButton } from "./_components/version-rollback-button";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; sessionId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sessionId } = await params;
  const session = await getStudioSession(sessionId);
  const name = session?.goalSummary ?? "Your Project";

  return {
    title: `${name} - Workspace`,
    robots: { index: false, follow: false },
  };
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

// The workspace's secondary-action chip (shared visual vocabulary with the
// studio surfaces; the ONE primary per view stays `site-primary-action`).
const CHIP =
  "inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-secondary/30 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary";

const PREPARING_COPY: Record<ProposalStatus, { label: string; description: string }> = {
  pending_review: { label: "Preparing", description: "We're preparing your project." },
  under_review: { label: "Preparing", description: "We're preparing your project." },
  approved: { label: "Preparing", description: "We're preparing your project." },
  sent: { label: "Preparing", description: "We're preparing your project." },
  payment_pending: {
    label: "Payment pending",
    description:
      "Once we receive your payment evidence we'll begin preparing your workspace. This usually takes a few minutes after we confirm.",
  },
  payment_under_verification: {
    label: "Verifying payment",
    description:
      "We received your payment evidence and our team is verifying it. Your workspace will appear here as soon as verification completes.",
  },
  paid: {
    label: "Preparing workspace",
    description:
      "Payment confirmed. We're spinning up your workspace and the first update will appear here in a few moments.",
  },
  expired: { label: "Preparing", description: "We're preparing your project." },
  returned: { label: "Preparing", description: "We're preparing your project." },
  escalated: { label: "Preparing", description: "We're preparing your project." },
};

function WorkspacePreparing({
  projectName,
  proposalStatus,
  contactHref,
  prototypeUrl,
  viewerEmail,
  locale,
}: {
  projectName: string | null;
  proposalStatus: ProposalStatus;
  contactHref: string;
  /** The approved studio prototype's preview URL — the client's continuity anchor while the MVP builds. */
  prototypeUrl?: string | null;
  viewerEmail: string;
  locale: string;
}) {
  const copy = PREPARING_COPY[proposalStatus];

  return (
    // Same chrome as the live portal (sidebar + h-14 header + viewport-locked
    // scroll column) so the client never lands on a differently-shaped page
    // between paying and the workspace being provisioned.
    <div className="flex h-screen overflow-hidden bg-background">
      <ProposalSidebar viewerEmail={viewerEmail} locale={locale} collapsibleRail />

      <div className="min-w-0 flex-1 overflow-y-auto">
        <header className="flex h-14 items-center border-b border-border bg-card px-6 pl-14 lg:px-14">
          <div className="flex w-full items-center justify-between gap-4">
            <h1 className="min-w-0 truncate text-base font-medium leading-tight">
              {projectName ?? "Your project"}
            </h1>
            <span className="shrink-0 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700">
              {copy.label}
            </span>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-6 py-10">
        {/* Flips to the live portal on its own the moment provisioning lands. */}
        <AutoRefresh />
        <section className="rounded-[6px] border border-dashed border-border bg-card px-6 py-10 text-center">
          <p className="mb-2 text-sm font-medium">Your workspace is being prepared.</p>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
            {copy.description}
          </p>
          <p className="mt-3 text-xs text-muted-foreground/70">
            This page refreshes automatically — you&apos;ll also receive an email as soon as it&apos;s
            ready.
          </p>
        </section>

        {/* Continuity anchor: the client paid AFTER approving a prototype — keep
            it one click away while the MVP is being built, so "preparing" never
            feels like a void. */}
        {prototypeUrl && (
          <section className="mt-8 rounded-[6px] border border-border bg-card p-6">
            <h2 className="mb-1 text-sm font-medium">Your approved prototype</h2>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Your project is being built from the prototype you approved. You can revisit it
              anytime while we work.
            </p>
            <a
              href={prototypeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="site-primary-action inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium"
            >
              Open your prototype {"->"}
            </a>
          </section>
        )}

        <section className="mt-8 rounded-[6px] border border-border bg-card p-6">
          <h2 className="mb-1 text-sm font-medium">Need to reach us?</h2>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            If something looks off or you have a question while we prepare your project, contact
            us and we&apos;ll respond shortly.
          </p>
          <Link
            href={contactHref}
            className={
              prototypeUrl
                ? "inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-secondary/30 px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
                : "site-primary-action inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium"
            }
          >
            Contact Noon team
          </Link>
        </section>
        </div>
      </div>
    </div>
  );
}

// Hero preview panel — the -rd wireframe illustration (not a live iframe: cold
// v0 URLs can render blank with no client-side recovery here, which reads as
// broken; the real preview is the linked page itself). Links out when a
// preview/live URL exists.
function WireframePanel({ href, label }: { href: string | null; label: string }) {
  const inner = (
    <div className="flex aspect-[16/10] flex-col overflow-hidden rounded-[6px] border border-border bg-secondary/20 transition-colors group-hover:border-foreground/25">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-foreground/15" />
        <span className="h-2 w-2 rounded-full bg-foreground/15" />
        <span className="h-2 w-2 rounded-full bg-foreground/15" />
        <span className="ml-2 h-3 flex-1 rounded bg-foreground/[0.06]" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-12 shrink-0 space-y-2 border-r border-border p-2.5">
          <span className="block h-2 rounded bg-foreground/15" />
          <span className="block h-2 w-2/3 rounded bg-foreground/[0.08]" />
          <span className="block h-2 w-2/3 rounded bg-foreground/[0.08]" />
          <span className="block h-2 w-1/2 rounded bg-foreground/[0.08]" />
        </div>
        <div className="flex-1 space-y-3 p-3.5">
          <div className="h-3 w-1/3 rounded bg-foreground/20" />
          <div className="grid grid-cols-3 gap-2.5">
            <div className="h-12 rounded-md border border-border bg-foreground/[0.04]" />
            <div className="h-12 rounded-md border border-border bg-foreground/[0.04]" />
            <div className="h-12 rounded-md border border-border bg-foreground/[0.04]" />
          </div>
          <div className="h-20 rounded-md border border-border bg-gradient-to-br from-[#0056fd]/15 to-transparent" />
          <div className="h-2 w-4/5 rounded bg-foreground/[0.08]" />
        </div>
      </div>
    </div>
  );
  if (!href) return inner;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="group block" title={label}>
      {inner}
    </a>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm text-foreground">{children}</div>
    </div>
  );
}

export default async function WorkspacePage({ params }: Props) {
  const { locale, sessionId } = await params;
  const sessionData = await auth();
  const viewerEmail = sessionData?.user?.email?.trim().toLowerCase();

  if (!viewerEmail) {
    redirect(buildSignInHref(`/maxwell/workspace/${encodeURIComponent(sessionId)}`));
  }

  const session = await getStudioSession(sessionId);
  if (!session) notFound();
  if (!viewerOwnsStudioSession({ email: viewerEmail }, session)) notFound();

  const workspace = await getClientWorkspaceBySession(sessionId);
  if (!workspace) {
    // The workspace may still be provisioning between client payment evidence
    // and PM verification. Show an intermediate "preparing" view instead of a
    // bare 404 so the client doesn't bounce. See roadmap §5 Día 2 (B12).
    const proposal = await getLatestProposalRequest(sessionId);
    if (proposal && isProposalAwaitingWorkspace(proposal.status)) {
      // The latest studio version = the prototype state the client approved.
      const approvedPrototype = await getLatestStudioVersion(sessionId);
      return (
        <WorkspacePreparing
          projectName={session.goalSummary ?? session.initialPrompt}
          proposalStatus={proposal.status}
          contactHref={getContactHref({
            inquiry: "project-update",
            source: "workspace",
            draft: session.goalSummary ?? undefined,
          })}
          prototypeUrl={approvedPrototype?.previewUrl ?? null}
          viewerEmail={viewerEmail}
          locale={locale}
        />
      );
    }
    notFound();
  }

  const updates = await getWorkspaceUpdates(workspace.id, { clientVisibleOnly: true });
  const materials = updates.filter((update) => update.updateType === "material");
  const timeline = updates.filter((update) => update.updateType !== "material");

  // PR-B: surface App's post-payment AI MVP pipeline status, derived from the
  // milestone `kind` alone (§19.3). Only available once the workspace has been
  // mapped to an App project id (captured at payment confirmation); otherwise no
  // banner renders and the timeline below is the only project signal.
  const milestone = workspace.noonAppProjectId
    ? pickCurrentMilestone(
        await getAiMvpMilestonesByProjectId(workspace.noonAppProjectId),
      )
    : null;

  // Slice 1a (v3 client portal): pull the App's authoritative project status
  // when the workspace is mapped to an App project. The HMAC signature is the
  // auth; `noonAppProjectId` (== App `projects.id`) selects the resource. We
  // fall back to the local `workspace_status` whenever the App read errors /
  // 404s / is unconfigured, so the workspace never regresses on a transient.
  const appProjectStatus = workspace.noonAppProjectId
    ? await fetchNoonAppProjectStatus(workspace.noonAppProjectId)
    : null;
  const appStatusData = appProjectStatus?.status === "ok" ? appProjectStatus.data : null;

  const localStatusCfg = WORKSPACE_STATUS_META[workspace.workspaceStatus as WorkspaceStatus];
  // NoonWeb owns the client-facing label (§8.1); map the raw App enum here.
  // SEC-M7: si el workspace está mapeado a la App y el pull falló, el badge
  // dice "Status unavailable" en vez de mostrar el local congelado como live.
  const statusSource = resolveWorkspaceStatusSource({
    linkedToApp: Boolean(workspace.noonAppProjectId),
    appPullOk: Boolean(appStatusData),
  });
  const statusCfg = appStatusData
    ? mapProjectStatusToMeta(appStatusData.project.status)
    : statusSource === "unavailable"
      ? WORKSPACE_STATUS_UNAVAILABLE_META
      : localStatusCfg;
  const appProposal = appStatusData?.proposal ?? null;
  const appLatestUpdate = appStatusData?.latestUpdate ?? null;
  // Slice 2a: version history + live published URL from the App pull. Empty until
  // the App emits versions / publishes (then this section renders).
  const appVersions = appStatusData?.versions ?? [];
  const appPublishedUrl = appStatusData?.publishedUrl ?? null;
  // §8.2 membership indicator (M1): the App's SoT membership state arrives
  // sanitized in the pull. Null until the App emits it (flag off / pre-M1) → the
  // Plan card falls back to the local M0 copy. NoonWeb owns the client label.
  const appMembership = appStatusData?.membership ?? null;
  const membershipMeta = appMembership ? mapMembershipStatusToMeta(appMembership.status) : null;

  // Slice 1b: the client's message log lives in the local outbox (source of
  // truth — the status read does not return comments).
  const comments = await getClientCommentsByWorkspace(workspace.id);

  // §9 Slice A: typed client requests. Gated on a payment-activated project
  // (mapped to an App project id, Q-10) — the same gate the server action
  // enforces. When unmapped we skip the fetch and don't render the form.
  const requests = workspace.noonAppProjectId
    ? await getClientRequestsByWorkspace(workspace.id)
    : [];

  // §8.2 payment/membership indicator: the chosen modality + monthly live on the
  // local proposal (NoonWeb-owned, captured at checkout — M0). The App status
  // pull does not carry the modality.
  const planProposal = await getLatestProposalRequest(sessionId);

  // §22.2 status feed: one client-visible activity timeline synthesized from the
  // data we already hold (Noon updates + version lifecycle + request states).
  // Newest-first; materials keep their own section, so only `timeline` feeds in.
  const activity = buildActivityFeed({
    updates: timeline,
    versions: appVersions,
    requests,
  });

  // ── Presentation-only derivations (all from the data above) ──────────────
  const orderedVersions = [...appVersions].sort((a, b) => b.sequence - a.sequence);
  const latestVersion = orderedVersions[0] ?? null;
  // Continuity anchor: before the first App version exists, the approved studio
  // prototype is the client's only artifact — surfaced in the hero empty state.
  const approvedPrototypeUrl =
    appVersions.length === 0
      ? ((await getLatestStudioVersion(sessionId))?.previewUrl ?? null)
      : null;
  const latestVersionMeta = latestVersion ? mapVersionStateToMeta(latestVersion.state) : null;
  const previewHref = latestVersion?.previewUrl ?? null;
  const milestoneCopy = milestone ? AI_MVP_MILESTONE_COPY[milestone.kind] : null;
  const milestoneVersionUrl =
    milestone?.kind === "version-ready" ? milestone.versionUrl : null;

  const projectStatus = appStatusData?.project.status ?? null;
  const milestonesList = [
    { label: "Kickoff", done: true },
    {
      label: "First preview",
      done: appVersions.length > 0 || milestone?.kind === "version-ready",
    },
    { label: "Delivery", done: projectStatus === "delivered" || projectStatus === "completed" },
    { label: "Live", done: Boolean(appPublishedUrl) },
  ];
  const milestonesDone = milestonesList.filter((m) => m.done).length;

  const openRequests = requests.filter((r) => r.clientVisibleState !== "completed").length;

  const isMembershipPlan = planProposal?.paymentModality === "membership";
  const showPlanCard = Boolean(planProposal?.paymentModality);
  const planCurrency = planProposal?.approvedCurrency ?? "USD";

  // Activity is folded into Overview; Messages into Support (both carry the
  // same data-panel as their host tab — WorkspaceTabs groups them). "Support"
  // is always present: it holds the always-available message thread, plus the
  // typed-request system when the project is App-mapped. (Named "Support", not
  // "Requests": a client looking to send a message wouldn't click "Requests".)
  const sections = [
    { id: "overview", label: "Overview" },
    ...(appVersions.length > 0 ? [{ id: "versions", label: "Versions" }] : []),
    ...(materials.length > 0 ? [{ id: "materials", label: "Materials" }] : []),
    ...(appPublishedUrl ? [{ id: "domain", label: "Domain" }] : []),
    { id: "requests", label: "Support" },
  ];

  return (
    // Viewport-locked surface: the content column scrolls, not the page. This
    // keeps the section tabs sticky (document-scroll sticky is unavailable —
    // <html>/<body> carry overflow-x-hidden) and lets the menu overlay float.
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Our menu — the studio sidebar, collapsed by default: on desktop the ▢
          expands a PUSH rail (reflows content beside it, like the studio); on
          mobile it's the overlay drawer. Content-first. */}
      <ProposalSidebar viewerEmail={viewerEmail} locale={locale} collapsibleRail />

      <div className="min-w-0 flex-1 overflow-y-auto">
        {/* Header band — h-14 matches the sidebar header so their bottom
            hairlines align; pl-14 clears the fixed ▢ menu toggle (top-left).
            No public-contact link here: a paying client's channel is the
            Support tab (messages reach the team directly). */}
        <header className="flex h-14 items-center border-b border-border bg-card px-6 pl-14 lg:px-14">
          <div className="flex w-full items-center justify-between gap-4">
            <h1 className="min-w-0 truncate text-base font-medium leading-tight">
              {session.goalSummary ?? session.initialPrompt}
            </h1>
            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${statusCfg.color}`}
            >
              {statusCfg.label}
            </span>
          </div>
        </header>

        <WorkspaceTabs tabs={sections}>
          {/* ── Overview panel ── */}
          <div data-panel="overview" className="space-y-5">
          {/* Hero — the latest build */}
          <section className="overflow-hidden rounded-[6px] border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <p className="text-sm font-medium">
                  {latestVersion ? "Latest version" : "Project build"}
                </p>
                {/* MVP is live: celebrate it — this is what the client paid for. */}
                {appPublishedUrl && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Live
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {previewHref && (
                  <a href={previewHref} target="_blank" rel="noopener noreferrer" className={CHIP}>
                    Open preview {"->"}
                  </a>
                )}
                {appPublishedUrl && (
                  <a
                    href={appPublishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#0056fd] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0047e0]"
                  >
                    Visit live {"->"}
                  </a>
                )}
              </div>
            </div>

            {latestVersion ? (
              <div className="flex flex-col gap-6 p-5 md:flex-row md:items-start md:gap-10">
                <div className="w-full shrink-0 md:w-[440px]">
                  <WireframePanel
                    href={previewHref ?? appPublishedUrl}
                    label={`Open version ${latestVersion.sequence} preview`}
                  />
                </div>
                <div className="grid content-start gap-5">
                  {/* Domain lives here (quick glance, Vercel-style) AND gets its own tab. */}
                  {appPublishedUrl && (
                    <Meta label="Live site">
                      <a
                        href={appPublishedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all font-mono text-[13px] underline-offset-4 hover:underline"
                      >
                        {appPublishedUrl.replace(/^https?:\/\//, "")} {"->"}
                      </a>
                    </Meta>
                  )}
                  <Meta label="Version">
                    <span className="inline-flex items-center gap-2">
                      v{latestVersion.sequence}
                      {latestVersionMeta && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${latestVersionMeta.tone}`}
                        >
                          {latestVersionMeta.label}
                        </span>
                      )}
                    </span>
                  </Meta>
                  <Meta label="Updated">{formatDate(latestVersion.at)} · by your Noon team</Meta>
                  {appProposal && (
                    <Meta label="Proposal">
                      {appProposal.title} ·{" "}
                      {formatProposalAmount(appProposal.amount, appProposal.currency)}
                    </Meta>
                  )}
                </div>
              </div>
            ) : (
              // No versions yet — the App-pipeline milestone (§19.3) drives the
              // empty state, replacing the old standalone MilestoneBanner.
              <div className="p-5">
                <div className="rounded-[6px] border border-dashed border-border px-6 py-10 text-center">
                  <p className="text-sm font-medium">
                    {milestoneCopy?.label ?? "Your first update is on the way"}
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                    {milestoneCopy?.description ??
                      "Your Noon team is getting started. Progress will appear here."}
                  </p>
                  {milestoneVersionUrl && (
                    <a
                      href={milestoneVersionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="site-primary-action mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium"
                    >
                      Open first version {"->"}
                    </a>
                  )}
                  {/* Until that first version exists, keep the approved prototype
                      one click away — the build starts from it. */}
                  {!milestoneVersionUrl && approvedPrototypeUrl && (
                    <a
                      href={approvedPrototypeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${CHIP} mt-5`}
                    >
                      Revisit your approved prototype {"->"}
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
              <p className="text-[13px] text-muted-foreground">
                {workspace.latestUpdateSummary ?? statusCfg.description}
              </p>
              {appLatestUpdate && (
                <p className="text-[11px] font-mono text-muted-foreground/60">
                  Status updated {formatDate(appLatestUpdate.at)}
                </p>
              )}
            </div>
          </section>

          {/* ── Overview cards ──────────────────────────────────────────── */}
          <section className={`grid gap-5 ${showPlanCard ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            {/* Milestones — all derived from real feed data. */}
            <div className="rounded-[6px] border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-medium">Milestones</p>
                <span className="text-[13px] text-muted-foreground">
                  {milestonesDone}/{milestonesList.length}
                </span>
              </div>
              <div className="space-y-2">
                {milestonesList.map((m) => (
                  <div
                    key={m.label}
                    className="flex items-center gap-2.5 rounded-[6px] border border-border px-3 py-2"
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        m.done ? "bg-emerald-500" : "bg-foreground/15"
                      }`}
                    />
                    <span
                      className={`text-[13px] ${
                        m.done ? "text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {m.label}
                    </span>
                    {m.done && (
                      <span className="ml-auto text-[11px] text-muted-foreground/70">Done</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Project stats */}
            <div className="rounded-[6px] border border-border bg-card p-5">
              <p className="mb-4 text-sm font-medium">This project</p>
              <div className="space-y-4">
                <div>
                  <p className="text-[13px] text-muted-foreground">Versions shipped</p>
                  <p className="mt-0.5 text-xl font-semibold tracking-tight">
                    {appVersions.length}
                  </p>
                </div>
                {workspace.noonAppProjectId && (
                  <div>
                    <p className="text-[13px] text-muted-foreground">Open requests</p>
                    <p className="mt-0.5 text-xl font-semibold tracking-tight">{openRequests}</p>
                  </div>
                )}
                <div>
                  <p className="text-[13px] text-muted-foreground">Started</p>
                  <p className="mt-0.5 text-xl font-semibold tracking-tight">
                    {formatDate(workspace.createdAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Plan — the one billing surface (M0 local modality; M1 live chip). */}
            {showPlanCard && planProposal && (
              <div className="rounded-[6px] border border-border bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-medium">Plan</p>
                  {membershipMeta && (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${membershipMeta.color}`}
                    >
                      {membershipMeta.label}
                    </span>
                  )}
                </div>
                <p className="text-xl font-semibold tracking-tight">
                  {isMembershipPlan ? "Membership" : "One-time"}
                  {isMembershipPlan && planProposal.monthlyAmountUsd != null && (
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}
                      · {formatProposalAmount(planProposal.monthlyAmountUsd, planCurrency)}/mo
                    </span>
                  )}
                  {!isMembershipPlan && planProposal.approvedAmountUsd != null && (
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}
                      · {formatProposalAmount(planProposal.approvedAmountUsd, planCurrency)}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {isMembershipPlan
                    ? membershipMeta
                      ? membershipMeta.description
                      : "Monthly membership is coordinated with your Noon PM."
                    : "One payment — nothing recurring."}
                </p>
                {/* M2 (Fase 6b): self-manage / cancel via Stripe Billing Portal.
                    Only when there's a real subscription to manage (stripe_customer_id
                    persisted at M1 activation) and the flag is on. */}
                {MEMBERSHIP_BILLING_ENABLED && planProposal.stripeCustomerId && (
                  <div className="mt-4">
                    <ManageMembershipButton sessionId={sessionId} />
                    <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground/70">
                      Invoices, payment method, and cancellation — handled securely via Stripe.
                    </p>
                  </div>
                )}
              </div>
            )}

          </section>
          </div>

          {/* ── Versions panel ── */}
          {appVersions.length > 0 && (
            <div data-panel="versions">
            <section className="rounded-[6px] border border-border bg-card">
              <div className="border-b border-border px-5 py-3.5">
                <h2 className="text-sm font-medium">Versions</h2>
              </div>
              <div className="divide-y divide-border">
                {orderedVersions.map((version) => {
                  const meta = mapVersionStateToMeta(version.state);
                  return (
                    <div key={version.sequence} className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm font-medium">Version {version.sequence}</p>
                        <span className="text-[11px] text-muted-foreground/70">
                          {formatDate(version.at)}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.tone}`}
                        >
                          {meta.label}
                        </span>
                        {version.previewUrl && (
                          <a
                            href={version.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${CHIP} ml-auto`}
                          >
                            Open preview {"->"}
                          </a>
                        )}
                      </div>
                      {/* Publish (Slice 2b): client self-service on a publishable,
                          not-yet-live version. The App is the final authority — it
                          rejects a non-web / non-publishable target server-side. */}
                      {!isPublishedVersion(version) && isPublishableVersionState(version.state) && (
                        <VersionPublishButton
                          sessionId={sessionId}
                          versionSequenceNumber={version.sequence}
                        />
                      )}
                      {/* Rollback request (B.4): client asks staff to revert to a
                          non-live version (staff authority). UX convention — offered on
                          non-published rows only (Q-B4-3); gated until the App deploys
                          `type = rollback`. */}
                      {ROLLBACK_REQUEST_ENABLED && !isPublishedVersion(version) && (
                        <VersionRollbackButton
                          sessionId={sessionId}
                          versionSequenceNumber={version.sequence}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
            </div>
          )}

          {/* ── Materials panel ── */}
          {materials.length > 0 && (
            <div data-panel="materials">
            <section className="rounded-[6px] border border-border bg-card">
              <div className="border-b border-border px-5 py-3.5">
                <h2 className="text-sm font-medium">Materials</h2>
              </div>
              <div className="grid gap-3 p-5 sm:grid-cols-2">
                {materials.map((material) => (
                  <a
                    key={material.id}
                    href={material.materialUrl ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 rounded-[6px] border border-border p-4 transition-all hover:border-foreground/20 hover:bg-secondary/30"
                  >
                    <span className="mt-0.5 shrink-0 text-sm">{"->"}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-snug">
                        {material.title}
                      </span>
                      {material.content && (
                        <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
                          {material.content}
                        </span>
                      )}
                    </span>
                  </a>
                ))}
              </div>
            </section>
            </div>
          )}

          {/* ── Domain panel (its own tab, per owner) ── */}
          {appPublishedUrl && (
            <div data-panel="domain">
              <section className="rounded-[6px] border border-border bg-card">
                <div className="border-b border-border px-5 py-3.5">
                  <h2 className="text-sm font-medium">Domain</h2>
                </div>
                <div className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <a
                      href={appPublishedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all font-mono text-sm underline-offset-4 hover:underline"
                    >
                      {appPublishedUrl.replace(/^https?:\/\//, "")} {"->"}
                    </a>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Live
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] text-muted-foreground">
                    Your MVP is served at this address.
                  </p>
                  <div className="mt-5 border-t border-border pt-5">
                    <p className="text-sm font-medium">Use your own domain</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                      Want your brand&apos;s domain (like yourbrand.com)? Send a request and your Noon
                      team sets it up — you never touch any DNS.
                    </p>
                    <a
                      href={getContactHref({ inquiry: "custom-domain", source: "workspace" })}
                      className={`${CHIP} mt-3`}
                    >
                      Request a custom domain
                    </a>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Activity — folded into the Overview tab */}
          <div data-panel="overview">
          <section className="rounded-[6px] border border-border bg-card">
            <div className="border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-medium">Activity</h2>
            </div>
            {activity.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                Activity will appear here as your project progresses.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {activity.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 px-5 py-3.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/25" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{event.title}</p>
                      {event.detail && (
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                          {event.detail}
                        </p>
                      )}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {event.tag} · {formatDate(event.at)}
                      </p>
                      {event.href && (
                        <a
                          href={event.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${CHIP} mt-2`}
                        >
                          Open {"->"}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          </div>

          {/* ── Requests panel ── */}
          {workspace.noonAppProjectId && (
            <div data-panel="requests">
              <RequestBox sessionId={sessionId} requests={requests} versions={appVersions} />
            </div>
          )}

          {/* Messages — folded into the Support tab. (No public-contact card here:
              messages already reach the Noon team; the marketing form would ask a
              signed-in client for their name/email again.) */}
          <div data-panel="requests">
          <CommentBox sessionId={sessionId} comments={comments} />
          </div>
        </WorkspaceTabs>
      </div>
    </div>
  );
}
