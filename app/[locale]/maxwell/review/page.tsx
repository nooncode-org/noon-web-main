import Link from "next/link";
import type { Metadata } from "next";
import { signOutAction } from "@/app/[locale]/signin/actions";
import { getReviewPageAccess } from "./_actions/auth";
import { ReviewLogin } from "./_components/review-login";
import { StatusBadge } from "./_components/status-badge";
import { getProposalRequestsWithSession } from "@/lib/maxwell/repositories";
import type { ProposalStatus, ProposalWithSession } from "@/lib/maxwell/repositories";
import { getStudioStatusLabel } from "@/lib/maxwell/studio-status";

export const metadata: Metadata = {
  title: "Review Panel - Noon",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const NEEDS_ATTENTION: ProposalStatus[] = ["pending_review", "payment_under_verification"];
const IN_PROGRESS: ProposalStatus[] = ["under_review", "sent", "payment_pending"];
const CLOSED: ProposalStatus[] = ["paid", "expired", "returned", "escalated"];

function groupProposals(proposals: ProposalWithSession[]) {
  return {
    needsAttention: proposals.filter((proposal) => NEEDS_ATTENTION.includes(proposal.status)),
    inProgress: proposals.filter((proposal) => IN_PROGRESS.includes(proposal.status)),
    closed: proposals.filter((proposal) => CLOSED.includes(proposal.status)),
  };
}

function isExpiringSoon(iso: string): boolean {
  // Server-rendered helper (Date.now() captured at request time, not per JSX evaluation).
  return new Date(iso).getTime() < Date.now() + 3 * 24 * 60 * 60 * 1000;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatDateShort(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function ProposalCard({ proposal }: { proposal: ProposalWithSession }) {
  const isUrgent = NEEDS_ATTENTION.includes(proposal.status);
  const title = proposal.sessionGoalSummary ?? proposal.sessionInitialPrompt;

  return (
    <Link
      href={`/maxwell/review/${proposal.id}`}
      className={`group block rounded-xl border bg-card p-5 transition-all hover:border-foreground/20 hover:bg-secondary/20 ${
        isUrgent ? "border-orange-500/30" : "border-border"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="line-clamp-2 flex-1 text-sm font-medium leading-snug">{title}</p>
        <StatusBadge status={proposal.status} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="font-mono">{proposal.id.slice(0, 8)}</span>
        <span>{formatDateShort(proposal.createdAt)}</span>
        <span className="rounded bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px]">
          {getStudioStatusLabel(proposal.sessionStatus)}
        </span>
        {proposal.expiresAt && isExpiringSoon(proposal.expiresAt) && (
          <span className="font-medium text-orange-500">
            Expires {formatDate(proposal.expiresAt)}
          </span>
        )}
      </div>
    </Link>
  );
}

function Section({
  title,
  proposals,
  emptyMessage,
}: {
  title: string;
  proposals: ProposalWithSession[];
  emptyMessage: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          {title}
        </h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
          {proposals.length}
        </span>
      </div>
      {proposals.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {proposals.map((proposal) => (
            <ProposalCard key={proposal.id} proposal={proposal} />
          ))}
        </div>
      )}
    </section>
  );
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReviewPage({ searchParams }: Props) {
  const access = await getReviewPageAccess();
  if (!access.authorized) {
    await searchParams;
    return (
      <ReviewLogin
        reason={access.reason}
        redirectTo="/maxwell/review"
        viewerEmail={access.viewer?.email ?? null}
      />
    );
  }

  const proposals = await getProposalRequestsWithSession({ limit: 200 });
  const { needsAttention, inProgress, closed } = groupProposals(proposals);
  const pendingCount = needsAttention.length;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="text-xs font-mono text-muted-foreground">noon / maxwell</p>
            <h1 className="text-lg font-display">
              Review Panel
              {pendingCount > 0 && (
                <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground md:inline">
              {access.viewer.email}
            </span>
            <span className="text-sm text-muted-foreground">
              {proposals.length} proposal{proposals.length !== 1 ? "s" : ""}
            </span>
            <form action={signOutAction}>
              <input type="hidden" name="redirectTo" value="/signin?redirectTo=%2Fmaxwell%2Freview" />
              <button
                type="submit"
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-10 px-6 py-8">
        <Section
          title="Needs attention"
          proposals={needsAttention}
          emptyMessage="Nothing pending review."
        />
        <Section
          title="In progress"
          proposals={inProgress}
          emptyMessage="No active proposals."
        />
        <Section title="Closed" proposals={closed} emptyMessage="No closed proposals yet." />
      </div>
    </div>
  );
}
