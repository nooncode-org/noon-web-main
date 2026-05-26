/**
 * app/[locale]/maxwell/prototipo/[token]/_actions/submit-decision.ts
 *
 * Server Action invoked by `DecisionPanel` (client component) when the client
 * clicks accept or reject. Thin wrapper over `submitPrototipoDecision`
 * (lib/maxwell/prototipo-decision.ts) that:
 *
 *   1. Pulls the client's user agent from the request headers (server-side
 *      RSC headers — never trusts a value passed from the client).
 *   2. Calls the helper to POST to App.
 *   3. Maps the wire result → UX state for the panel to render.
 *   4. On success, revalidates the public prototipo page so the next render
 *      reflects the new decision (`PriorDecisionSummary` instead of the
 *      decision form).
 *
 * The action returns a plain JSON-serializable shape so the client transition
 * can pattern-match on `uxState.kind`.
 */

"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { submitPrototipoDecision } from "@/lib/maxwell/prototipo-decision";
import {
  mapResultToUxState,
  type PrototipoDecisionUxState,
} from "@/lib/maxwell/prototipo-decision-types";
import { log } from "@/lib/server/logger";

export type SubmitDecisionActionInput = {
  token: string;
  prototypeWorkspaceId: string;
  decision: "accepted" | "rejected";
  notes?: string;
};

export type SubmitDecisionActionResult = {
  uxState: PrototipoDecisionUxState;
};

export async function submitDecisionAction(
  input: SubmitDecisionActionInput,
): Promise<SubmitDecisionActionResult> {
  const h = await headers();
  const userAgent = h.get("user-agent") ?? undefined;

  const result = await submitPrototipoDecision({
    token: input.token,
    prototypeWorkspaceId: input.prototypeWorkspaceId,
    decision: input.decision,
    notes: input.notes,
    clientUserAgent: userAgent,
  });

  const uxState = mapResultToUxState(result, input.decision);

  if (result.status === "ok") {
    log.info(
      "prototipo.decision.submitted",
      "Decision recorded by App",
      {
        decision: input.decision,
        is_replay: result.isReplay,
      },
    );
    // Locale-agnostic path — revalidating the [token] segment refreshes
    // whichever locale the client is on. The next render reads fresh GET
    // data and switches to `ready.accepted` / `ready.rejected`.
    revalidatePath("/[locale]/maxwell/prototipo/[token]", "page");
  } else {
    log.warn(
      "prototipo.decision.error",
      "Decision submit returned non-ok",
      {
        decision: input.decision,
        code: result.code,
        http_status: result.httpStatus,
        request_id: result.requestId ?? null,
      },
    );
  }

  return { uxState };
}
