import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { ProposalDocument } from "@/components/maxwell/proposal-document";
import { PublicProposalPayment } from "@/components/maxwell/public-proposal-payment";
import {
  getProposalRequestByPublicToken,
  getStudioSession,
  markProposalFirstOpened,
} from "@/lib/maxwell/repositories";
import { confirmStripeCheckoutReturn } from "@/lib/maxwell/checkout-return";
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
  searchParams: Promise<{ checkout?: string; session_id?: string }>;
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
  const { checkout, session_id: checkoutSessionId } = await searchParams;
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

  // Confirm-on-return: close the webhook race. When the client lands back here
  // from Checkout (`?checkout=success&session_id=cs_…`) while the proposal is
  // still `payment_pending`, confirm the payment right now so the workspace is
  // provisioned before they navigate to it — no "Preparing" gap. Fully idempotent
  // against the Stripe webhook (both de-dupe on the checkout session id), so
  // whichever fires first wins. Best-effort: any failure just falls through to
  // the webhook + the "confirming" state the payment component renders below.
  if (
    checkoutResult === "success" &&
    checkoutSessionId?.startsWith("cs_") &&
    proposal.status === "payment_pending"
  ) {
    try {
      await confirmStripeCheckoutReturn({ checkoutSessionId, proposalId: proposal.id });
      proposal = (await getProposalRequestByPublicToken(token)) ?? proposal;
    } catch (error) {
      log.warn("proposal.checkout-return", "Return-path confirm failed; webhook will finish it.", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

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
        {/* No header card any more (owner, 2026-07-31: "esto está horrible").
            It opened the page with a block of audit data — version, sent, first
            opened, valid through — before the client had seen a single thing they
            could act on, and it repeated itself in every status: a PAID proposal
            still announced "Valid through Aug 8", a date that no longer means
            anything.
            Redistributed by what each fact actually belongs to, rather than
            copied into all three plan cards (that would have tripled the noise
            the owner asked to remove): the offer's expiry sits once beside the
            options, and the document's own metadata sits under the document. */}
        {effectivelyExpired && (
          <div className="mx-auto max-w-3xl">
            <div className="rounded-[8px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
              This proposal has expired. Contact Noon if you need an updated version.
            </div>
          </div>
        )}

        {!effectivelyExpired && (
          <>
            {/* THE DOCUMENT FIRST, then how to pay for it (owner, 2026-07-31).
                It used to sit under the plan cards, which asked the client to
                choose a plan before they could read what they were buying — and
                left the proposal itself hanging at the foot of the page like an
                appendix.
                Note this is ONE document, not one per plan: it describes the work,
                which is identical whichever way you pay. That is why it is not
                folded into each card — three copies of the same text would look
                like a comparison and be none. What differs per plan is only the
                payment shape, and that lives in the cards. */}
            <div className="mx-auto mt-6 max-w-3xl">
              <section className="rounded-[8px] border border-border bg-card p-6">
                <ProposalDocument content={cleanDraft} />

                {/* The document's own record, at its foot — where a document's
                    metadata belongs, and out of the way of the decision. One
                    quiet line instead of the four-row grid that used to open the
                    page. "First opened" is gone for good: telling a client the
                    moment they are currently looking at something tells them
                    nothing they don't know. */}
                <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
                  Version {proposal.versionNumber}
                  {proposal.sentAt && <> · Sent {formatDate(proposal.sentAt)}</>}
                  {/* E2-SEC LOW-1: the expired view never re-exposes the recipient. */}
                  {!effectivelyExpired && proposal.deliveryRecipient && (
                    <> · To {proposal.deliveryRecipient}</>
                  )}
                </p>
              </section>
            </div>

            <div className="mx-auto max-w-[1100px]">
              <PublicProposalPayment
                publicToken={proposal.publicToken}
                status={proposal.status}
                approvedAmountUsd={proposal.approvedAmountUsd}
                approvedCurrency={proposal.approvedCurrency}
                membershipApplicable={commercialProfile?.membershipRecommended ?? false}
                // The price FROZEN at approval — a firm offer must not re-price
                // when the table changes. Fall back to the live figure only for
                // a proposal approved before the freeze landed (else null).
                monthlyAmountUsd={proposal.monthlyAmountUsd ?? commercialProfile?.monthlyAmountUsd ?? null}
                checkoutResult={checkoutResult}
                studioSessionId={proposal.studioSessionId}
                validThrough={proposal.expiresAt ? formatDate(proposal.expiresAt) : null}
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
