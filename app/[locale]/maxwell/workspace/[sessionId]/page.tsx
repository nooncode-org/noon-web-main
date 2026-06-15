import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { buildSignInHref } from "@/lib/auth/redirect";
import {
  getStudioSession,
  getClientWorkspaceBySession,
  getClientCommentsByWorkspace,
  getWorkspaceUpdates,
  getLatestProposalRequest,
  getAiMvpMilestonesByProjectId,
  isProposalAwaitingWorkspace,
} from "@/lib/maxwell/repositories";
import type {
  AiMvpMilestone,
  ProposalStatus,
  WorkspaceUpdate,
} from "@/lib/maxwell/repositories";
import {
  AI_MVP_MILESTONE_COPY,
  pickCurrentMilestone,
} from "@/lib/maxwell/ai-mvp-milestone-copy";
import { WORKSPACE_STATUS_META, type WorkspaceStatus } from "@/lib/maxwell/workspace-status";
import { fetchNoonAppProjectStatus } from "@/lib/maxwell/project-status-fetch";
import { formatProposalAmount, mapProjectStatusToMeta } from "@/lib/maxwell/project-status-labels";
import { getContactHref } from "@/lib/site-config";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import { CommentBox } from "./_components/comment-box";

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

const UPDATE_ICON: Record<string, string> = {
  status_update: "*",
  milestone: "+",
  material: "->",
  note: "o",
};

const UPDATE_LABEL: Record<string, string> = {
  status_update: "Update",
  milestone: "Milestone",
  material: "Material",
  note: "Note",
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

function UpdateCard({ update }: { update: WorkspaceUpdate }) {
  return (
    <div className="relative pl-6">
      <span className="absolute left-0 top-1.5 select-none text-xs text-muted-foreground/60">
        {UPDATE_ICON[update.updateType] ?? "*"}
      </span>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2.5">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {UPDATE_LABEL[update.updateType] ?? update.updateType}
          </span>
          <span className="text-[10px] text-muted-foreground/50">{formatDate(update.createdAt)}</span>
        </div>
        <p className="text-sm font-medium leading-snug">{update.title}</p>
        {update.content && (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {update.content}
          </p>
        )}
        {update.materialUrl && (
          <a
            href={update.materialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/30 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
          >
            Open link {"->"}
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

  // Slice 1b: the client's message log lives in the local outbox (source of
  // truth — the status read does not return comments).
  const comments = await getClientCommentsByWorkspace(workspace.id);

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
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-10 px-6 py-8">
        {milestone && <MilestoneBanner milestone={milestone} />}

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
            Project updates
          </h2>
          {timeline.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              Updates will appear here as your project progresses.
            </p>
          ) : (
            <div className="space-y-4">
              {[...timeline].reverse().map((update) => (
                <UpdateCard key={update.id} update={update} />
              ))}
            </div>
          )}
        </section>

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
