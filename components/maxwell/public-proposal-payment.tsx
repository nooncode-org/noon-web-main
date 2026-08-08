"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import type { ProposalStatus } from "@/lib/maxwell/repositories";
import { getContactHref, siteRoutes } from "@/lib/site-config";
import { MEMBERSHIP_BILLING_ENABLED } from "@/lib/maxwell/membership-billing";
import {
  HOSTING_BILLING_ENABLED,
  HOSTING_MONTHLY_USD,
  HOSTING_YEARLY_USD,
} from "@/lib/maxwell/hosting-billing";
import { AutoRefresh } from "@/components/maxwell/auto-refresh";
import {
  DELIVERY_STEPS,
  type ProposalScope,
} from "@/components/maxwell/proposal-scope-summary";
import { useEscalated } from "@/components/maxwell/workspace-preparing-body";

// Stripe.js loads once per module. The publishable key is public by design (it
// ships to the browser); when it's unset — e.g. before the owner configures it —
// `stripePromise` stays null and the payment step shows a graceful fallback.
const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

type CheckoutResult = "success" | "cancelled" | null;
type Modality = "one_time" | "membership";

type PublicProposalPaymentProps = {
  publicToken: string;
  status: ProposalStatus;
  approvedAmountUsd: number | null;
  approvedCurrency: string | null;
  /**
   * v3 membership (M0). When the engine recommends membership for this project
   * AND a monthly is available, the client can pick "Membership" vs "One-time".
   * The activation (`approvedAmountUsd`) is charged either way; the monthly is
   * NOT charged here (arranged manually by the PM until M1). Defaults keep the
   * one-time-only behaviour for projects where membership doesn't apply.
   */
  membershipApplicable?: boolean;
  monthlyAmountUsd?: number | null;
  /**
   * Set from the `?checkout=success|cancelled` query param Stripe appends when
   * it redirects back from Checkout (see `success_url` / `cancel_url` in
   * `app/api/maxwell/checkout/route.ts`). `success` means the card was charged;
   * the proposal flips to `paid` asynchronously once the Stripe webhook lands,
   * so we show a "confirming" state until then.
   */
  checkoutResult?: CheckoutResult;
  /** Studio session id — links the post-payment CTA to the client's project workspace (the portal). */
  studioSessionId?: string;
  /** Pre-formatted offer expiry, shown once beside the options. Null = no date on record. */
  validThrough?: string | null;
  /**
   * The client's own project, in their words (the session's goal summary, or
   * their opening request as a fallback). The page had no way of saying WHICH
   * project it was quoting: someone opening the emailed link days later — or
   * holding two proposals — read "Choose an option" with nothing tying it to
   * their build.
   */
  projectName?: string | null;
  /**
   * Client-facing slice of the proposal draft (the scope items). Spread into
   * each plan's own list, so every card states the whole plan on its own.
   */
  scope?: ProposalScope | null;
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

type PlanInfo = {
  key: string;
  name: string;
  tagline: string;
  priceMain: string;
  priceSub: string;
  /**
   * A plain string is a bare line; the object form adds the sentence under it
   * that says what the line actually means. Both accepted so a list only carries
   * a description where there is something true to add, instead of padding every
   * row to fill the shape.
   */
  features: (string | { title: string; detail: string })[];
  recommended: boolean;
  /** Membership when the engine doesn't offer it → rendered disabled, not selectable. */
  unavailable?: boolean;
  ctaLabel: string;
  /** Selectable plan → its CTA advances to the payment step with this modality. */
  selectModality?: Modality;
  /** Link CTA (e.g. the "Other" card → contact) instead of a select. */
  ctaHref?: string;
};

/**
 * Step-1 plan card — a filled price panel up top (name pill + big price, a
 * brand-blue gradient on the recommended plan) over the tagline, CTA, and
 * feature checklist. Its CTA *selects* the plan (advancing to the payment step).
 */
// Animated wash for the recommended card: two blurred colour blobs that drift
// slowly inside the price panel (clipped by its rounded box). Motion is gentle
// and pauses under prefers-reduced-motion.
const PPW_WASH_CSS = `
.ppw-blob{position:absolute;border-radius:9999px;filter:blur(34px);will-change:transform}
.ppw-blob-blue{width:72%;height:96%;top:-26%;right:-12%;background:radial-gradient(circle,rgba(0,86,253,.55),transparent 70%);animation:ppw-drift-a 15s ease-in-out infinite}
.ppw-blob-purple{width:66%;height:88%;top:-18%;left:14%;background:radial-gradient(circle,rgba(124,58,237,.5),transparent 70%);animation:ppw-drift-b 19s ease-in-out infinite}
@keyframes ppw-drift-a{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-7%,7%) scale(1.09)}}
@keyframes ppw-drift-b{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(9%,-4%) scale(1.12)}}
@media (prefers-reduced-motion:reduce){.ppw-blob{animation:none}}
`;

type PlanFeature = PlanInfo["features"][number];

const featureTitle = (feature: PlanFeature) =>
  typeof feature === "string" ? feature : feature.title;
const featureKey = featureTitle;

/**
 * One line of "what this includes": the claim in the card's own voice, and
 * under it the sentence that says what the claim actually means.
 *
 * The zebra band is doing work, not decoration — once a row is two lines tall,
 * a flat list stops showing you where one point ends and the next begins, and
 * the eye has to use the checkmarks as fenceposts. The alternating fill draws
 * the boundary instead.
 */
function FeatureRow({ feature, striped }: { feature: PlanFeature; striped: boolean }) {
  const detail = typeof feature === "string" ? null : feature.detail;
  return (
    <li className={`flex items-start gap-2.5 px-3 py-2.5 ${striped ? "bg-foreground/[0.035]" : ""}`}>
      <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-[#0056fd]" strokeWidth={2.5} />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium leading-snug text-foreground">
          {featureTitle(feature)}
        </span>
        {detail && (
          <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">
            {detail}
          </span>
        )}
      </span>
    </li>
  );
}

function PlanColumn({
  plan,
  onSelect,
  first,
}: {
  plan: PlanInfo;
  onSelect: (modality: Modality) => void;
  /** First column draws no divider; the rest carry it on their leading edge. */
  first: boolean;
}) {
  const tPay = useTranslations("payment");
  const { name, tagline, priceMain, priceSub, features, recommended, unavailable } = plan;
  // Compact, content-width, small radius (owner, a la the reference's "Get
  // started"): a full-width pill reads as a slab; a small button under the
  // price reads as an action. Fills keep our hierarchy — blue only on the
  // recommended plan, hover deepens.
  const ctaAccent = recommended
    ? "bg-[#0056fd] text-white hover:bg-[#0047e0]"
    : "bg-foreground text-background hover:bg-foreground/90";
  const ctaClass = `inline-flex w-fit items-center justify-center rounded-[6px] px-4 py-2 text-[13px] font-medium transition-colors ${ctaAccent}`;
  const cta = unavailable ? (
    <span
      aria-disabled
      className="inline-flex w-fit cursor-not-allowed items-center justify-center rounded-[6px] bg-foreground/10 px-4 py-2 text-[13px] font-medium text-muted-foreground"
    >
      {plan.ctaLabel}
    </span>
  ) : plan.ctaHref ? (
    <Link href={plan.ctaHref} className={ctaClass}>
      {plan.ctaLabel}
    </Link>
  ) : (
    <button
      type="button"
      onClick={() => plan.selectModality && onSelect(plan.selectModality)}
      className={ctaClass}
    >
      {plan.ctaLabel}
    </button>
  );
  return (
    // One column of the JOINED plans table (owner, 2026-08-01: "junta estas 3
    // cards"). No outer card, no inner price panel: the shared container draws
    // the single border, and columns separate with a hairline on the leading
    // edge — border, not grid gap, so it snaps to 1px at fractional dpi
    // (border-t stacked on mobile, border-l side by side from sm).
    // Horizontal padding lives on the ZONES, not the column: the rule under
    // the button row must run edge to edge so it reads as one line across the
    // whole table (padding on the column would stop it 24px short of each
    // divider, cutting it into three dashes).
    <div
      className={`relative flex flex-col overflow-hidden pb-6 pt-7 ${
        first ? "" : "border-t border-border sm:border-l sm:border-t-0"
      } ${unavailable ? "opacity-55" : ""}`}
    >
      {/* The recommended wash survives the join, confined to the pricing zone:
          the blobs are %-sized, so against the full column they would flood the
          feature rows. A ~260px stage keeps their approved geometry (the old
          panel was 248px) and the mask fades the wash out instead of cutting
          it — a hard clip line through a 34px blur would read as a seam. */}
      {recommended && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[260px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
        >
          <span className="ppw-blob ppw-blob-blue" />
          <span className="ppw-blob ppw-blob-purple" />
          <style>{PPW_WASH_CSS}</style>
        </div>
      )}

      {/* Header zone: name → tagline → price → CTA, then the plan's own ✓ list
          (owner: "mejor dejalo como antes" — per-column lists, à la the Notion
          reference, not a ✓-matrix). Every slot here is one line tall in every
          plan (min-h where a chip could stretch one), so the rule under the
          buttons lands at the same y in all three columns and joins into a
          single line across the table. */}
      <div className="relative border-b border-border px-6 pb-7">
        {/* min-h = the chip's height, so a column WITH a chip and one without
            keep every later row at the same y (measured: 2px drift without it). */}
        <div className="flex min-h-[26px] items-center justify-between gap-3">
          <span className="text-[15px] font-medium text-foreground">{name}</span>
          {recommended && (
            <span className="rounded-full bg-[#141414] px-2.5 py-1 text-[11px] font-medium text-white">
              Popular
            </span>
          )}
          {unavailable && (
            <span className="rounded-full bg-foreground/10 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              Unavailable
            </span>
          )}
        </div>

        <p className="mt-1.5 text-[13px] text-muted-foreground">{tagline}</p>

        <div className="mt-20 flex min-h-[28px] items-baseline gap-1.5">
          {unavailable ? (
            <span className="text-lg font-medium text-muted-foreground">{tPay("notAvailable")}</span>
          ) : (
            <>
              <span className="text-[28px] font-semibold leading-none text-foreground">{priceMain}</span>
              {priceSub && <span className="text-xs text-muted-foreground">{priceSub}</span>}
            </>
          )}
        </div>

        <div className="mt-5">{cta}</div>
      </div>

      {/* The plan's own list — self-contained (owner: "en cada card debe tener
          lo que incluye"), never "everything in X, plus:". `relative` like the
          header zone: the wash blobs are absolutely positioned, so unpositioned
          in-flow content would paint UNDER them. */}
      {features.length > 0 && (
        <ul className="relative mx-6 mt-6 overflow-hidden rounded-[6px]">
          {features.map((feature, index) => (
            <FeatureRow key={featureKey(feature)} feature={feature} striped={index % 2 === 0} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Live "confirming payment" state (a-lo-Vercel: status that updates itself, and
 * an honest escalation instead of an endless spinner). Reaching it means the
 * server-side confirm-on-return didn't land on this render (e.g. a transient
 * Stripe API miss) and the webhook is finishing the job. Each `router.refresh()`
 * tick re-runs the page server-side — which RETRIES the confirm, so this state
 * actively self-heals rather than just waiting. The 7s interval keeps a
 * comfortable margin inside the proposal page's 30 req/60s per-IP rate budget.
 */
function ConfirmingPaymentBox() {
  const escalated = useEscalated(75_000);
  return (
    <section className="rounded-[8px] border border-sky-500/25 bg-sky-500/10 p-5 text-sm text-sky-950">
      <AutoRefresh intervalMs={7_000} />
      <div className="flex items-start gap-3">
        <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
        <div>
          <p className="font-medium">
            {escalated ? "Still confirming your payment" : "We're confirming your payment"}
          </p>
          {escalated ? (
            <p className="mt-1 text-sky-950/80">
              This is taking longer than usual — but your payment went through and nothing is
              lost. This page keeps checking on its own, and we&apos;ll also email you the
              moment your project is confirmed. Need a hand?{" "}
              <a href={getContactHref()} className="underline underline-offset-2">
                Contact us
              </a>
              .
            </p>
          ) : (
            <p className="mt-1 text-sky-950/80">
              Thanks — your payment went through. This page updates on its own; confirmation
              usually lands in a few seconds.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function PublicProposalPayment({
  publicToken,
  status,
  approvedAmountUsd,
  approvedCurrency,
  membershipApplicable = false,
  monthlyAmountUsd = null,
  checkoutResult = null,
  studioSessionId,
  validThrough = null,
  projectName = null,
  scope = null,
}: PublicProposalPaymentProps) {
  const tPay = useTranslations("payment");
  // Two-step flow: pick a plan (null), then pay for it. `null` = step 1.
  const [selectedPlan, setSelectedPlan] = useState<Modality | null>(null);
  const hasApprovedAmount = approvedAmountUsd != null;
  const payable = (status === "sent" || status === "payment_pending") && hasApprovedAmount;
  const currency = approvedCurrency ?? "USD";
  const pathname = usePathname();
  const locale = pathname?.split("/")[1] || "en";
  const localeHref = (route: string) => `/${locale}${route}`;

  // Embedded Checkout asks for the session's client secret when it mounts. This
  // POSTs to our checkout route (which creates or reuses the Stripe session for
  // the chosen modality) and hands back its client_secret. A 401 means the viewer
  // must sign in first — we bounce there and never resolve (the page navigates).
  const fetchClientSecret = useCallback(async () => {
    const response = await fetch("/api/maxwell/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        public_token: publicToken,
        payment_modality: selectedPlan ?? undefined,
      }),
    });
    if (response.status === 401) {
      const callbackUrl = `${window.location.pathname}${window.location.search}`;
      window.location.href = `/${locale}/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
      return new Promise<string>(() => {});
    }
    const data = (await response.json().catch(() => null)) as
      | { client_secret?: string; message?: string }
      | null;
    if (!response.ok || !data?.client_secret) {
      throw new Error(data?.message ?? "Payment could not be started. Please try again.");
    }
    return data.client_secret;
  }, [publicToken, selectedPlan, locale]);

  if (status === "paid") {
    const wasMembership = membershipApplicable && monthlyAmountUsd != null;
    const paidTotal =
      wasMembership && monthlyAmountUsd != null && MEMBERSHIP_BILLING_ENABLED
        ? (approvedAmountUsd ?? 0) + monthlyAmountUsd
        : approvedAmountUsd ?? 0;
    // Post-payment the client lands in their project portal (the workspace) —
    // where status, versions, materials and billing all live. Falls back to the
    // studio home if we somehow don't have the session id.
    const projectHref = studioSessionId
      ? localeHref(`/maxwell/workspace/${studioSessionId}`)
      : localeHref(siteRoutes.maxwellStudio);
    return (
      <section className="pt-12">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-[8px] border border-border bg-card">
          <div className="grid md:grid-cols-2">
            {/* LEFT — confirmation + CTA */}
            <div className="flex flex-col items-center justify-center p-8 text-center sm:p-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" strokeWidth={2.5} />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-foreground">{tPay("successful")}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Your project is confirmed — Noon is activating it now. We&apos;ll continue from the
                approved proposal.
              </p>
              <Link
                href={projectHref}
                className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0056fd] px-5 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#0047e0]"
              >
                Go to your project
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {wasMembership
                  ? "Track progress, previews, and billing — all from your project workspace."
                  : "Track progress and previews from your project workspace."}
              </p>
            </div>

            {/* RIGHT — receipt */}
            <div className="border-t border-border bg-foreground/[0.03] p-8 sm:p-10 md:border-l md:border-t-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">{tPay("receipt")}</p>
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Paid
                </span>
              </div>

              <div className="mt-5 space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{tPay("plan")}</span>
                  <span className="text-foreground">
                    {wasMembership ? "Membership" : "One-time project"}
                  </span>
                </div>
                {approvedAmountUsd != null && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {wasMembership ? "Activation" : "Project payment"}
                    </span>
                    <span className="text-foreground">
                      {formatMoney(approvedAmountUsd, currency)}
                    </span>
                  </div>
                )}
                {wasMembership && monthlyAmountUsd != null && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{tPay("membership")}</span>
                    <span className="text-foreground">
                      {formatMoney(monthlyAmountUsd, currency)}/mo
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
                <span className="text-sm font-medium text-foreground">{tPay("totalPaid")}</span>
                <span className="text-lg font-semibold text-foreground">
                  {formatMoney(paidTotal, currency)}
                </span>
              </div>

              <p className="mt-4 truncate text-[11px] text-muted-foreground/70">Ref: {publicToken}</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (status === "expired") {
    return (
      <section className="rounded-[8px] border border-amber-500/25 bg-amber-500/10 p-5 text-sm text-amber-900">
        This proposal expired. Ask Noon for a refreshed quote before paying.
      </section>
    );
  }

  if (status === "payment_under_verification") {
    return (
      <section className="rounded-[8px] border border-sky-500/25 bg-sky-500/10 p-5 text-sm text-sky-950">
        Payment is under verification. The project will activate once the payment is confirmed.
      </section>
    );
  }

  // The client just came back from a successful Stripe Checkout. The server
  // already tried confirm-on-return before rendering; still being here means
  // that path didn't land yet, so show a LIVE confirming state instead of the
  // pay button (avoids a confusing double-charge prompt during the window).
  if (checkoutResult === "success") {
    return <ConfirmingPaymentBox />;
  }

  if (!payable) {
    return (
      <section className="rounded-[8px] border border-border bg-card p-5 text-sm text-muted-foreground">
        Payment is not available for this proposal yet. Noon must approve and publish a final USD amount first.
      </section>
    );
  }

  const payableAmount = approvedAmountUsd;
  if (payableAmount == null) return null;

  const hasMembership = membershipApplicable && monthlyAmountUsd != null;
  const scopeShown = Boolean(scope && scope.scope.length > 0);

  // Per-column lists (owner: "mejor dejalo como antes"): each plan states its
  // OWN list, self-contained, never "everything in X, plus:". These rows open
  // every buyable plan's list — the project's actual deliverables, then the
  // rows every plan carries. Yes, the two columns repeat them; that is the
  // cost of a card that can be read on its own, which is the call the owner
  // made when this shape was first built.
  const sharedRows: PlanInfo["features"] = [
    ...(scopeShown
      ? (scope?.scope ?? []).map((item) =>
          item.detail ? { title: item.title, detail: item.detail } : item.title,
        )
      : // No readable scope on this proposal → one honest summary row instead
        // of six concrete ones. The list is never empty.
        [{ title: "Full scope delivered", detail: "Everything written into this proposal" }]),
    { title: "Immediate start", detail: "Queued the moment the payment clears" },
    // The portal claims only the tabs that actually ship
    // (workspace page: overview / chat / versions / domains).
    { title: "Client portal", detail: "Live progress, previews and direct chat" },
  ];
  // No "Not included" anywhere client-facing (owner: "no se coloca lo que no
  // incluye" — the page states what we offer, never what we don't). The
  // exclusions still exist where they do their real job: the team-side
  // document on /maxwell/review, which fences scope disputes.

  // The one-time card must describe what the checkout will actually do, which
  // depends on the hosting flag: OFF → a single payment and truly nothing
  // recurring; ON → the build today + a hosting subscription whose first year
  // is included (Stripe shows the same terms on its form). "Nothing recurring"
  // with the flag on would be a false promise at the exact click where the
  // client decides to pay.
  const oneTimePlan: PlanInfo = {
    key: "one_time",
    name: "One-time",
    tagline: HOSTING_BILLING_ENABLED
      ? "Pay once — first year of hosting included"
      : "One payment, nothing recurring",
    priceMain: formatMoney(payableAmount, currency),
    // The currency code, spelled out (owner): "$" alone is ambiguous for a
    // client in Mexico, Canada or Argentina — "$4,500" could be five different
    // amounts. The real code from the proposal, never hardcoded.
    priceSub: `${currency} · once`,
    recommended: false,
    ctaLabel: "Get started",
    selectModality: "one_time",
    features: [
      // Label + fragment, not two sentences. A pricing card is scanned, not
      // read: the title has to be findable at a glance and the line under it
      // has to finish in one breath.
      ...sharedRows,
      { title: "Code ownership", detail: "Repository access and a full download" },
      // What happens AFTER the build — the real difference between the two
      // routes. The two variants are exclusive: with hosting billing ON the
      // first year IS included, so saying "arranged separately" alongside it
      // would contradict the line right under it (it did, until now).
      ...(HOSTING_BILLING_ENABLED
        // Same title family as the membership row — "Hosting included" against
        // "Hosting available" is a difference you catch scanning across.
        ? [
            {
              title: "Hosting included for a year",
              detail: `Servers and database — then ${formatMoney(HOSTING_YEARLY_USD, currency)}/yr or ${formatMoney(HOSTING_MONTHLY_USD, currency)}/mo`,
            },
          ]
        : [
            // Stated as what we DO offer (owner): hosting exists and we set it
            // up, it just is not inside this price.
            {
              title: "Hosting available",
              detail: "Servers and database, priced separately",
            },
          ]),
    ],
  };
  const membershipPlan: PlanInfo =
    hasMembership && monthlyAmountUsd != null
      ? {
          key: "membership",
          name: "Membership",
          tagline: "Activation now, plus ongoing monthly",
          priceMain: formatMoney(payableAmount, currency),
          priceSub: `${currency} · activation + ${formatMoney(monthlyAmountUsd, currency)}/mo`,
          recommended: true,
          ctaLabel: "Get started",
          selectModality: "membership",
          features: [
            // Self-contained (owner: "en cada card debe tener lo que incluye").
            // It used to open with "Everything in one-time, plus:", which made
            // the reader look at the other card and add the two lists in their
            // head. A card that describes a plan describes the whole plan.
            ...sharedRows,
            // Hosting is ONE charge covering two services (the servers that run
            // the site and the database behind it), so it stays one row: two
            // rows would read as two bills. Title carries the fact, detail says
            // what is inside it.
            { title: "Hosting included", detail: "Servers and database, inside the monthly" },
            { title: "Ongoing improvements", detail: "Work continues after your project ships" },
            { title: "Changes and new work", detail: "Send them as they come up, every month" },
            // Owner: "esto qué tiene que ver con lo que ofrecemos?" — nothing.
            // "Monthly Stripe billing" named the payment rail, which is our
            // plumbing, not their benefit. The fact underneath it IS an offer
            // though, and a real one for a recurring plan: they are not tied in.
            // So the title now states that, and the mechanic is gone.
            MEMBERSHIP_BILLING_ENABLED
              ? { title: "No lock-in", detail: "Cancel anytime from your portal" }
              : { title: "No lock-in", detail: "Nothing recurring without your say-so" },
          ],
        }
      : {
          // Engine didn't recommend membership for this project → the card stays
          // in place (the 3-up layout never shifts) but renders disabled.
          key: "membership",
          name: "Membership",
          tagline: "Not offered for this project's scope",
          priceMain: "",
          priceSub: "",
          recommended: false,
          unavailable: true,
          ctaLabel: "Not available",
          features: [
            "Ongoing improvements after your project ships",
            "A monthly retainer for changes and new work",
            "Set with your Noon PM — never charged automatically",
          ],
        };
  const otherPlan: PlanInfo = {
    key: "other",
    name: "Other",
    tagline: "Something else in mind?",
    priceMain: "Custom",
    priceSub: "",
    recommended: false,
    ctaLabel: "Contact us",
    ctaHref: getContactHref(),
    features: [
      { title: "A different scope or budget", detail: "Tell us what you need and we'll re-quote" },
      { title: "Questions first", detail: "Nothing is charged while we work it out" },
    ],
  };
  const plans = [oneTimePlan, membershipPlan, otherPlan];
  const chosen =
    selectedPlan === "membership" ? membershipPlan : selectedPlan === "one_time" ? oneTimePlan : null;

  // ── STEP 2 — pay for the chosen plan ──────────────────────────────────────
  if (chosen && selectedPlan) {
    const isMembership = selectedPlan === "membership";
    // M1 (billing live) bills activation + first month up front, then recurs.
    // Kill-switch back to M0 → activation only, monthly arranged by the PM.
    const billsMonthlyNow =
      isMembership && monthlyAmountUsd != null && MEMBERSHIP_BILLING_ENABLED;
    const totalTodayUsd =
      billsMonthlyNow && monthlyAmountUsd != null
        ? payableAmount + monthlyAmountUsd
        : payableAmount;
    const monthlyLabel = monthlyAmountUsd != null ? formatMoney(monthlyAmountUsd, currency) : null;
    return (
      <section className="pt-12">
        <div className="mx-auto max-w-5xl">
          <button
            type="button"
            onClick={() => setSelectedPlan(null)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Change plan
          </button>

          <div className="mt-5">
            <h2 className="text-2xl font-medium text-foreground sm:text-3xl">{tPay("complete")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your project starts once payment is confirmed.
            </p>
          </div>

          {/* Desktop: payment (left) + plan summary sidebar (right). Stacks on mobile. */}
          <div className="mt-8 grid items-start gap-6 md:grid-cols-[3fr_2fr]">
            {/* LEFT — Stripe Embedded Checkout. Stripe renders the real card and
                wallet fields, collects the billing address, and owns the Pay /
                Subscribe button inside its own widget: one charge, no redirect,
                PCI-safe. `key={selectedPlan}` remounts it if the client goes back
                and switches plans, so it re-fetches the matching session. */}
            <div className="min-h-[440px] overflow-hidden rounded-[8px] border border-border bg-white">
              {stripePromise ? (
                <EmbeddedCheckoutProvider
                  key={selectedPlan}
                  stripe={stripePromise}
                  options={{ fetchClientSecret }}
                >
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              ) : (
                <div className="flex min-h-[440px] flex-col items-center justify-center gap-2 p-8 text-center">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">
                    Online payment isn&apos;t available yet
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    Please contact Noon and we&apos;ll help you complete your payment.
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT — plan summary sidebar: features, price breakdown, pay CTA. */}
            <div className="rounded-[8px] border border-border bg-card p-6 sm:p-7">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xl font-medium text-foreground">{chosen.name}</p>
                {isMembership && (
                  <span className="shrink-0 rounded-full bg-[#141414] px-2.5 py-1 text-[11px] font-medium text-white">
                    Popular
                  </span>
                )}
              </div>

              {chosen.features.length > 0 && (
                <ul className="mt-5 space-y-3.5">
                  {/* Titles only here. Step 2 is the payment screen: the client
                      has already chosen, so this list is a reminder of what they
                      picked, not the pitch. The descriptions belong on step 1,
                      where the decision is actually being made. */}
                  {chosen.features.map((feature) => (
                    <li
                      key={featureKey(feature)}
                      className="flex items-start gap-2.5 text-[13px] text-muted-foreground"
                    >
                      <Check className="mt-[3px] h-4 w-4 shrink-0 text-[#0056fd]" strokeWidth={2.5} />
                      <span>{featureTitle(feature)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-6 space-y-2.5 border-t border-border pt-6 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {isMembership ? "Activation" : "Project payment"}
                  </span>
                  <span className="text-foreground">{formatMoney(payableAmount, currency)}</span>
                </div>
                {isMembership && monthlyLabel && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{tPay("membership")}</span>
                    <span className="text-foreground">{monthlyLabel}/mo</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{tPay("vat")}</span>
                  <span className="text-foreground">{formatMoney(0, currency)}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
                <span className="text-base font-medium text-foreground">{tPay("totalDue")}</span>
                <span className="text-xl font-semibold text-foreground">
                  {formatMoney(totalTodayUsd, currency)}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground/60">Amounts in {currency}.</p>

              {billsMonthlyNow && monthlyLabel && (
                <p className="mt-5 rounded-[8px] border border-border bg-background px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
                  You authorize {formatMoney(totalTodayUsd, currency)} today, then {monthlyLabel}/month
                  on a recurring basis until you cancel — you confirm it on the secure Stripe form to
                  the left. Cancel anytime from your account.
                </p>
              )}

              {!billsMonthlyNow && (
                <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground/70">
                  {isMembership && monthlyLabel
                    ? `The ${monthlyLabel}/mo membership is arranged with your Noon PM. Your project starts once payment is confirmed.`
                    : HOSTING_BILLING_ENABLED
                      ? `You pay the build today — your first year of hosting is included, then it renews at ${formatMoney(HOSTING_YEARLY_USD, currency)}/year (or ${formatMoney(HOSTING_MONTHLY_USD, currency)}/month). You confirm it on the secure Stripe form. Your project starts once payment is confirmed.`
                      : "One payment, nothing recurring. Your project starts once payment is confirmed."}
                </p>
              )}

              <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Lock className="h-3 w-3" />
                Secure checkout · powered by Stripe
              </p>

              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/60">
                By continuing you agree to Noon&apos;s{" "}
                <Link
                  href={localeHref(siteRoutes.termsAndConditions)}
                  className="underline underline-offset-2 hover:text-muted-foreground"
                >
                  Terms
                </Link>{" "}
                and{" "}
                <Link
                  href={localeHref(siteRoutes.privacyPolicy)}
                  className="underline underline-offset-2 hover:text-muted-foreground"
                >
                  Privacy Policy
                </Link>
                .
              </p>

              {checkoutResult === "cancelled" && (
                <p className="mt-4 rounded-[8px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
                  Payment was cancelled. You can try again whenever you&apos;re ready.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ── STEP 1 — choose a plan ────────────────────────────────────────────────
  return (
    <section className="pt-12">
      <div className="flex flex-col items-center gap-3 text-center">
        {/* Whose project this is, in the client's own words. Above the heading
            and quiet: it identifies the page, it is not the thing being asked
            of them. */}
        {projectName && (
          <p className="text-[13px] text-muted-foreground">
            Proposal for <span className="text-foreground">{projectName}</span>
          </p>
        )}
        <h2 className="text-2xl font-medium text-foreground sm:text-3xl">{tPay("chooseOption")}</h2>
        {/* The deadline sits WITH the decision (owner: the closing line was
            three unrelated things joined by a dot — a promise, a date and a
            link). A date only matters while you are choosing, so it belongs
            under the heading that asks you to choose, not at the far end of
            the page where it lands after the decision is already made.
            Same chip recipe as the studio trace's file chips, verbatim: 4px
            radius, hairline border, 7% fill, mono 12/14. A date is a value,
            and a value with its own edges is what the eye lands on. */}
        {validThrough && (
          <span className="inline-flex items-center rounded-[4px] border border-border bg-foreground/[0.07] px-1.5 py-0.5 font-mono text-[12px] font-medium leading-[14px] text-foreground/90">
            Valid through {validThrough}
          </span>
        )}
      </div>

      {/* ONE surface (owner: "junta estas 3 cards", à la Notion's pricing
          table): a single bordered container, columns divided by hairlines the
          columns themselves draw. overflow-hidden so the recommended column's
          wash clips against the shared rounded corner. */}
      <div className="mt-8 overflow-hidden rounded-[8px] border border-border bg-card">
        <div className={`grid ${plans.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {plans.map((plan, index) => (
            <PlanColumn
              key={plan.key}
              plan={plan}
              first={index === 0}
              onSelect={(modality) => setSelectedPlan(modality)}
            />
          ))}
        </div>

      </div>

      {/* Delivery as it actually happens — the AI starts on payment; no
          invented discovery weeks. Outside the table: it is the page's story,
          not a per-plan fact. */}
      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {DELIVERY_STEPS.map((step, index) => (
          <div key={step.title}>
            <span className="font-mono text-[11px] text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            <p className="mt-1.5 text-[13px] font-medium leading-snug text-foreground">
              {step.title}
            </p>
            <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{step.detail}</p>
          </div>
        ))}
      </div>

      {/* The link, alone. It used to share a line with the deadline and with
          "Your project starts once payment is confirmed" — three unrelated
          things joined by a dot. The sentence is gone outright: step 02 above
          says the same thing better ("The AI begins generating it the moment
          payment clears"), so it was a duplicate arriving one line late. What
          survives is the one thing the page cannot answer inline, and it reads
          as an invitation to go deeper. */}
      <div className="mt-8 flex justify-center">
        {/* Destination is a placeholder on purpose. The page this deserves —
            what the client gets and how the project is delivered — is still to
            be written; until it exists this points at /services, which is the
            only page that honestly answers part of the question. When that page
            ships, re-point this href and the wording stays as it is. */}
        <Link
          href={siteRoutes.howItWorksHref}
          target="_blank"
          rel="noopener noreferrer"
          // Brand blue, and the hover DEEPENS — the site's rule everywhere a
          // blue is interactive. Lightening on hover is the one thing it must
          // not do.
          className="inline-flex items-center gap-2 text-center text-[13px] text-[#0056fd] transition-colors hover:text-[#0047e0]"
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Learn how your project is delivered
        </Link>
      </div>
    </section>
  );
}
