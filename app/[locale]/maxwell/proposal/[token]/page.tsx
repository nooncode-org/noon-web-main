import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { ProposalDocument } from "@/components/maxwell/proposal-document";
import { PublicProposalPayment } from "@/components/maxwell/public-proposal-payment";
import { StatusBadge } from "@/app/[locale]/maxwell/review/_components/status-badge";
import {
  getProposalRequestByPublicToken,
  getStudioSession,
  markProposalFirstOpened,
} from "@/lib/maxwell/repositories";
import { resolveProposalCommercialProfile } from "@/lib/maxwell/proposal-rules";
import {
  isProposalPastCutoff,
  isProposalPubliclyViewable,
} from "@/lib/maxwell/proposal-visibility";
import { stripInternalReviewFlags } from "@/lib/maxwell/proposal-content";
import { log } from "@/lib/server/logger";
import { consumeDistributedToken } from "@/lib/server/rate-limit-distributed";
import { recordProposalAccessSafe } from "@/lib/server/audit/proposal-access";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ProposalSidebar } from "@/components/maxwell/proposal-sidebar";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import "@/components/maxwell/studio-rd.css";

export const metadata: Metadata = {
  title: "Proposal - Noon",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

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
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<{ checkout?: string }>;
};

/**
 * Best-effort client IP resolution from RSC headers. Mirrors the logic of
 * `resolveClientIdentity(request)` in `lib/server/rate-limit.ts` but pulls from
 * `next/headers` because RSCs do not receive a `Request` object directly.
 */
async function resolveRscClientIdentity(): Promise<string> {
  // E2-SEC (MED-1): plataforma-primero — x-real-ip/x-vercel-forwarded-for los
  // fija el edge de Vercel; x-forwarded-for puede traer un primer hop
  // suministrado por el cliente (rotarlo bypasearía el rate-limit).
  const h = await headers();
  const real = h.get("x-real-ip");
  if (real?.trim()) return real.trim();
  const vercel = h.get("x-vercel-forwarded-for");
  if (vercel) {
    const first = vercel.split(",")[0]?.trim();
    if (first) return first;
  }
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return "anonymous";
}

export default async function PublicProposalPage({ params, searchParams }: Props) {
  const { locale, token } = await params;
  const { checkout } = await searchParams;
  const checkoutResult =
    checkout === "success" ? "success" : checkout === "cancelled" ? "cancelled" : null;

  // B19 — Capture client hints once at the top so every exit path (rate-limit
  // block, unknown token, success) can audit consistently. The headers() call
  // is async in Next 15+/16 RSCs; raw IP / UA are passed to
  // recordProposalAccessSafe which hashes IP and truncates UA before insert
  // (so the audit row never carries PII).
  const requestHeaders = await headers();
  const clientIp = await resolveRscClientIdentity();
  const userAgent = requestHeaders.get("user-agent");

  // B19: rate-limit per client IP. Public surface — protects against token-scanner abuse.
  // 30 GETs / 60s allows legitimate browser refreshes / share-link previews while
  // absorbing burst scans. SEC-M5: two layers — in-memory bucket + shared Postgres
  // counter, so the budget holds cross-instance. On exceed we render `notFound()`
  // instead of 429 so a scanner cannot distinguish a rate-limited token from a
  // non-existent one.
  const rate = await consumeDistributedToken({
    namespace: "proposal.public",
    identityKey: clientIp,
    limit: 30,
    windowSeconds: 60,
  });
  if (!rate.ok) {
    log.warn("proposal.public.rate-limited", "Rate limit hit for public proposal page", {
      retry_after_seconds: rate.retryAfterSeconds,
    });
    await recordProposalAccessSafe({
      proposalToken: token,
      action: "page_view_blocked",
      responseStatus: 404,
      clientIp,
      userAgent,
    });
    notFound();
  }

  let proposal = await getProposalRequestByPublicToken(token);
  if (!proposal || !isProposalPubliclyViewable(proposal.status)) {
    // B19 — Audit blocked accesses (unknown token, unpublished status, expired).
    // Indistinguishable from rate-limited externally (both render notFound), but
    // recorded separately so compliance queries can tell them apart.
    await recordProposalAccessSafe({
      proposalToken: token,
      action: "page_view_blocked",
      responseStatus: 404,
      clientIp,
      userAgent,
    });
    notFound();
  }

  if (!proposal.firstOpenedAt && proposal.status !== "expired") {
    proposal = (await markProposalFirstOpened(token)) ?? proposal;
  }

  // B19 — Successful render. Awaited so the audit row is committed before
  // we hand the response back to the client; if the insert fails the helper
  // swallows it and warns via the structured logger.
  await recordProposalAccessSafe({
    proposalToken: token,
    action: "page_view",
    responseStatus: 200,
    clientIp,
    userAgent,
  });

  // SEC-M2 (auditoría 2026-07): cutoff duro. Past-cutoff o status expired →
  // vista expirada SIN contenido de la propuesta ni CTA de pago. Antes el
  // contenido seguía visible para siempre (token bearer permanente).
  const effectivelyExpired = proposal.status === "expired" || isProposalPastCutoff(proposal);

  const cleanDraft = stripInternalReviewFlags(proposal.draftContent);

  // v3 membership (M0): the commercial profile drives the modality selector on
  // the payment card. The session carries the project type / complexity the
  // engine maps to a category+tier (and thus the monthly). Best-effort: if the
  // session is missing we hide the membership option (one-time only).
  const session = await getStudioSession(proposal.studioSessionId);
  const commercialProfile = session
    ? resolveProposalCommercialProfile(session)
    : null;

  const viewer = await getAuthenticatedViewer();

  return (
    <main
      className={`${GeistSans.variable} ${GeistMono.variable} mxw-rd min-h-screen bg-background`}
      style={{ fontFamily: "var(--font-geist-sans)" }}
    >
      {viewer && <ProposalSidebar viewerEmail={viewer.email} locale={locale} />}
      <div className="px-6 py-12">
        <div className="mx-auto max-w-3xl">
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
              {/* E2-SEC LOW-1: en la vista expirada no se re-expone el recipient. */}
              {!effectivelyExpired && proposal.deliveryRecipient && (
                <p>Recipient: {proposal.deliveryRecipient}</p>
              )}
            </div>
            {effectivelyExpired && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
                This proposal has expired. Contact Noon if you need an updated version.
              </div>
            )}
          </header>
        </div>

        {!effectivelyExpired && (
          <>
            <div className="mx-auto mt-6 max-w-[1100px]">
              <PublicProposalPayment
                publicToken={proposal.publicToken}
                status={proposal.status}
                approvedAmountUsd={proposal.approvedAmountUsd}
                approvedCurrency={proposal.approvedCurrency}
                membershipApplicable={commercialProfile?.membershipRecommended ?? false}
                monthlyAmountUsd={commercialProfile?.monthlyAmountUsd ?? null}
                checkoutResult={checkoutResult}
              />
            </div>

            <div className="mx-auto mt-6 max-w-3xl">
              <section className="rounded-2xl border border-border bg-card p-6">
                <ProposalDocument content={cleanDraft} />
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
