import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { buildSignInHref } from "@/lib/auth/redirect";
import { Search } from "lucide-react";
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
  mapVersionStateToMeta,
} from "@/lib/maxwell/version-status-labels";
import { getContactHref } from "@/lib/site-config";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import {
  DEFAULT_CLIENT_REQUEST_PRIORITY,
  ROLLBACK_REQUEST_ENABLED,
} from "@/lib/maxwell/client-requests";
import { buildWorkspaceThread } from "@/lib/maxwell/workspace-thread";
import { MEMBERSHIP_BILLING_ENABLED } from "@/lib/maxwell/membership-billing";
import {
  HOSTING_MONTHLY_USD,
  HOSTING_YEARLY_SAVING_USD,
  HOSTING_YEARLY_USD,
} from "@/lib/maxwell/hosting-billing";
import {
  ATTACHMENTS_ENABLED,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MIME_ALLOWLIST,
} from "@/lib/maxwell/attachments";
import { isAttachmentStorageConfigured } from "@/lib/maxwell/attachment-storage";
import { ProposalSidebar } from "@/components/maxwell/proposal-sidebar";
import { WorkspaceTabs } from "@/components/maxwell/workspace-tabs";
import { WorkspacePreparingBody } from "@/components/maxwell/workspace-preparing-body";
import { WorkspaceChat } from "@/components/maxwell/workspace-chat";
import { WorkspaceCopyButton } from "@/components/maxwell/workspace-copy-button";
import { WorkspaceNotifications, type WorkspaceNotification } from "@/components/maxwell/workspace-notifications";
import { WorkspaceHelpMenu } from "@/components/maxwell/workspace-help-menu";
import { VersionReviewBanner } from "@/components/maxwell/workspace-version-review-banner";
import { StarterChecklist } from "@/components/maxwell/workspace-starter-checklist";
import { RequestChangeChip } from "@/components/maxwell/workspace-quick-access";
import { VisitButton } from "@/components/maxwell/visit-button";
import { AddDomainButtons } from "@/components/maxwell/workspace-add-domain";
import { VersionRowMenu } from "@/components/maxwell/workspace-version-menu";
import { WorkspaceCodePanel, MembershipUpsellCard } from "@/components/maxwell/workspace-onetime-cards";
import { NoonMark } from "@/components/brand/noon-logo";
import { ManageMembershipButton } from "./_components/manage-membership-button";
import { submitCommentAction } from "./_actions/submit-comment";
import { submitRequestAction } from "./_actions/submit-request";
import { submitRequestUpdateAction } from "./_actions/submit-request-update";
import { submitRequestAttachmentAction } from "./_actions/submit-request-attachment";
import { submitVersionAction } from "./_actions/submit-version-action";

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

// Chat bubble stamps — same shape the old Messages log used.
function formatStamp(iso: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function relativeTime(iso: string): string {
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, sec] of units) {
    if (Math.abs(diffSec) >= sec) return rtf.format(-Math.round(diffSec / sec), unit);
  }
  return "just now";
}

// Domain status → label + detail + colored dot (same vocabulary as the mock;
// today only "valid" occurs — the default published domain — the rest arrive
// with the custom-domain pipeline, #27/#28).
type DomainStatus = "valid" | "pending" | "verifying" | "action_needed";
const DOMAIN_STATUS: Record<DomainStatus, { label: string; detail: string; dot: string }> = {
  valid: {
    label: "In production",
    detail: "Live and serving your project.",
    dot: "bg-emerald-500",
  },
  pending: {
    label: "Setting up",
    detail: "Your Noon team is configuring it.",
    dot: "bg-amber-500",
  },
  verifying: {
    label: "Verifying DNS",
    detail: "Waiting for the records to propagate — usually a few minutes.",
    dot: "bg-[#0056fd]",
  },
  action_needed: {
    label: "Action needed",
    detail: "Add a DNS record to finish connecting — or let your team do it.",
    dot: "bg-red-500",
  },
};

// The workspace's secondary-action chip (shared visual vocabulary with the
// studio surfaces).
const CHIP =
  "inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-secondary/30 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary";

// The one pre-workspace state a client can actually land on: the brief
// provisioning blip after a confirmed payment. Everything else (not-yet-paid)
// is redirected to the proposal — the real payment screens — never shown here.
function WorkspacePreparing({
  projectName,
  contactHref,
  viewerEmail,
  locale,
}: {
  projectName: string | null;
  contactHref: string;
  viewerEmail: string;
  locale: string;
}) {
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
              Preparing workspace
            </span>
          </div>
        </header>

        <WorkspacePreparingBody contactHref={contactHref} />
      </div>
    </div>
  );
}

export default async function WorkspacePage({ params }: Props) {
  const { locale, sessionId } = await params;
  // Single auth entry point: same NextAuth session in production, plus the
  // documented dev bypass so the portal can actually be run locally (calling
  // `auth()` directly skipped it, which is why it was never clickable in dev).
  const viewer = await getAuthenticatedViewer();
  const viewerEmail = viewer?.email;

  if (!viewerEmail) {
    redirect(buildSignInHref(`/maxwell/workspace/${encodeURIComponent(sessionId)}`));
  }

  const session = await getStudioSession(sessionId);
  if (!session) notFound();
  if (!viewerOwnsStudioSession({ email: viewerEmail }, session)) notFound();

  const workspace = await getClientWorkspaceBySession(sessionId);
  if (!workspace) {
    const proposal = await getLatestProposalRequest(sessionId);
    if (proposal && isProposalAwaitingWorkspace(proposal.status)) {
      // Payment (card / Apple Pay / Google Pay / PayPal — all Stripe) confirms
      // synchronously on return, so `paid` here is just the seconds-long race
      // remnant before the workspace row lands: show the brief provisioning
      // state, which auto-refreshes into the live portal. Any not-yet-paid
      // state belongs on the proposal page — the real payment screens — so send
      // the client there instead of a lookalike stub.
      if (proposal.status === "paid") {
        return (
          <WorkspacePreparing
            projectName={session.goalSummary ?? session.initialPrompt}
            contactHref={getContactHref({
              inquiry: "project-update",
              source: "workspace",
              draft: session.goalSummary ?? undefined,
            })}
            viewerEmail={viewerEmail}
            locale={locale}
          />
        );
      }
      redirect(`/${locale}/maxwell/proposal/${proposal.publicToken}`);
    }
    notFound();
  }

  const updates = await getWorkspaceUpdates(workspace.id, { clientVisibleOnly: true });
  const materials = updates.filter((update) => update.updateType === "material");
  const timeline = updates.filter((update) => update.updateType !== "material");

  // PR-B: the App's post-payment AI MVP pipeline status, derived from the
  // milestone `kind` alone (§19.3). Only once the workspace is App-mapped.
  const milestone = workspace.noonAppProjectId
    ? pickCurrentMilestone(
        await getAiMvpMilestonesByProjectId(workspace.noonAppProjectId),
      )
    : null;

  // Slice 1a: the App's authoritative project status when mapped; local
  // `workspace_status` fallback so a transient App error never regresses us.
  const appProjectStatus = workspace.noonAppProjectId
    ? await fetchNoonAppProjectStatus(workspace.noonAppProjectId)
    : null;
  const appStatusData = appProjectStatus?.status === "ok" ? appProjectStatus.data : null;

  const localStatusCfg = WORKSPACE_STATUS_META[workspace.workspaceStatus as WorkspaceStatus];
  // SEC-M7: mapped-but-failed pull shows "Status unavailable", never a stale
  // local status presented as live.
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
  const appVersions = appStatusData?.versions ?? [];
  const appPublishedUrl = appStatusData?.publishedUrl ?? null;
  const appMembership = appStatusData?.membership ?? null;
  const membershipMeta = appMembership ? mapMembershipStatusToMeta(appMembership.status) : null;

  // Slice 1b + §9: the client's outbox (comments + typed requests) — merged into
  // the chat thread below. Requests stay gated on an App-mapped project.
  const comments = await getClientCommentsByWorkspace(workspace.id);
  const requests = workspace.noonAppProjectId
    ? await getClientRequestsByWorkspace(workspace.id)
    : [];

  // §8.2: modality + amounts live on the local proposal (captured at checkout).
  const planProposal = await getLatestProposalRequest(sessionId);

  // ── Presentation derivations ─────────────────────────────────────────────
  const orderedVersions = [...appVersions].sort((a, b) => b.sequence - a.sequence);
  const latestVersion = orderedVersions[0] ?? null;
  const latestVersionMeta = latestVersion ? mapVersionStateToMeta(latestVersion.state) : null;
  const previewHref = latestVersion?.previewUrl ?? null;
  // Continuity anchor: before the first App version, the approved studio
  // prototype is the client's only artifact.
  const approvedPrototypeUrl =
    appVersions.length === 0
      ? ((await getLatestStudioVersion(sessionId))?.previewUrl ?? null)
      : null;
  const milestoneCopy = milestone ? AI_MVP_MILESTONE_COPY[milestone.kind] : null;
  const milestoneVersionUrl =
    milestone?.kind === "version-ready" ? milestone.versionUrl : null;

  // Build-phase status: label + color dot on the hero title (amber → blue →
  // green) — the page's single status voice.
  const phase = appPublishedUrl
    ? { label: "In production", dot: "bg-emerald-500" }
    : latestVersion
      ? { label: "In review", dot: "bg-[#0056fd]" }
      : { label: "In progress", dot: "bg-amber-500" };
  // A version awaiting the client's decision → the Overview review banner.
  const reviewVersion =
    latestVersion?.state === "ready_for_client_preview" ? latestVersion : null;

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

  const isMembershipPlan = planProposal?.paymentModality === "membership";
  const showPlanCard = Boolean(planProposal?.paymentModality);
  const planCurrency = planProposal?.approvedCurrency ?? "USD";
  const isPastDue = isMembershipPlan && appMembership?.status === "past_due";
  /**
   * Membership over → the portal turns READ-ONLY (owner decision 2026-07-22).
   *
   * Only on `ended`. A failed payment (`past_due`) keeps working — Stripe is
   * still retrying — and `cancelled` means "set to end", where the client has
   * paid through the current period and keeps everything until it closes. So the
   * cut happens exactly once, when the membership is actually over.
   *
   * Nothing is hidden or deleted: the project, the whole conversation, versions
   * and invoices stay readable. What goes away is the ability to ask for NEW
   * work, which is what the membership paid for. Reactivating is the one action
   * left in front of them.
   */
  const membershipEnded = isMembershipPlan && appMembership?.status === "ended";
  /**
   * Cancelled but still inside the paid period: the client keeps EVERYTHING
   * (hosting included) until it closes — they paid for that month. What they
   * lack is a heads-up, so this window gets a standing notice with the exact
   * date and a way back, instead of only a quiet chip on the Plan card.
   */
  const membershipEnding = isMembershipPlan && appMembership?.status === "cancelled";
  const membershipEndsOn = appMembership?.currentPeriodEnd ?? null;
  const billingSlot =
    MEMBERSHIP_BILLING_ENABLED && planProposal?.stripeCustomerId ? (
      <ManageMembershipButton sessionId={sessionId} />
    ) : undefined;

  const host = appPublishedUrl?.replace(/^https?:\/\//, "") ?? null;
  // Today only the default published domain exists; custom rows arrive with the
  // domain pipeline (#27/#28) — the UI vocabulary is already in place for them.
  const domainRows = appPublishedUrl
    ? [
        {
          id: "default",
          domain: host as string,
          status: "valid" as DomainStatus,
          url: appPublishedUrl,
          isDefault: true,
        },
      ]
    : [];

  // ── Chat thread: ONE conversation with Noon, merged from every real channel
  // (client comments + team updates + delivered materials + tracked requests
  // with their clarification replies), chronological. The merge itself lives in
  // lib/maxwell/workspace-thread.ts so it can be tested without a database. ──
  const chatMessages = buildWorkspaceThread({
    comments,
    updates: timeline,
    materials,
    requests,
    formatStamp,
  });

  // ── Chat transports — inline Server Actions bound to THIS session, handed to
  // the client component as props. Each wraps the existing validated action.
  async function sendChatMessage(body: string) {
    "use server";
    const result = await submitCommentAction({ sessionId, body });
    return result.ok ? ({ ok: true } as const) : ({ ok: false, error: result.error } as const);
  }
  async function formalizeChatRequest(input: {
    type: "adjustment" | "bug";
    clientPriority: "low" | "normal" | "high";
    body: string;
  }) {
    "use server";
    const result = await submitRequestAction({
      sessionId,
      type: input.type,
      clientPriority: input.clientPriority,
      body: input.body,
    });
    return result.ok ? ({ ok: true } as const) : ({ ok: false, error: result.error } as const);
  }
  async function replyToChatRequest(input: { requestId: string; body: string }) {
    "use server";
    const result = await submitRequestUpdateAction({
      sessionId,
      requestId: input.requestId,
      body: input.body,
    });
    return result.ok ? ({ ok: true } as const) : ({ ok: false, error: result.error } as const);
  }
  /**
   * Share a file from the chat. There is no message-level attachment store, but
   * §9 already hosts + forwards files attached to a REQUEST — and `material`
   * ("Material / file") is exactly that request type. So a file share creates a
   * material request carrying the note, then attaches the bytes to it. Both
   * halves are the existing, validated actions; nothing new touches storage.
   */
  async function attachToChat(form: FormData) {
    "use server";
    const file = form.get("file");
    if (!(file instanceof File)) {
      return { ok: false, error: "Please choose a file." } as const;
    }
    const note = String(form.get("note") ?? "").trim();
    const created = await submitRequestAction({
      sessionId,
      type: "material",
      clientPriority: DEFAULT_CLIENT_REQUEST_PRIORITY,
      // The note is optional in the UI, but a request needs a body — fall back
      // to naming the file so the team sees what arrived.
      body: note || `Shared a file: ${file.name}`,
    });
    if (!created.ok) return { ok: false, error: created.error } as const;

    const attached = await submitRequestAttachmentAction({
      sessionId,
      requestId: created.requestId,
      file,
      body: note || null,
    });
    if (!attached.ok) {
      // The request landed but the file didn't — say so precisely instead of
      // implying nothing was sent.
      return {
        ok: false,
        error: `${attached.error} Your message was sent, but the file wasn't attached.`,
      } as const;
    }
    return { ok: true } as const;
  }
  async function publishVersion(versionSequenceNumber: number) {
    "use server";
    const result = await submitVersionAction({ sessionId, versionSequenceNumber });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }
  async function requestVersionLive(versionSequenceNumber: number) {
    "use server";
    const result = await submitRequestAction({
      sessionId,
      type: "rollback",
      clientPriority: DEFAULT_CLIENT_REQUEST_PRIORITY,
      body: `Please make version ${versionSequenceNumber} the live version.`,
      versionRef: versionSequenceNumber,
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  // ── Notifications — derived from the same real signals that power the page
  // (read-state is per-visit until a persistent feed lands, #27). ────────────
  const notifications: WorkspaceNotification[] = [
    // "Ready for your review" asks for a build decision — membership only.
    ...(reviewVersion && isMembershipPlan
      ? [
          {
            id: `nv-${reviewVersion.sequence}`,
            kind: "version" as const,
            title: `Version ${reviewVersion.sequence} is ready for your review`,
            at: relativeTime(reviewVersion.at),
            tab: "versions",
            unread: true,
          },
        ]
      : []),
    ...(isPastDue
      ? [
          {
            id: "nb-pastdue",
            kind: "billing" as const,
            title: "Your last payment didn't go through",
            detail: "Update your payment method to keep your project active.",
            at: "now",
            tab: "overview",
            unread: true,
          },
        ]
      : []),
    ...(appPublishedUrl
      ? [
          {
            id: "nd-live",
            kind: "domain" as const,
            title: "Your site is live",
            detail: host ?? undefined,
            at: relativeTime(latestVersion?.at ?? workspace.createdAt),
            tab: "domain",
          },
        ]
      : []),
    ...timeline.slice(0, 3).map((u) => ({
      id: `nu-${u.id}`,
      kind: "milestone" as const,
      title: u.title,
      detail: u.content?.slice(0, 90) ?? undefined,
      at: relativeTime(u.createdAt),
      tab: "overview",
    })),
  ];

  // Consolidated to 4 tabs (owner 2026-07-18): Overview · Chat · Versions ·
  // Domains. Support/Materials/Activity/Brand-assets all fold into the Chat.
  const sections = [
    { id: "overview", label: "Overview" },
    { id: "chat", label: "Chat" },
    ...(appVersions.length > 0
      ? [
          {
            id: "versions",
            label: "Versions",
            // The amber "action" dot asks them to resolve a review — a
            // membership decision; one-time versions are read-only.
            ...(reviewVersion && isMembershipPlan ? { pending: "action" as const } : {}),
          },
        ]
      : []),
    ...(appPublishedUrl ? [{ id: "domain", label: "Domains" }] : []),
    // "Code" is a one-time buyer's own tab (they own the source) — once a build
    // exists to hand over. LAST tab (owner 2026-07-22). A membership doesn't get
    // it (ongoing service, not a bought-and-done deliverable).
    ...(!isMembershipPlan && latestVersion ? [{ id: "code", label: "Code" }] : []),
  ];

  const projectName = session.goalSummary ?? session.initialPrompt;

  return (
    // Viewport-locked surface: the content column scrolls, not the page (keeps
    // the section tabs sticky — <html>/<body> carry overflow-x-hidden).
    <div className="flex h-screen overflow-hidden bg-background">
      <ProposalSidebar
        viewerEmail={viewerEmail}
        viewerName={viewer?.name ?? null}
        locale={locale}
        collapsibleRail
        settings={{
          isMembership: isMembershipPlan,
          membershipBadge: membershipMeta
            ? { label: membershipMeta.label, color: membershipMeta.color }
            : null,
          // Locked until the team enables it per project (owner 2026-07-20);
          // the panel points the client at the Chat meanwhile.
          advancedUnlocked: false,
          billingSlot,
        }}
      />

      <div className="min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border bg-card px-6 pl-14 lg:px-14">
          <div className="flex w-full items-center gap-4">
            {/* Status lives on the hero title (label + color dot); the header
                carries just the project. Editable title = persistence, #27. */}
            <h1 className="min-w-0 flex-1 truncate text-base font-medium leading-tight">
              {projectName}
            </h1>
            <div className="flex shrink-0 items-center gap-0.5">
              <WorkspaceNotifications items={notifications} />
              <WorkspaceHelpMenu isMembership={isMembershipPlan} />
            </div>
          </div>
        </header>

        {/* Still inside the period they paid for: nothing is taken away yet, so
            this is a heads-up, not an alarm. It carries the exact date — "ends
            soon" is the kind of vagueness that makes people miss it. */}
        {membershipEnding && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/25 bg-amber-500/[0.07] px-6 py-3 lg:px-14">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <span className="font-medium">
                {membershipEndsOn
                  ? `Your membership ends on ${formatDate(membershipEndsOn)}.`
                  : "Your membership is set to end."}
              </span>{" "}
              Your site stays online until then — after that it goes offline until you renew.
            </p>
            {billingSlot ?? (
              <a
                href={getContactHref({ inquiry: "project-update", source: "workspace" })}
                className="shrink-0 rounded-[6px] border border-transparent bg-[#0056fd] px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#0047e0]"
              >
                Renew {"->"}
              </a>
            )}
          </div>
        )}

        {/* Membership over: state it plainly, say what is kept, and put
            reactivating right there. Neutral — not red: nothing went wrong,
            they chose this. */}
        {membershipEnded && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/40 px-6 py-3 lg:px-14">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Your membership has ended.</span>{" "}
              Your site is offline, but nothing was deleted — your project, conversation and
              files stay saved for 12 months. Reactivate and it comes back exactly as it was.
            </p>
            {billingSlot ?? (
              <a
                href={getContactHref({ inquiry: "project-update", source: "workspace" })}
                className="shrink-0 rounded-[6px] border border-transparent bg-[#0056fd] px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#0047e0]"
              >
                Reactivate {"->"}
              </a>
            )}
          </div>
        )}

        {/* Dunning banner — a failed membership payment interrupts everything
            (audit P0-3). The real fix path is the Stripe Billing Portal. */}
        {isPastDue && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-500/30 bg-red-500/[0.07] px-6 py-3 lg:px-14">
            <p className="text-sm text-red-700 dark:text-red-300">
              <span className="font-medium">Your last payment didn&apos;t go through.</span>{" "}
              Update your payment method to keep your project active.
            </p>
            {billingSlot ?? (
              <a
                href={getContactHref({ inquiry: "project-update", source: "workspace" })}
                className="shrink-0 rounded-[6px] bg-red-600 px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-red-700"
              >
                Contact us {"->"}
              </a>
            )}
          </div>
        )}

        <WorkspaceTabs tabs={sections}>
          {/* ── Overview panel ── */}
          <div data-panel="overview" className="space-y-5">
            {/* The client's #1 recurring decision, surfaced first-class. Release
                notes arrive when the App emits them (#27) — until then the
                banner falls back to its generic instruction line. */}
            {/* Sin membresía no se pide una decisión de trabajo: el banner
                entero (verla, publicarla, pedir cambios) deja de aplicar. El
                one-time tampoco decide builds — no dirige el desarrollo. */}
            {reviewVersion && isMembershipPlan && !membershipEnded && (
              <VersionReviewBanner
                sequence={reviewVersion.sequence}
                previewUrl={reviewVersion.previewUrl}
                publishAction={publishVersion.bind(null, reviewVersion.sequence)}
              />
            )}

            <section className="overflow-hidden rounded-[6px] border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-2.5">
                {/* Dot LEADS the label — same status vocabulary as the Versions
                    rows and Domains rows. */}
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${phase.dot}`} aria-hidden />
                  <p className="text-sm font-medium">{phase.label}</p>
                </div>
                {appPublishedUrl && (
                  <VisitButton liveUrl={appPublishedUrl} previewUrl={previewHref} />
                )}
              </div>

              {latestVersion ? (
                <div className="flex flex-col gap-6 p-5 md:flex-row md:items-start md:gap-10">
                  <div className="w-full shrink-0 md:w-[440px]">
                    <a
                      href={previewHref ?? appPublishedUrl ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      // The wireframe inside is pure decoration — without a name
                      // a screen reader announces this as just "link".
                      aria-label="Open your live site"
                      className="group block"
                    >
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
                    </a>
                  </div>
                  <div className="grid content-start gap-5">
                    {appPublishedUrl && (
                      <div>
                        <p className="text-[13px] text-muted-foreground">Live site</p>
                        <div className="mt-1 flex items-center gap-1 text-sm text-foreground">
                          <a
                            href={appPublishedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 break-all font-mono text-[13px] underline-offset-4 hover:underline"
                          >
                            {host}
                          </a>
                          <WorkspaceCopyButton value={appPublishedUrl} label="Copy site URL" />
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-[13px] text-muted-foreground">Version</p>
                      <div className="mt-1 text-sm text-foreground">
                        <span className="inline-flex items-center gap-2">
                          v{latestVersion.sequence}
                          {latestVersionMeta && (
                            <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                              <span
                                aria-hidden
                                className={`h-2 w-2 shrink-0 rounded-full ${latestVersionMeta.dot}`}
                              />
                              {latestVersionMeta.label}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[13px] text-muted-foreground">Updated</p>
                      <div className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
                        <span title={formatDate(latestVersion.at)}>
                          {relativeTime(latestVersion.at)} · by your Noon team
                        </span>
                        <span
                          aria-hidden
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border bg-secondary"
                        >
                          <NoonMark height={8} width={8} />
                        </span>
                      </div>
                    </div>
                    {appProposal && (
                      <div>
                        <p className="text-[13px] text-muted-foreground">Proposal</p>
                        <div className="mt-1 text-sm text-foreground">
                          {appProposal.title} ·{" "}
                          {formatProposalAmount(appProposal.amount, appProposal.currency)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : approvedPrototypeUrl && !milestoneVersionUrl ? (
                // The client is NEVER staring at an empty box: they already
                // approved a prototype in the studio before paying, so THAT is
                // the preview from day one (owner 2026-07-22) — the MVP being
                // built from it takes this spot the moment it lands. This also
                // retired the invented "3–5 business days" promise: showing
                // something real beats promising a date.
                <div className="flex flex-col gap-6 p-5 md:flex-row md:items-start md:gap-10">
                  <div className="w-full shrink-0 md:w-[440px]">
                    <a
                      href={approvedPrototypeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open your approved prototype"
                      className="group block"
                    >
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
                    </a>
                  </div>
                  <div className="grid content-start gap-5">
                    <div>
                      <p className="text-[13px] text-muted-foreground">Prototype</p>
                      <div className="mt-1 flex items-center gap-2 text-sm text-foreground">
                        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                        Approved by you
                      </div>
                      <a
                        href={approvedPrototypeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        Open prototype {"->"}
                      </a>
                    </div>
                    <div>
                      <p className="text-[13px] text-muted-foreground">What&apos;s next</p>
                      <p className="mt-1 max-w-sm text-sm leading-relaxed text-foreground">
                        {milestoneCopy?.description ??
                          "Your Noon team is turning it into your MVP — the first real version lands right here, and you'll get an email."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
                  {/* Fallback (no prototype on file — rare): the low-emphasis
                      dashed placeholder, NOT a spinner. No invented deadline. */}
                  <div className="flex aspect-[16/10] w-full max-w-[220px] flex-col overflow-hidden rounded-[6px] border border-dashed border-border bg-secondary/10 opacity-70">
                    <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-3 py-2">
                      <span className="h-2 w-2 rounded-full bg-foreground/10" />
                      <span className="h-2 w-2 rounded-full bg-foreground/10" />
                      <span className="h-2 w-2 rounded-full bg-foreground/10" />
                    </div>
                    <div className="flex flex-1 items-center justify-center">
                      <span className="h-2 w-24 rounded bg-foreground/10" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {milestoneCopy?.label ?? "Your first preview is on the way"}
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
                      {milestoneCopy?.description ??
                        "Your Noon team is building version 1 — it'll appear here the moment it's ready, and you'll get an email."}
                    </p>
                    {milestoneVersionUrl && (
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                        <a
                          href={milestoneVersionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={CHIP}
                        >
                          Open first version {"->"}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
                <p className="text-[13px] text-muted-foreground">
                  {workspace.latestUpdateSummary ?? statusCfg.description}
                </p>
                {/* "Request a change" is membership machinery — the one-time
                    chat is questions/support only (owner 2026-07-22). */}
                {isMembershipPlan && !membershipEnded && <RequestChangeChip />}
              </div>
            </section>

            {/* ── One-time upsell (Overview): their path to changes — monthly
                  ALONE, activation already paid. "Your code" is its own tab. ── */}
            {!isMembershipPlan && (
              <MembershipUpsellCard
                delivered={Boolean(appPublishedUrl)}
                monthlyAmountUsd={planProposal?.monthlyAmountUsd ?? null}
                currency={planCurrency}
              />
            )}

            {/* "While you wait" — agency during the v1 build; fresh state only. */}
            {appVersions.length === 0 && !appPublishedUrl && <StarterChecklist />}

            {/* ── Overview cards — Milestones (progress) + Plan (billing). ── */}
            <section className={`grid gap-5 ${showPlanCard ? "md:grid-cols-2" : ""}`}>
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
                        className={`text-[13px] ${m.done ? "text-muted-foreground" : "text-foreground"}`}
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

              {showPlanCard && planProposal && (
                <div className="rounded-[6px] border border-border bg-card p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-medium">Plan</p>
                    {membershipMeta && (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${membershipMeta.color}`}
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
                      : `Paid once for the build — your first year of hosting is included. After that: ${formatProposalAmount(
                          HOSTING_YEARLY_USD,
                          planCurrency,
                        )}/year, or ${formatProposalAmount(
                          HOSTING_MONTHLY_USD,
                          planCurrency,
                        )}/month — paying yearly saves you ${formatProposalAmount(
                          HOSTING_YEARLY_SAVING_USD,
                          planCurrency,
                        )}. Your domain is billed separately.`}
                  </p>
                  {/* The most-asked billing question, answered before it's asked
                      (audit P1-8) — good standing only; past_due gets the banner. */}
                  {isMembershipPlan &&
                    appMembership?.status === "active" &&
                    appMembership.currentPeriodEnd && (
                      <p className="mt-2 text-[12px] text-muted-foreground/80">
                        Next payment:{" "}
                        <span className="text-foreground">
                          {formatDate(appMembership.currentPeriodEnd)}
                        </span>
                      </p>
                    )}
                  {billingSlot && (
                    <div className="mt-4">
                      {billingSlot}
                      <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground/70">
                        Invoices, payment method, and cancellation — handled securely via Stripe.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* ── Chat panel — one "chat with Noon", the portal's centerpiece:
                replaces the old Support tab (Requests + Messages), Materials,
                and Activity (the thread IS the timeline). ── */}
          <div data-panel="chat">
            <WorkspaceChat
              siteUrl={appPublishedUrl ?? previewHref ?? undefined}
              // One-time: the chat is support/questions — Review site (mark a
              // spot to change) stays membership-only (owner 2026-07-22).
              oneTime={!isMembershipPlan}
              readOnly={
                membershipEnded
                  ? {
                      note: "This conversation is read-only while your membership is inactive. Reactivate to start it again.",
                    }
                  : undefined
              }
              real={{
                messages: chatMessages,
                send: sendChatMessage,
                // Track-as-request = the change/bug pipeline → membership only.
                // Replies stay for both plans: answering the team's questions on
                // an existing request (e.g. a shared file) is support.
                ...(workspace.noonAppProjectId && !membershipEnded && isMembershipPlan
                  ? { formalize: formalizeChatRequest }
                  : {}),
                ...(workspace.noonAppProjectId && !membershipEnded
                  ? { reply: replyToChatRequest }
                  : {}),
                // Uploads need the same App-mapping the requests need, plus the
                // storage bucket + the B.5b kill-switch. The picker stays hidden
                // unless the whole path is live.
                ...(workspace.noonAppProjectId && !membershipEnded && ATTACHMENTS_ENABLED && isAttachmentStorageConfigured()
                  ? {
                      attach: attachToChat,
                      attachLimits: {
                        maxBytes: ATTACHMENT_MAX_BYTES,
                        mimes: ATTACHMENT_MIME_ALLOWLIST,
                      },
                    }
                  : {}),
                expectationLine: isMembershipPlan
                  ? "Messages reach your Noon team — replies within 24h"
                  : "Your Noon team helps with questions about your project — replies within 24h",
              }}
            />
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
                    // Scope the two version actions so they NEVER overlap: the
                    // client PUBLISHES a fresh preview forward directly, but only
                    // ASKS the team to reactivate an older published-before
                    // version (rollback = staff authority). Live gets neither.
                    // One-time buyer: versions are read-only (open the preview,
                    // nothing else) — publishing + reactivating are build
                    // decisions that belong to a membership.
                    const canPublish =
                      isMembershipPlan &&
                      !membershipEnded &&
                      version.state === "ready_for_client_preview";
                    const canRequestLive =
                      isMembershipPlan &&
                      !membershipEnded &&
                      ROLLBACK_REQUEST_ENABLED &&
                      isPublishableVersionState(version.state) &&
                      version.state !== "ready_for_client_preview";
                    return (
                      <div key={version.sequence} className="flex items-center gap-3 px-5 py-3.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-sm font-medium">Version {version.sequence}</p>
                            <span className="text-[11px] text-muted-foreground/70">
                              {formatDate(version.at)}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                              <span
                                aria-hidden
                                className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`}
                              />
                              {meta.label}
                            </span>
                          </div>
                        </div>
                        <div className="ml-auto shrink-0">
                          <VersionRowMenu
                            versionSequence={version.sequence}
                            previewUrl={version.previewUrl}
                            canPublish={canPublish}
                            canRequestLive={canRequestLive}
                            publishAction={publishVersion.bind(null, version.sequence)}
                            requestLiveAction={requestVersionLive.bind(null, version.sequence)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {/* ── Code panel (one-time only) — the source they own, its own tab. ── */}
          {!isMembershipPlan && latestVersion && (
            <div data-panel="code">
              <WorkspaceCodePanel />
            </div>
          )}

          {/* ── Domains panel — the client SEES + REQUESTS, the team operates. ── */}
          {appPublishedUrl && (
            <div data-panel="domain">
              <section className="rounded-[6px] border border-border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-2.5">
                  <h2 className="text-sm font-medium">Domains</h2>
                  {/* Both dialogs hand off to the Chat with the request typed —
                      the channel that actually reaches the team (registrar
                      purchase + connect automation are #27/#28). */}
                  <AddDomainButtons viaChat hidden={membershipEnded} />
                </div>
                <div className="p-5">
                  {/* The search earns its place from 5 domains up. */}
                  {domainRows.length >= 5 && (
                    <div className="relative mb-4">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60"
                        strokeWidth={1.75}
                      />
                      <input
                        type="text"
                        placeholder="Search any domain"
                        aria-label="Search domains"
                        className="w-full rounded-[6px] border border-border bg-transparent py-2 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus-visible:border-foreground/30"
                      />
                    </div>
                  )}

                  <ul className="divide-y divide-border overflow-hidden rounded-[6px] border border-border">
                    {domainRows.map((d) => {
                      const st = DOMAIN_STATUS[d.status];
                      return (
                        <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <a
                                href={d.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="break-all font-mono text-sm underline-offset-4 hover:underline"
                              >
                                {d.domain}
                              </a>
                              <WorkspaceCopyButton
                                value={d.domain}
                                label="Copy domain"
                                className="h-5 w-5"
                              />
                              <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground">
                                <span
                                  aria-hidden
                                  className={`h-2 w-2 shrink-0 rounded-full ${st.dot}`}
                                />
                                {st.label}
                              </span>
                              {d.isDefault && (
                                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[12px] text-muted-foreground">{st.detail}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground/70">
                    Want your brand&apos;s domain (like yourbrand.com)? Your Noon team sets it up
                    end to end — you never touch any DNS.
                  </p>
                </div>
              </section>
            </div>
          )}
        </WorkspaceTabs>
      </div>
    </div>
  );
}
