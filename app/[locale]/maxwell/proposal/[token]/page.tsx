import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { ProposalDocument } from "@/components/maxwell/proposal-document";
import { PublicProposalPayment } from "@/components/maxwell/public-proposal-payment";
import { StatusBadge } from "@/app/[locale]/maxwell/review/_components/status-badge";
import {
  getProposalRequestByPublicToken,
  markProposalFirstOpened,
} from "@/lib/maxwell/repositories";
import { stripInternalReviewFlags } from "@/lib/maxwell/proposal-content";
import { log } from "@/lib/server/logger";
import {
  enforceRateLimit,
  RateLimitExceededError,
} from "@/lib/server/rate-limit";

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

/**
 * Best-effort client IP resolution from RSC headers. Mirrors the logic of
 * `resolveClientIdentity(request)` in `lib/server/rate-limit.ts` but pulls from
 * `next/headers` because RSCs do not receive a `Request` object directly.
 */
async function resolveRscClientIdentity(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = h.get("x-real-ip");
  if (real?.trim()) return real.trim();
  const vercel = h.get("x-vercel-forwarded-for");
  if (vercel) {
    const first = vercel.split(",")[0]?.trim();
    if (first) return first;
  }
  return "anonymous";
}

export default async function PublicProposalPage({ params }: Props) {
  const { token } = await params;

  // B19: rate-limit per client IP. Public surface — protects against token-scanner abuse.
  // 30 GETs / 60s allows legitimate browser refreshes / share-link previews while
  // absorbing burst scans. On exceed we render `notFound()` instead of 429 so a scanner
  // cannot distinguish a rate-limited token from a non-existent one.
  try {
    enforceRateLimit({
      namespace: "proposal.public",
      capacity: 30,
      refillPerSec: 30 / 60,
      identityKey: await resolveRscClientIdentity(),
    });
  } catch (rateError) {
    if (rateError instanceof RateLimitExceededError) {
      log.warn("proposal.public.rate-limited", "Rate limit hit for public proposal page", {
        retry_after_seconds: rateError.retryAfterSeconds,
      });
      notFound();
    }
    throw rateError;
  }

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
