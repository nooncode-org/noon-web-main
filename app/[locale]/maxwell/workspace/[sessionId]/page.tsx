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
  getAiMvpMilestonesByProjectId,
  isProposalAwaitingWorkspace,
} from "@/lib/maxwell/repositories";
import type {
  AiMvpMilestone,
  ProposalStatus,
} from "@/lib/maxwell/repositories";
import {
  AI_MVP_MILESTONE_COPY,
  pickCurrentMilestone,
} from "@/lib/maxwell/ai-mvp-milestone-copy";
import { WORKSPACE_STATUS_META, type WorkspaceStatus } from "@/lib/maxwell/workspace-status";
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
import type { ProjectStatusVersion } from "@/lib/maxwell/project-status-types";
import {
  buildActivityFeed,
  type ActivityEvent,
  type ActivityEventKind,
} from "@/lib/maxwell/activity-feed";
import { getContactHref } from "@/lib/site-config";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import { ROLLBACK_REQUEST_ENABLED } from "@/lib/maxwell/client-requests";
import { CommentBox } from "./_components/comment-box";
import { RequestBox } from "./_components/request-box";
import { VersionPublishButton } from "./_components/version-publish-button";
import { VersionRollbackButton } from "./_components/version-rollback-button";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ sessionId: string }> };

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

// Small glyph per activity kind (mirrors the prior update-type iconography).
const ACTIVITY_KIND_ICON: Record<ActivityEventKind, string> = {
  update: "*",
  version: "+",
  request: "o",
};

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
}: {
  projectName: string | null;
  proposalStatus: ProposalStatus;
  contactHref: string;
}) {
  const copy = PREPARING_COPY[proposalStatus];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card px-6 py-5">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-1 text-xs font-mono text-muted-foreground">noon / workspace</p>
              <h1 className="text-xl font-display leading-tight">
                {projectName ?? "Your project"}
              </h1>
            </div>
            <span className="shrink-0 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700">
              {copy.label}
            </span>
          </div>

          <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3">
            <p className="text-sm text-muted-foreground">{copy.description}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-10">
        <section className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
          <p className="mb-2 text-sm font-medium">Your workspace is being prepared.</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Refresh this page in a few minutes. You&apos;ll receive an email as soon as the workspace
            is ready to use.
          </p>
        </section>

        <section className="mt-8 rounded-xl border border-border bg-card p-6">
          <h2 className="mb-1 text-sm font-medium">Need to reach us?</h2>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            If something looks off or you have a question while we prepare your project, contact
            us and we&apos;ll respond shortly.
          </p>
          <Link
            href={contactHref}
            className="site-primary-action inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium"
          >
            Contact Noon team
          </Link>
        </section>
      </div>
    </div>
  );
}

function MilestoneBanner({ milestone }: { milestone: AiMvpMilestone }) {
  const copy = AI_MVP_MILESTONE_COPY[milestone.kind];
  const showVersionLink =
    milestone.kind === "version-ready" && Boolean(milestone.versionUrl);

  return (
    <section className="rounded-xl border border-foreground/15 bg-secondary/40 p-6">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Project build
        </span>
      </div>
      <p className="text-sm font-medium leading-snug">{copy.label}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {copy.description}
      </p>
      {showVersionLink && (
        <a
          href={milestone.versionUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="site-primary-action mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium"
        >
          Open first version {"->"}
        </a>
      )}
    </section>
  );
}

// Slice 2a (v3 Fase 2 — versioning display): the App's project versions + the
// live published one, from the project-status pull (`versions[]` +
// `publishedUrl`). NoonWeb owns the client-facing copy (§8.1) via
// `mapVersionStateToMeta`; an unmapped/internal state degrades to a neutral chip.
function VersionsSection({
  sessionId,
  versions,
  publishedUrl,
}: {
  sessionId: string;
  versions: ProjectStatusVersion[];
  publishedUrl: string | null;
}) {
  if (versions.length === 0) return null;
  // Newest first — the App emits ascending by sequence; we present the latest on top.
  const ordered = [...versions].sort((a, b) => b.sequence - a.sequence);

  return (
    <section>
      <h2 className="mb-4 text-xs font-mono uppercase tracking-widest text-muted-foreground">
        Versions
      </h2>

      {publishedUrl && (
        <div className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-700">
            Live
          </p>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">
            Your published version is live and visible to the public.
          </p>
          <a
            href={publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="site-primary-action inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium"
          >
            View published site {"->"}
          </a>
        </div>
      )}

      <div className="space-y-3">
        {ordered.map((version) => {
          const meta = mapVersionStateToMeta(version.state);
          return (
            <div key={version.sequence} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-1.5 flex items-center gap-2.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Version {version.sequence}
                </span>
                <span className="text-[10px] text-muted-foreground/50">
                  {formatDate(version.at)}
                </span>
                <span
                  className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.tone}`}
                >
                  {meta.label}
                </span>
              </div>
              {version.previewUrl && (
                <a
                  href={version.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/30 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
                >
                  Open preview {"->"}
                </a>
              )}
              {/* Publish (Slice 2b): client self-service on a publishable, not-yet-live
                  version. The App is the final authority — it rejects a non-web /
                  non-publishable target server-side. */}
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
  );
}

// §22.2 — one row of the unified client-visible activity feed.
function ActivityCard({ event }: { event: ActivityEvent }) {
  return (
    <div className="relative pl-6">
      <span className="absolute left-0 top-1.5 select-none text-xs text-muted-foreground/60">
        {ACTIVITY_KIND_ICON[event.kind]}
      </span>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2.5">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {event.tag}
          </span>
          <span className="text-[10px] text-muted-foreground/50">{formatDate(event.at)}</span>
        </div>
        <p className="text-sm font-medium leading-snug">{event.title}</p>
        {event.detail && (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {event.detail}
          </p>
        )}
        {event.href && (
          <a
            href={event.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/30 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
          >
            Open {"->"}
          </a>
        )}
      </div>
    </div>
  );
}

export default async function WorkspacePage({ params }: Props) {
  const { sessionId } = await params;
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
      return (
        <WorkspacePreparing
          projectName={session.goalSummary ?? session.initialPrompt}
          proposalStatus={proposal.status}
          contactHref={getContactHref({
            inquiry: "project-update",
            source: "workspace",
            draft: session.goalSummary ?? undefined,
          })}
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
  const statusCfg = appStatusData
    ? mapProjectStatusToMeta(appStatusData.project.status)
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

  const contactHref = getContactHref({
    inquiry: "project-update",
    source: "workspace",
    draft: session.goalSummary ?? undefined,
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card px-6 py-5">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-1 text-xs font-mono text-muted-foreground">noon / workspace</p>
              <h1 className="text-xl font-display leading-tight">
                {session.goalSummary ?? session.initialPrompt}
              </h1>
            </div>
            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${statusCfg.color}`}
            >
              {statusCfg.label}
            </span>
          </div>

          <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {workspace.latestUpdateSummary ?? statusCfg.description}
            </p>
            {appLatestUpdate && (
              <p className="mt-1.5 text-[11px] font-mono text-muted-foreground/60">
                Status updated {formatDate(appLatestUpdate.at)}
              </p>
            )}
          </div>

          {appProposal && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Proposal
                </p>
                <p className="truncate text-sm font-medium">{appProposal.title}</p>
              </div>
              <span className="shrink-0 text-sm font-medium">
                {formatProposalAmount(appProposal.amount, appProposal.currency)}
              </span>
            </div>
          )}

          {planProposal?.paymentModality && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Plan
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">
                    {planProposal.paymentModality === "membership" ? "Membership" : "One-time"}
                  </p>
                  {/* M1: live membership status chip when the App emits state in the pull. */}
                  {membershipMeta && (
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${membershipMeta.color}`}
                    >
                      {membershipMeta.label}
                    </span>
                  )}
                </div>
                {planProposal.paymentModality === "membership" &&
                  planProposal.monthlyAmountUsd != null && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {/* M1 status description when live; M0 interim copy otherwise. */}
                      {membershipMeta
                        ? membershipMeta.description
                        : "Monthly membership is coordinated with your Noon PM."}
                    </p>
                  )}
              </div>
              {planProposal.paymentModality === "membership" &&
                planProposal.monthlyAmountUsd != null && (
                  <span className="shrink-0 text-sm font-medium">
                    {formatProposalAmount(
                      planProposal.monthlyAmountUsd,
                      planProposal.approvedCurrency ?? "USD",
                    )}
                    /mo
                  </span>
                )}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-10 px-6 py-8">
        {milestone && <MilestoneBanner milestone={milestone} />}

        <VersionsSection
          sessionId={sessionId}
          versions={appVersions}
          publishedUrl={appPublishedUrl}
        />

        {materials.length > 0 && (
          <section>
            <h2 className="mb-4 text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Materials
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {materials.map((material) => (
                <a
                  key={material.id}
                  href={material.materialUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-foreground/20 hover:bg-secondary/30"
                >
                  <span className="mt-0.5 shrink-0 text-sm">{"->"}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">{material.title}</p>
                    {material.content && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {material.content}
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-4 text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Activity
          </h2>
          {activity.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              Activity will appear here as your project progresses.
            </p>
          ) : (
            <div className="space-y-4">
              {activity.map((event) => (
                <ActivityCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>

        {workspace.noonAppProjectId && (
          <RequestBox sessionId={sessionId} requests={requests} versions={appVersions} />
        )}

        <CommentBox sessionId={sessionId} comments={comments} />

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-1 text-sm font-medium">Need to reach us?</h2>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            Your project manager is available for questions, feedback, or schedule changes.
          </p>
          <Link
            href={contactHref}
            className="site-primary-action inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium"
          >
            Contact Noon team
          </Link>
        </section>
      </div>
    </div>
  );
}
