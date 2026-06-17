import { NextResponse } from "next/server";
import { applyClientRequestState } from "@/lib/maxwell/repositories";
import { assertNoInternalFields } from "@/lib/security/project-isolation";
import { log } from "@/lib/server/logger";
import {
  NoonAppIntegrationError,
  noonAppClientRequestStatePayloadSchema,
  readSignedNoonAppRawJson,
} from "@/lib/noon-app-integration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Receiver for App's §9 client-request client-visible STATE push (Slice B).
 *
 * The App owns the operational state; it collapses its 8 states to the 5
 * client-safe ones server-side and pushes the projection here over the same
 * durable, HMAC-signed queue the other receivers use (ADR-027). This endpoint:
 *
 *   1. Verifies the signature over the RAW bytes (`${ts}.${rawBody}`, ±5min,
 *      missing-timestamp rejected per F-1).
 *   2. Runs the §8.3 `assertNoInternalFields` tripwire on the RAW body, then an
 *      ALLOWLIST parse (`.strict()`) that rejects any unmodeled key — so a leaked
 *      classification/priority/escalation field is a 400, never a stored row.
 *   3. Applies the state MONOTONICALLY by `revision` (the repository discards a
 *      push whose revision does not advance), so a late re-delivery can never
 *      regress what the client sees.
 *
 * Reuses `NOON_WEBSITE_WEBHOOK_SECRET` — no new secret. The App only needs
 * `NOON_WEBSITE_CLIENT_REQUEST_STATE_URL` pointing here.
 */
export async function POST(request: Request) {
  try {
    const raw = await readSignedNoonAppRawJson(request);

    // §8.3 tripwire on the RAW body, before the allowlist parse. Belt-and-
    // suspenders with the `.strict()` schema below (which rejects ALL unmodeled
    // keys); this gives a precise message for known internal field names.
    try {
      assertNoInternalFields(raw, "client-request-state receiver");
    } catch (error) {
      throw new NoonAppIntegrationError(
        error instanceof Error ? error.message : "Internal field leaked.",
        400,
      );
    }

    const parsed = noonAppClientRequestStatePayloadSchema.safeParse(raw);
    if (!parsed.success) {
      throw new NoonAppIntegrationError(
        parsed.error.issues[0]?.message ?? "Invalid payload.",
        400,
      );
    }
    const payload = parsed.data;

    const outcome = await applyClientRequestState(payload.externalRequestId, {
      clientVisibleState: payload.clientVisibleState,
      revision: payload.revision,
      at: payload.at,
    });

    if (outcome === "not_found") {
      // Non-revealing 404 — parity with the proposal-review-decision receiver.
      return NextResponse.json({ message: "Client request not found." }, { status: 404 });
    }

    // 'stale' returns 200 (idempotent no-op) so the durable queue stops retrying
    // a re-delivered older revision.
    return NextResponse.json({
      message:
        outcome === "applied"
          ? "Client request state applied."
          : "Client request state ignored (stale revision).",
      externalRequestId: payload.externalRequestId,
      applied: outcome === "applied",
      clientVisibleState: payload.clientVisibleState,
      revision: payload.revision,
    });
  } catch (error) {
    if (error instanceof NoonAppIntegrationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    log.error("integrations.noon-app.client-request-state", error);
    return NextResponse.json(
      { message: "Noon App client request state webhook failed." },
      { status: 500 },
    );
  }
}
