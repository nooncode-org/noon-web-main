/**
 * lib/maxwell/portal-support-requests.ts
 *
 * The two administrative asks a client can file from the portal's settings —
 * cancelling their plan and exporting their project data.
 *
 * **Why these are `support` and not their own types.** The 10 client-request
 * types are FROZEN cross-repo (`client-requests.ts`; the App enforces them with
 * a DB CHECK), so a dedicated `cancel_plan` would need a coordinated migration on
 * both sides. `support` is the right existing vocabulary — "help, not new work" —
 * and, critically, it is NOT in {@link MEMBERSHIP_ONLY_REQUEST_TYPES}, so the
 * Server Action accepts it from a one-time buyer too (a one-time client can
 * legitimately ask for an export).
 *
 * **Why the copy lives here and not inline in the dialog.** These bodies are read
 * by whoever picks the request up on the App side — they are operator-facing, and
 * the cancellation one carries a warning that must not get lost in an edit: this
 * request does NOT cancel anything in Stripe. Pure module so it can be tested.
 */

import {
  DEFAULT_CLIENT_REQUEST_PRIORITY,
  type ClientRequestPriority,
  type ClientRequestType,
} from "@/lib/maxwell/client-requests";

export type PortalSupportRequestKind = "cancel_membership" | "export_project_data";

export type PortalSupportRequest = {
  type: ClientRequestType;
  clientPriority: ClientRequestPriority;
  body: string;
};

/**
 * The request to file for a given portal action.
 *
 * Cancellation is `high`, not the default: it is time-sensitive money. Every day
 * it sits unread is a day closer to charging a client who believes they already
 * cancelled — the exact failure this whole path exists to prevent.
 */
export function portalSupportRequest(kind: PortalSupportRequestKind): PortalSupportRequest {
  if (kind === "cancel_membership") {
    return {
      type: "support",
      clientPriority: "high",
      body:
        "CANCELLATION requested from the portal (Settings -> Billing -> danger zone). " +
        "The client asked to cancel their membership and expects Noon to reach out to confirm " +
        "what happens with their site, domain and data. " +
        "Nothing has been cancelled in Stripe by this request.",
    };
  }
  return {
    type: "support",
    clientPriority: DEFAULT_CLIENT_REQUEST_PRIORITY,
    body:
      "Project data export requested from the portal (Settings -> Project data). " +
      "The client asked for a full export - code, content and assets - to be sent as a secure " +
      "download link by email.",
  };
}

/**
 * What to type into the chat when the request path isn't available (no session
 * wired: the proposal page, the wspreview playground). A human hand-off, never a
 * silently swallowed click.
 */
export function portalSupportChatFallback(kind: PortalSupportRequestKind): string {
  return kind === "cancel_membership"
    ? "Hi — I'd like to cancel my membership. Could you walk me through what happens next?"
    : "Hi — I'd like a full export of my project data.";
}
