import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProposalDocument } from "@/components/maxwell/proposal-document";
import { PublicProposalPayment } from "@/components/maxwell/public-proposal-payment";
import { StatusBadge } from "@/app/[locale]/maxwell/review/_components/status-badge";
import {
  getProposalRequestByPublicToken,
  markProposalFirstOpened,
} from "@/lib/maxwell/repositories";
import { stripInternalReviewFlags } from "@/lib/maxwell/proposal-content";

export const metadata: Metadata = {
  title: "Proposal - Noon",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const PUBLIC_PROPOSAL_STATUSES = new Set([
  "sent",
  "payment_pending",
  "payment_under_verification",
  "paid",
  "expired",
]);

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

type Props = {
  params: Promise<{ token: string }>;
};

export default async function PublicProposalPage({ params }: Props) {
  const { token } = await params;

  let proposal = await getProposalRequestByPublicToken(token);
  if (!proposal || !PUBLIC_PROPOSAL_STATUSES.has(proposal.status)) {
    notFound();
  }

  if (!proposal.firstOpenedAt && proposal.status !== "expired") {
    proposal = (await markProposalFirstOpened(token)) ?? proposal;
  }

  const cleanDraft = stripInternalReviewFlags(proposal.draftContent);

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs font-mono uppercase tracking-[0.24em] text-muted-foreground">
            Noon Proposal
          </p>
          <h1 className="mt-2 text-2xl font-display">Project proposal</h1>
          <div className="mt-4">
            <StatusBadge status={proposal.status} />
          </div>
          <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <p>Version {proposal.versionNumber}</p>
            <p>Sent: {proposal.sentAt ? formatDate(proposal.sentAt) : "Pending delivery record"}</p>
            <p>
              First opened: {proposal.firstOpenedAt ? formatDate(proposal.firstOpenedAt) : "This visit"}
            </p>
            <p>
              Valid through: {proposal.expiresAt ? formatDate(proposal.expiresAt) : "15 days from first open"}
            </p>
            {proposal.deliveryRecipient && <p>Recipient: {proposal.deliveryRecipient}</p>}
          </div>
          {proposal.status === "expired" && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
              This proposal is currently marked as expired. Contact Noon if you need an updated version.
            </div>
          )}
        </header>

        <PublicProposalPayment
          publicToken={proposal.publicToken}
          status={proposal.status}
          approvedAmountUsd={proposal.approvedAmountUsd}
          approvedCurrency={proposal.approvedCurrency}
        />

        <section className="rounded-2xl border border-border bg-card p-6">
          <ProposalDocument content={cleanDraft} />
        </section>
      </div>
    </main>
  );
}
