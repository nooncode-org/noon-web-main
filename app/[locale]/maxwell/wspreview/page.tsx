/**
 * DEV-ONLY workspace preview — renders the client workspace (/maxwell/workspace)
 * with hard-coded MOCK data so the front can be iterated locally WITHOUT Postgres
 * (the real page is a force-dynamic server component that reads the DB).
 *
 * KEPT PERMANENTLY as the owner's design playground (decision 2026-07-21 —
 * replaces the earlier delete-before-commit rule): it's where front changes are
 * prototyped and pointed at before porting them to the real page
 * (app/[locale]/maxwell/workspace/[sessionId]/page.tsx) in one reviewed step.
 * Safe to commit because it is HARD-GATED below: outside `next dev` it 404s, so
 * no mock surface is ever reachable in production or previews. Also unlinked +
 * robots-noindexed. States: ?state=active (default) | new | preparing | pastdue
 * | stress | unlocked | onetime.
 */
import { notFound } from "next/navigation";
import { Search } from "lucide-react";
import { YourCodeCard, MembershipUpsellCard } from "@/components/maxwell/workspace-onetime-cards";
import { getContactHref } from "@/lib/site-config";
import {
  mapMembershipStatusToMeta,
  mapProjectStatusToMeta,
  formatProposalAmount,
} from "@/lib/maxwell/project-status-labels";
import {
  isPublishableVersionState,
  mapVersionStateToMeta,
} from "@/lib/maxwell/version-status-labels";
import type { ProjectStatusVersion } from "@/lib/maxwell/project-status-types";
import { ROLLBACK_REQUEST_ENABLED } from "@/lib/maxwell/client-requests";
import { MEMBERSHIP_BILLING_ENABLED } from "@/lib/maxwell/membership-billing";
import { ProposalSidebar } from "@/components/maxwell/proposal-sidebar";
import { WorkspaceTabs } from "@/components/maxwell/workspace-tabs";
import { RequestChangeChip } from "@/components/maxwell/workspace-quick-access";
import { VisitButton } from "@/components/maxwell/visit-button";
import { WorkspacePreparingBody } from "@/components/maxwell/workspace-preparing-body";
import { AddDomainButtons } from "@/components/maxwell/workspace-add-domain";
import { DomainSetupButton } from "@/components/maxwell/workspace-domain-setup";
import { DomainRowMenu } from "@/components/maxwell/workspace-domain-menu";
import { VersionRowMenu } from "@/components/maxwell/workspace-version-menu";
import { WorkspaceChat } from "@/components/maxwell/workspace-chat";
import { WorkspaceProjectTitle } from "@/components/maxwell/workspace-project-title";
import { NoonMark } from "@/components/brand/noon-logo";
import { VersionReviewBanner } from "@/components/maxwell/workspace-version-review-banner";
import { WorkspaceNotifications, type WorkspaceNotification } from "@/components/maxwell/workspace-notifications";
import { WorkspaceHelpMenu } from "@/components/maxwell/workspace-help-menu";
import { StarterChecklist } from "@/components/maxwell/workspace-starter-checklist";
import { WorkspaceCopyButton } from "@/components/maxwell/workspace-copy-button";
import { ManageMembershipButton } from "../workspace/[sessionId]/_components/manage-membership-button";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

// Relative time ("2 days ago", "just now") — Vercel-style, feels more alive than
// a raw date. The exact date stays available via a title tooltip on the value.
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

// Domain status → label + detail + colored dot (replaces Vercel's "Production"
// env concept, meaningless to a Noon client). Same dot+label treatment as the
// Versions tab + hero phase — no chip. Colors: amber = working, blue =
// verifying, green = live, red = attention.
type DomainStatus = "valid" | "pending" | "verifying" | "action_needed";
const DOMAIN_STATUS: Record<
  DomainStatus,
  { label: string; detail: string; dot: string }
> = {
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

// Version + team-written release note ("what changed in this build") — the
// client's decision support when reviewing (ref-backed, 2026-07-19). The wire
// type doesn't carry it yet: logic-later, the App sends it per version.
type MockVersion = ProjectStatusVersion & { notes?: string };

// ── MOCK DATA (edit freely to preview different states) ────────────────────
const MOCK = {
  viewerEmail: "dev@noon.dev",
  viewerName: "María Torres",
  sessionId: "preview-session",
  projectName: "Ops dashboard for field teams",
  appPublishedUrl: "https://opsdash.nooncode.dev" as string | null,
  adminUrl: "https://opsdash.nooncode.dev/admin" as string | null,
  invoiceUrl: "https://pay.nooncode.dev/receipt/INV-0042" as string | null,
  proposal: { title: "Ops dashboard", amount: 4500, currency: "USD" },
  latestUpdateSummary: "v2 shipped — dashboards + role-based access are live.",
  createdAt: "2026-07-10T09:00:00Z",
  statusUpdatedAt: "2026-07-16T18:05:00Z",
  projectStatus: "in_development",
  membershipStatus: "active",
  plan: {
    paymentModality: "membership" as "membership" | "one_time",
    monthlyAmountUsd: 200 as number | null,
    approvedAmountUsd: 4500 as number | null,
    approvedCurrency: "USD",
    stripeCustomerId: "cus_mock" as string | null,
    // The most-asked billing question, answered inline (audit P1-8).
    nextPaymentAt: "2026-08-01T12:00:00Z" as string | null,
  },
  versions: [
    // v3 awaits the client's decision → drives the review banner on Overview
    // (audit P0-2) + the amber action dot on the Versions tab.
    { sequence: 3, state: "ready_for_client_preview", previewUrl: "https://v3.preview.nooncode.dev", at: "2026-07-18T15:00:00Z", notes: "Bigger header logo, taller jobs chart, and your brand blue across the UI." },
    { sequence: 2, state: "published", previewUrl: "https://v2.preview.nooncode.dev", at: "2026-07-16T18:00:00Z", published: true, notes: "Dashboards and role-based access for your field teams." },
    { sequence: 1, state: "previous_published", previewUrl: "https://v1.preview.nooncode.dev", at: "2026-07-14T12:00:00Z", notes: "First working version — core flows and your brand kit applied." },
  ] as MockVersion[],
  // Vercel-style domain list ("front only, logic later" — owner 2026-07-17).
  // One row per status on purpose so every state is visible in the mock: the
  // live nooncode.dev default + custom domains mid-setup.
  domains: [
    { id: "dom1", domain: "opsdash.nooncode.dev", status: "valid" as DomainStatus, url: "https://opsdash.nooncode.dev" as string | null, isDefault: true },
    { id: "dom2", domain: "opsdash.com", status: "verifying" as DomainStatus, url: null as string | null, isDefault: false },
    { id: "dom3", domain: "www.opsdash.com", status: "pending" as DomainStatus, url: null as string | null, isDefault: false },
    { id: "dom4", domain: "opsdash.io", status: "action_needed" as DomainStatus, url: null as string | null, isDefault: false },
  ],
};

// New-client variant (?state=new): the workspace is provisioned but the team is
// still building v1 — no preview, no live site, no custom domains yet. One toggle
// exercises every empty state at once (hero "first preview coming", the Versions
// + Domains tabs absent, and a fresh chat with just Maxwell's greeting).
const MOCK_NEW = {
  ...MOCK,
  appPublishedUrl: null,
  adminUrl: null,
  invoiceUrl: null,
  latestUpdateSummary: "Your Noon team is building version 1 of your project.",
  versions: [] as MockVersion[],
  domains: [] as typeof MOCK.domains,
};

// Failed-payment variant (?state=pastdue): the dunning banner + the Plan card's
// past_due chip, without touching anything else (audit P0-3).
const MOCK_PASTDUE = {
  ...MOCK,
  membershipStatus: "past_due",
};

// Stress variant (?state=stress) — QA tool: real-world extreme content (long
// names, 12 versions, verbose notes, long domains) to catch truncation/wrap
// breaks that polite mock copy hides. Clients don't write like mocks.
const MOCK_STRESS = {
  ...MOCK,
  projectName:
    "Operations dashboard for field teams with offline sync, multi-region support and a partner-facing portal (Phase 2)",
  viewerName: "María Fernanda Torres Aristizábal de la Rosa",
  versions: Array.from({ length: 12 }, (_, i) => {
    const sequence = 12 - i;
    const day = String(Math.max(1, 18 - i)).padStart(2, "0");
    if (sequence === 12) {
      return {
        sequence,
        state: "ready_for_client_preview",
        previewUrl: "https://v12.preview.nooncode.dev",
        at: `2026-07-${day}T15:00:00Z`,
        notes:
          "Reworked the field-team scheduling flow end to end: drag-to-reassign jobs across teams, conflict warnings when two crews overlap, offline-first sync for spotty coverage areas, and the partner portal now shows live job status with your brand blue across every screen.",
      };
    }
    return {
      sequence,
      state: sequence === 11 ? "published" : "previous_published",
      previewUrl: `https://v${sequence}.preview.nooncode.dev`,
      at: `2026-07-${day}T12:00:00Z`,
      published: sequence === 11 ? true : undefined,
      notes:
        sequence % 3 === 0
          ? "Bug fixes and performance improvements across the dashboard."
          : `Iteration ${sequence} — scheduling, reports, and access tweaks from your feedback.`,
    };
  }) as MockVersion[],
  domains: [
    ...MOCK.domains,
    {
      id: "dom5",
      domain: "really-long-subdomain-for-partner-integrations.opsdash-operations-international.com",
      status: "verifying" as DomainStatus,
      url: null as string | null,
      isDefault: false,
    },
  ],
};

// One-time-buyer variant (?state=onetime): the client paid ONCE for the build —
// no membership. Owner model (2026-07-22): they get the SAME portal but
// READ-REDUCED — they see project STATUS and manage the HOST + DOMAIN they pay
// yearly, but NOT the continuous-collaboration tools (the change-request chat,
// approving/publishing new versions) that are what a membership buys. This mock
// shows a delivered, live project: everything settled, nothing awaiting them.
const MOCK_ONETIME = {
  ...MOCK,
  projectStatus: "delivered",
  latestUpdateSummary: "Your project is delivered and live.",
  plan: {
    ...MOCK.plan,
    paymentModality: "one_time" as "membership" | "one_time",
    monthlyAmountUsd: null,
  },
  // Nothing awaits the client's approval — they don't drive the build anymore.
  versions: [
    { sequence: 2, state: "published", previewUrl: "https://v2.preview.nooncode.dev", at: "2026-07-16T18:00:00Z", published: true, notes: "Dashboards and role-based access for your field teams." },
    { sequence: 1, state: "previous_published", previewUrl: "https://v1.preview.nooncode.dev", at: "2026-07-14T12:00:00Z", notes: "First working version — core flows and your brand kit applied." },
  ] as MockVersion[],
};

function ActiveWorkspace({
  locale,
  data,
  advancedUnlocked = false,
}: {
  locale: string;
  data: typeof MOCK;
  advancedUnlocked?: boolean;
}) {
  const orderedVersions = [...data.versions].sort((a, b) => b.sequence - a.sequence);
  const latestVersion = orderedVersions[0] ?? null;
  const latestVersionMeta = latestVersion ? mapVersionStateToMeta(latestVersion.state) : null;
  const previewHref = latestVersion?.previewUrl ?? null;
  const appPublishedUrl = data.appPublishedUrl;
  // Build-phase status: label + a color-coded dot (amber → blue → green) so the
  // client reads where their project is at a glance, right on the hero title.
  const phase = appPublishedUrl
    ? { label: "In production", dot: "bg-emerald-500" }
    : latestVersion
      ? { label: "In review", dot: "bg-[#0056fd]" }
      : { label: "In progress", dot: "bg-amber-500" };
  const statusCfg = mapProjectStatusToMeta(data.projectStatus);
  const membershipMeta = mapMembershipStatusToMeta(data.membershipStatus);
  const isMembershipPlan = data.plan.paymentModality === "membership";
  // One-time = the reduced portal: status + host/domain, no change-collaboration.
  const isOneTime = !isMembershipPlan;
  const planCurrency = data.plan.approvedCurrency;
  // A version awaiting the client's decision → the Overview review banner.
  const reviewVersion =
    latestVersion?.state === "ready_for_client_preview" ? latestVersion : null;
  const isPastDue = isMembershipPlan && data.membershipStatus === "past_due";
  // Notifications feed (audit P0-4, reshaped to a header bell 2026-07-19) — mock
  // items; real source is the same per-section "what's new" feed that powers the
  // tab dots. A fresh client gets a short welcome list; an active one gets the
  // event history (versions, domains, billing, chat).
  const notifications: WorkspaceNotification[] = isOneTime
    ? // One-time: chat + delivery + build/domain events. No membership-BILLING
      // items (they're not a membership) — but the chat is theirs, so chat
      // replies belong here.
      [
        { id: "o1", kind: "chat", title: "New reply from Carlos", detail: "“Here's your getting-started guide so you can run everything yourself.”", at: "2h ago", tab: "chat", unread: true },
        { id: "o2", kind: "milestone", title: "Your project is delivered", detail: "It's live and it's yours.", at: "3d ago", tab: "overview", unread: true },
        { id: "o3", kind: "version", title: "Version 2 published", detail: "Dashboards + role-based access are live.", at: "6d ago", tab: "versions" },
        { id: "o4", kind: "domain", title: "opsdash.com verified", detail: "Your custom domain is connected.", at: "1w ago", tab: "domain" },
      ]
    : data.versions.length >= 12
      ? // Stress: 20 items → exercises the panel's scroll + unread count.
        Array.from({ length: 20 }, (_, i) => ({
          id: `s${i}`,
          kind: (["chat", "version", "domain", "billing", "milestone"] as const)[i % 5],
          title:
            i % 5 === 0
              ? "New reply from Carlos about the partner portal scheduling flow"
              : i % 5 === 1
                ? `Version ${12 - (i % 12)} is ready for your review`
                : i % 5 === 2
                  ? "really-long-subdomain-for-partner-integrations.opsdash-operations-international.com verified"
                  : i % 5 === 3
                    ? "Payment received — $200"
                    : "Milestone reached — first preview delivered",
          at: `${i + 1}d ago`,
          tab: (["chat", "versions", "domain", "overview", "overview"] as const)[i % 5],
          unread: i < 6,
        }))
      : data.versions.length > 0
      ? [
          { id: "n1", kind: "chat", title: "New reply from Carlos", detail: "“I’ll have the header fix in v3 shortly.”", at: "2h ago", tab: "chat", unread: true },
          { id: "n2", kind: "version", title: "Version 3 is ready for your review", at: "1d ago", tab: "versions", unread: true },
          { id: "n3", kind: "domain", title: "opsdash.com verified", detail: "Your custom domain is connected.", at: "2d ago", tab: "domain" },
          { id: "n4", kind: "version", title: "Version 2 published", detail: "Dashboards + role-based access are live.", at: "3d ago", tab: "versions" },
          { id: "n5", kind: "billing", title: "Payment received — $200", detail: "Membership renewed for July.", at: "Jul 1", tab: "overview" },
        ]
      : [
          { id: "n1", kind: "milestone", title: "Welcome to your project", detail: "Your Noon team has kicked off the build.", at: "1d ago", tab: "overview", unread: true },
        ];

  const milestonesList = [
    { label: "Kickoff", done: true },
    { label: "First preview", done: data.versions.length > 0 },
    { label: "Delivery", done: data.projectStatus === "delivered" || data.projectStatus === "completed" },
    { label: "Live", done: Boolean(appPublishedUrl) },
  ];
  const milestonesDone = milestonesList.filter((m) => m.done).length;

  // Consolidated to 4 tabs (owner 2026-07-18). Chat is the centerpiece → first +
  // default landing. Brand-assets folded into the Chat (share files there);
  // Support/Activity/Quick-access all absorbed by the Chat.
  const sections = [
    { id: "overview", label: "Overview" },
    // `pending` demo (front-only): Chat has 2 unread replies (blue count, clears
    // on open); Versions has a build waiting for approval (amber, an action →
    // stays until resolved). Chat is present for BOTH plans (owner 2026-07-22:
    // one-time keeps the chat too — their support + build-handoff channel).
    { id: "chat", label: "Chat", pending: "unread" as const, count: 2 },
    ...(data.versions.length > 0
      ? [{ id: "versions", label: "Versions", ...(isMembershipPlan ? { pending: "action" as const } : {}) }]
      : []),
    ...(appPublishedUrl ? [{ id: "domain", label: "Domains" }] : []),
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ProposalSidebar
        viewerEmail={data.viewerEmail}
        viewerName={data.viewerName}
        locale={locale}
        collapsibleRail
        settings={{
          invoiceUrl: data.invoiceUrl,
          isMembership: isMembershipPlan,
          membershipBadge: isMembershipPlan
            ? { label: membershipMeta.label, color: membershipMeta.color }
            : null,
          advancedUnlocked,
        }}
      />

      <div className="min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border bg-card px-6 pl-14 lg:px-14">
          <div className="flex w-full items-center gap-4">
            {/* Status lives on the hero title now (label + color dot); no second
                status chip here to contradict it. Header = just the project. */}
            <h1 className="min-w-0 flex-1">
              <WorkspaceProjectTitle initialTitle={data.projectName} />
            </h1>
            {/* Header utilities: notifications (events history) + help. Grouped
                tight; the 4-tab consolidation stays — these aren't sections. */}
            <div className="flex shrink-0 items-center gap-0.5">
              <WorkspaceNotifications items={notifications} />
              <WorkspaceHelpMenu isMembership={isMembershipPlan} />
            </div>
          </div>
        </header>

        {/* Dunning banner — a failed membership payment is the one thing that
            must interrupt everything (audit P0-3). TODO(logic later): the CTA
            opens the Stripe billing portal (same as Manage membership). */}
        {isPastDue && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-500/30 bg-red-500/[0.07] px-6 py-3 lg:px-14">
            <p className="text-sm text-red-700 dark:text-red-300">
              <span className="font-medium">Your last payment didn&apos;t go through.</span>{" "}
              Update your payment method to keep your project active.
            </p>
            <a
              href="#"
              className="shrink-0 rounded-[6px] bg-red-600 px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-red-700"
            >
              Update payment {"->"}
            </a>
          </div>
        )}

        <WorkspaceTabs tabs={sections}>
          {/* ── Overview panel ── */}
          <div data-panel="overview" className="space-y-5">
            {/* The client's #1 recurring decision, surfaced first-class — only a
                membership client approves versions; a one-time buyer doesn't
                drive the build. */}
            {reviewVersion && isMembershipPlan && (
              <VersionReviewBanner
                sequence={reviewVersion.sequence}
                previewUrl={reviewVersion.previewUrl}
                notes={reviewVersion.notes}
              />
            )}
            <section className="overflow-hidden rounded-[6px] border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-2.5">
                {/* Dot LEADS the label — same status vocabulary as the Versions
                    row, Domains row, and hero Version sub-label (and Vercel's
                    deployment header). Kept `font-medium` (prominent) because
                    this is the page's headline status, not a muted row label. */}
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${phase.dot}`} aria-hidden />
                  <p className="text-sm font-medium">{phase.label}</p>
                </div>
                {/* RIGHT-EDGE RULE — FINAL (after trying pulls, owner reverted):
                    everything sits AT the card padding line. No -mr pulls. */}
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
                          <a href={appPublishedUrl} target="_blank" rel="noopener noreferrer" className="min-w-0 break-all font-mono text-[13px] underline-offset-4 hover:underline">
                            {appPublishedUrl.replace(/^https?:\/\//, "")}
                          </a>
                          <WorkspaceCopyButton value={appPublishedUrl} label="Copy site URL" />
                        </div>
                        {/* Admin login = a small link in the hero now (was a Quick-access tile). */}
                        {data.adminUrl && (
                          <a
                            href={data.adminUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                          >
                            Admin login {"->"}
                          </a>
                        )}
                      </div>
                    )}
                    <div>
                      <p className="text-[13px] text-muted-foreground">Version</p>
                      <div className="mt-1 text-sm text-foreground">
                        <span className="inline-flex items-center gap-2">
                          v{latestVersion.sequence}
                          {latestVersionMeta && (
                            <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                              <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${latestVersionMeta.dot}`} />
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
                    <div>
                      <p className="text-[13px] text-muted-foreground">Proposal</p>
                      <div className="mt-1 text-sm text-foreground">
                        {data.proposal.title} · {formatProposalAmount(data.proposal.amount, data.proposal.currency)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
                  {/* No preview yet — reuse the browser-wireframe motif at low
                      emphasis (dashed = placeholder), NOT a spinner: v1 takes
                      days, so a spinner would wrongly imply this page resolves it.
                      Compact paddings (audit "sobra" #4): the previous py-14 +
                      280px art left a hole where reassurance should be. */}
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
                    <p className="text-sm font-medium">Your first preview is on the way</p>
                    <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
                      Your Noon team is building version 1 — it&apos;ll appear here the moment
                      it&apos;s ready, and you&apos;ll get an email.
                    </p>
                    {/* The "when" — explicit expectations kill refresh anxiety
                        (audit P0-1). TODO(logic later): real per-project ETA. */}
                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/30 px-3 py-1 text-[12px] font-medium text-muted-foreground">
                      First preview: usually 3–5 business days
                    </p>
                  </div>
                </div>
              )}

              {/* One status voice (audit "sobra" #2): the hero already carries
                  the phase dot + version state + "Updated X ago" — the fourth
                  "Status updated <date>" repeated the same fact and is gone. */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
                <p className="text-[13px] text-muted-foreground">{data.latestUpdateSummary ?? statusCfg.description}</p>
                {/* One-time has no "request a change" — that channel is the
                    membership. The upsell card below is their path instead. */}
                {isMembershipPlan && <RequestChangeChip />}
              </div>
            </section>

            {/* ── One-time cards (shared with the real page): Your code (they
                  own the build) + the membership upsell (sells ongoing
                  development; monthly ALONE — activation already paid). Both
                  actions hand off to the Chat with the request typed. ── */}
            {isOneTime && <YourCodeCard />}
            {isOneTime && (
              <MembershipUpsellCard
                delivered={Boolean(appPublishedUrl)}
                monthlyAmountUsd={200}
                currency={planCurrency}
              />
            )}

            {/* "While you wait" — agency during the v1 build; fresh state only
                (same condition as the chat's fresh greeting). */}
            {data.versions.length === 0 && !appPublishedUrl && <StarterChecklist />}

            {/* ── Overview cards — Milestones (progress) + Plan (billing). The old
                  "This project" stat card + Quick-access row were cut (owner
                  2026-07-18): Message=Chat, Visit=hero, Admin=hero link,
                  Invoice=this Plan card. ── */}
            <section className="grid gap-5 md:grid-cols-2">
              <div className="rounded-[6px] border border-border bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-medium">Milestones</p>
                  <span className="text-[13px] text-muted-foreground">{milestonesDone}/{milestonesList.length}</span>
                </div>
                <div className="space-y-2">
                  {milestonesList.map((m) => (
                    <div key={m.label} className="flex items-center gap-2.5 rounded-[6px] border border-border px-3 py-2">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${m.done ? "bg-emerald-500" : "bg-foreground/15"}`} />
                      <span className={`text-[13px] ${m.done ? "text-muted-foreground" : "text-foreground"}`}>{m.label}</span>
                      {m.done && <span className="ml-auto text-[11px] text-muted-foreground/70">Done</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[6px] border border-border bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-medium">Plan</p>
                  {/* Membership-status badge only for a membership — a one-time
                      plan has no membership state to show. */}
                  {isMembershipPlan && membershipMeta && (
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${membershipMeta.color}`}>
                      {membershipMeta.label}
                    </span>
                  )}
                </div>
                <p className="text-xl font-semibold tracking-tight">
                  {isMembershipPlan ? "Membership" : "One-time"}
                  {isMembershipPlan && data.plan.monthlyAmountUsd != null && (
                    <span className="text-sm font-normal text-muted-foreground"> · {formatProposalAmount(data.plan.monthlyAmountUsd, planCurrency)}/mo</span>
                  )}
                  {!isMembershipPlan && data.plan.approvedAmountUsd != null && (
                    <span className="text-sm font-normal text-muted-foreground"> · {formatProposalAmount(data.plan.approvedAmountUsd, planCurrency)}</span>
                  )}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {isMembershipPlan
                    ? membershipMeta
                      ? membershipMeta.description
                      : "Monthly membership is coordinated with your Noon PM."
                    : "Paid once for the build. Your hosting and domain renew yearly to keep it online."}
                </p>
                {/* The most-asked billing question, answered before it's asked
                    (audit P1-8). Only when the membership is in good standing —
                    past_due shows the dunning banner instead. */}
                {isMembershipPlan && data.membershipStatus === "active" && data.plan.nextPaymentAt && (
                  <p className="mt-2 text-[12px] text-muted-foreground/80">
                    Next payment: <span className="text-foreground">{formatDate(data.plan.nextPaymentAt)}</span>
                  </p>
                )}
                {/* "Manage membership" (Stripe portal) is membership-only. A
                    one-time buyer falls through to their build receipt — their
                    yearly host/domain billing is a separate surface (decision #3,
                    still open). */}
                {isMembershipPlan && MEMBERSHIP_BILLING_ENABLED && data.plan.stripeCustomerId ? (
                  <div className="mt-4">
                    <ManageMembershipButton sessionId={data.sessionId} />
                    <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground/70">
                      Invoices, payment method, and cancellation — handled securely via Stripe.
                    </p>
                  </div>
                ) : (
                  data.invoiceUrl && (
                    <a
                      href={data.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-1.5 rounded-[6px] border border-border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-secondary/40"
                    >
                      View invoice {"->"}
                    </a>
                  )
                )}
              </div>
            </section>
          </div>

          {/* ── Versions panel — absent for a brand-new client (no versions yet):
                the tab is gated out of `sections`; this guards the panel to match
                (WorkspaceTabs hides orphan panels, but don't mount a dead one). ── */}
          {data.versions.length > 0 && (
          <div data-panel="versions">
            <section className="rounded-[6px] border border-border bg-card">
              <div className="border-b border-border px-5 py-3.5">
                <h2 className="text-sm font-medium">Versions</h2>
              </div>
              <div className="divide-y divide-border">
                {orderedVersions.map((version) => {
                  const meta = mapVersionStateToMeta(version.state);
                  // Scope the two version actions so they NEVER overlap in one menu:
                  // the client PUBLISHES a fresh preview forward directly, but only
                  // ASKS the team to reactivate an older, already-published version
                  // (reactivation = a rollback = staff authority → a request, not a
                  // direct act). A live/published version gets neither.
                  // One-time buyer: versions are read-only (open the preview,
                  // nothing else) — publishing + reactivating are build actions
                  // that belong to a membership.
                  const canPublish =
                    isMembershipPlan && version.state === "ready_for_client_preview";
                  const canRequestLive =
                    isMembershipPlan &&
                    ROLLBACK_REQUEST_ENABLED &&
                    isPublishableVersionState(version.state) &&
                    version.state !== "ready_for_client_preview";
                  return (
                    <div key={version.sequence} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-sm font-medium">Version {version.sequence}</p>
                          <span className="text-[11px] text-muted-foreground/70">{formatDate(version.at)}</span>
                          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                            <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </span>
                        </div>
                        {/* Team-written release note — the client's decision
                            support ("what changed in this build"). */}
                        {version.notes && (
                          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                            {version.notes}
                          </p>
                        )}
                      </div>
                      <div className="ml-auto shrink-0">
                        <VersionRowMenu
                          versionSequence={version.sequence}
                          previewUrl={version.previewUrl}
                          canPublish={canPublish}
                          canRequestLive={canRequestLive}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
          )}

          {/* ── Domains panel — Vercel-style LIST only (front only, logic later).
                No inline edit form: in our model the client SEES + REQUESTS,
                the Noon team operates (env/redirect/DNS config = operator tools
                that don't fit — owner call 2026-07-17). ── */}
          {appPublishedUrl && (
            <div data-panel="domain">
              <section className="rounded-[6px] border border-border bg-card">
                {/* The actions ride the title bar, hard right (owner 2026-07-21)
                    — they were on their own line below, which cost a whole row
                    of height and read as a second, weaker toolbar. */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-2.5">
                  <h2 className="text-sm font-medium">Domains</h2>
                  <AddDomainButtons />
                </div>
                <div className="p-5">
                  {/* The search only earns its place from 5 domains up (audit
                      "sobra" #1): a client with 2-4 rows scans faster than they
                      type — below that it's noise copied from Vercel's scale. */}
                  {data.domains.length >= 5 && (
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
                    {data.domains.map((d) => {
                      const st = DOMAIN_STATUS[d.status];
                      return (
                        <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {d.url ? (
                                <a
                                  href={d.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="break-all font-mono text-sm underline-offset-4 hover:underline"
                                >
                                  {d.domain}
                                </a>
                              ) : (
                                <span className="break-all font-mono text-sm">{d.domain}</span>
                              )}
                              <WorkspaceCopyButton value={d.domain} label="Copy domain" className="h-5 w-5" />
                              {/* Status = colored dot + label, no chip — identical
                                  to the Versions tab + hero phase (and how Vercel
                                  shows domain state). */}
                              <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground">
                                <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
                                {st.label}
                              </span>
                              {/* Default = the always-present nooncode.dev domain
                                  (can't be disconnected); a neutral marker, not a
                                  status. */}
                              {d.isDefault && (
                                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[12px] text-muted-foreground">
                              {st.detail}
                            </p>
                          </div>
                          {/* No "Visit" button: the domain name itself is the link.
                              Action-needed rows get a "Finish setup" CTA (DNS
                              records self-serve OR hand it to the team). */}
                          {d.status === "action_needed" && (
                            <DomainSetupButton
                              domain={d.domain}
                              contactHref={getContactHref({ inquiry: "custom-domain", source: "workspace" })}
                            />
                          )}
                          {/* "…" menu with Disconnect — custom domains only; the
                              default nooncode.dev one can't be disconnected. */}
                          {!d.isDefault && <DomainRowMenu domain={d.domain} />}
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

          {/* ── Chat panel — one "chat with Noon" (Maxwell + dev), the portal's
                centerpiece: replaces the old Support tab (Requests + Messages),
                the Brand-assets tab (share files here), and Activity (the thread
                IS the timeline). Present for BOTH plans (owner 2026-07-22): the
                one-time buyer keeps the chat as their support + build-handoff
                channel; what membership adds is ongoing DEVELOPMENT, not the chat. ── */}
          <div data-panel="chat">
            <WorkspaceChat
              fresh={data.versions.length === 0 && !data.appPublishedUrl}
              oneTime={isOneTime}
              siteUrl={appPublishedUrl ?? undefined}
            />
          </div>
        </WorkspaceTabs>
      </div>
    </div>
  );
}

// Mirrors the real page's WorkspacePreparing: the shared body (the REAL
// component) under mock chrome. Only the brief "provisioning" blip renders on
// the workspace now — not-yet-paid clients get redirected to their proposal.
function PreparingWorkspace({ locale, data }: { locale: string; data: typeof MOCK }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ProposalSidebar viewerEmail={data.viewerEmail} locale={locale} collapsibleRail />
      <div className="min-w-0 flex-1 overflow-y-auto">
        <header className="flex h-14 items-center border-b border-border bg-card px-6 pl-14 lg:px-14">
          <div className="flex w-full items-center justify-between gap-4">
            <h1 className="min-w-0 truncate text-base font-medium leading-tight">{data.projectName}</h1>
            <span className="shrink-0 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700">
              Preparing workspace
            </span>
          </div>
        </header>
        <WorkspacePreparingBody contactHref={getContactHref()} />
      </div>
    </div>
  );
}

export default async function WorkspacePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  // The hard gate that makes this page committable: anywhere but `next dev`
  // (prod AND preview builds) it plain doesn't exist.
  if (process.env.NODE_ENV !== "development") notFound();

  const { locale } = await params;
  const { state } = await searchParams;

  // Dev-only variants: ?state=preparing (post-payment provisioning), ?state=new
  // (a just-provisioned client — every empty state at once), ?state=pastdue
  // (failed membership payment — the dunning banner). Default is the fully-
  // populated active workspace. No on-screen toggle (it overlapped the chat
  // composer); flip via the query string.
  if (state === "preparing") return <PreparingWorkspace locale={locale} data={MOCK} />;
  const data =
    state === "new"
      ? MOCK_NEW
      : state === "pastdue"
        ? MOCK_PASTDUE
        : state === "stress"
          ? MOCK_STRESS
          : state === "onetime"
            ? MOCK_ONETIME
            : MOCK;
  // ?state=unlocked previews what a client sees AFTER the team enables the
  // Advanced actions for them; everyone else gets them locked.
  return (
    <ActiveWorkspace locale={locale} data={data} advancedUnlocked={state === "unlocked"} />
  );
}
