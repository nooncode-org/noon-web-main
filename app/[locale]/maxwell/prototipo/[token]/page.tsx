/**
 * app/[locale]/maxwell/prototipo/[token]/page.tsx
 *
 * D-slice ADR-023 render route — the client-facing surface where the prototipo
 * is shown and the accept/reject decision is captured. The Server Component
 * orchestration is:
 *
 *   1. Rate-limit the public surface per IP (anti-enumeration; mirrors the
 *      proposal/[token] pattern).
 *   2. Fetch the signed-read payload from App via `fetchPrototipoRender`
 *      (Pull B.2, ADR-024 wire spec).
 *   3. Map the result → UX state via `mapRenderResultToUxState`.
 *   4. Render the matching shell: prototype frame + decision panel for
 *      pending, frame + prior-decision summary for accepted/rejected,
 *      or the error surface for terminal/transient buckets.
 *
 * `DecisionPanel` (Fase C) is mounted below `PrototipoFrame` only on the
 * `ready.pending` branch — see the marker comment where it will plug in.
 */

import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";

import { fetchPrototipoRender } from "@/lib/maxwell/prototipo-render-fetch";
import { mapRenderResultToUxState } from "@/lib/maxwell/prototipo-render-types";
import { isPrototipoDecisionRouteEnabled } from "@/lib/maxwell/prototipo-route-flag";
import { log } from "@/lib/server/logger";
import { consumeDistributedToken } from "@/lib/server/rate-limit-distributed";

import { submitDecisionAction } from "./_actions/submit-decision";
import { DecisionPanel } from "./_components/decision-panel";
import { ErrorStates } from "./_components/error-states";
import { PriorDecisionSummary } from "./_components/prior-decision-summary";
import { PrototipoFrame } from "./_components/prototipo-frame";

export const metadata: Metadata = {
  title: "Tu prototipo - Noon",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; token: string }>;
};

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

export default async function PublicPrototipoPage({ params }: Props) {
  // Feature gate — when `MAXWELL_PROTOTIPO_DECISION_ROUTE=1` is unset, render
  // notFound() before any other work. Anti-enumeration: a probe cannot tell a
  // gated route from a non-existent path.
  if (!isPrototipoDecisionRouteEnabled()) {
    notFound();
  }

  const { token } = await params;
  const clientIp = await resolveRscClientIdentity();

  // Public surface — rate-limit per IP to protect against token-scanner abuse.
  // 30 GETs / 60s mirrors the proposal/[token] budget. SEC-M5: two layers —
  // in-memory bucket + shared Postgres counter (cross-instance). On exceed we
  // render notFound() so scanners cannot distinguish a rate-limited token from
  // a non-existent one.
  const rate = await consumeDistributedToken({
    namespace: "prototipo.public",
    identityKey: clientIp,
    limit: 30,
    windowSeconds: 60,
  });
  if (!rate.ok) {
    log.warn(
      "prototipo.public.rate-limited",
      "Rate limit hit for public prototipo page",
      { retry_after_seconds: rate.retryAfterSeconds },
    );
    notFound();
  }

  const result = await fetchPrototipoRender(token);
  const state = mapRenderResultToUxState(result);

  // Log the App-side requestId on every fetch so cross-repo trace joins are
  // possible. Errors log at warn; successes log at info with the kind only.
  if (result.status === "error") {
    log.warn("prototipo.public.fetch-error", "App signed-read returned non-ok", {
      code: result.code,
      http_status: result.httpStatus,
      request_id: result.requestId ?? null,
    });
  } else {
    log.info("prototipo.public.fetch-ok", "App signed-read returned data", {
      decision_status: result.data.decision.status,
      version: result.data.workspace.version,
      request_id: result.requestId ?? null,
    });
  }

  const isReady =
    state.kind === "ready.pending" ||
    state.kind === "ready.preparing" ||
    state.kind === "ready.accepted" ||
    state.kind === "ready.rejected";

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-xs font-mono uppercase tracking-[0.24em] text-muted-foreground">
            Noon Prototipo
          </p>
          <h1 className="text-2xl font-display md:text-3xl">
            {isReady ? `Tu prototipo` : `Prototipo`}
          </h1>
        </header>

        {isReady ? (
          <>
            <PrototipoFrame data={state.data} />

            {(state.kind === "ready.accepted" || state.kind === "ready.rejected") && (
              <PriorDecisionSummary data={state.data} />
            )}

            {state.kind === "ready.pending" && (
              <DecisionPanel
                token={token}
                prototypeWorkspaceId={state.data.workspace.id}
                submitAction={submitDecisionAction}
              />
            )}

            {state.kind === "ready.preparing" && (
              <aside
                role="status"
                aria-live="polite"
                className="rounded-2xl border border-border bg-card px-6 py-5 text-sm text-muted-foreground"
              >
                <p className="font-medium text-foreground">Preparando tu prototipo</p>
                <p className="mt-1">
                  Estamos terminando de generar la vista previa. Recargá la página en unos
                  minutos.
                </p>
              </aside>
            )}
          </>
        ) : (
          <ErrorStates state={state} />
        )}
      </div>
    </main>
  );
}
