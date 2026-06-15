/**
 * lib/maxwell/project-status-types.ts
 *
 * Wire types + Zod schema + error taxonomy for the v3 client-portal
 * project-status signed-read (Web → App outbound GET, Slice 1a of the v3
 * client portal — `docs/v3-client-portal-plan.md` §3.1/§4).
 *
 * The App is the data PRODUCER (`App-nooncode/lib/server/projects/
 * client-status-view.ts` → `buildProjectStatusClientView`); NoonWeb is the
 * CONSUMER and conforms to that shape. The 200 envelope is
 * `{ data: {...}, requestId }` in **camelCase** (the co-signed v3 casing rule:
 * new v3 wires are camelCase; the legacy POST webhooks stay snake_case).
 *
 * Anti-leak guarantee (§8.3 / §3.2 of the plan): the Zod schema below is a
 * POSITIVE ALLOWLIST. Zod's default `.parse` STRIPS unknown keys, so any field
 * the App did not intend to expose (and any internal column accidentally
 * spread — `budget`, `developer_user_id`, …) is dropped before it can reach the
 * UI. That strip is the real enforcement; `assertNoInternalFields` in the
 * fetch helper is a defensive tripwire on the raw body on top of it.
 *
 * Forward-compat: we DO NOT use `.strict()`. Fase 2 will add fields to
 * `versions[]` (`published`/`published_url`); a strict schema would reject that
 * future-but-valid payload and break the portal. Stripping unknown keys keeps
 * the consumer tolerant of additive producer changes.
 *
 * Signing input for the GET is the empty-body trailing-dot convention
 * `${unix_timestamp}.` (same as `lib/maxwell/prototipo-render-fetch.ts`).
 */

import { z } from "zod";

/**
 * A client-visible version row. Thin in Fase 1 — the App only emits versions in
 * `state: 'ready_for_client_preview'` and Slice 1a does not render them yet
 * (version display / publish / rollback is Fase 2). Modeled here for
 * forward-compat so the envelope parses cleanly once versions are populated.
 */
export const projectStatusVersionSchema = z.object({
  sequence: z.number(),
  state: z.literal("ready_for_client_preview"),
  // Permissive on purpose: a malformed/odd preview URL on a single version must
  // not reject the whole status payload. URL validity is a render-time concern.
  previewUrl: z.string().nullable(),
  at: z.string(),
});

export type ProjectStatusVersion = z.infer<typeof projectStatusVersionSchema>;

export const projectStatusDataSchema = z.object({
  project: z.object({
    id: z.string(),
    name: z.string(),
    // Raw `project_status` enum — NoonWeb owns the client-facing label
    // (master-spec-v3 §8.1). Kept as a string so an unrecognised future enum
    // value degrades to a neutral label instead of rejecting the payload.
    status: z.string(),
  }),
  proposal: z
    .object({
      title: z.string(),
      amount: z.coerce.number(),
      currency: z.string(),
      paymentStatus: z.string().nullable(),
    })
    .nullable(),
  payment: z.object({
    activated: z.boolean(),
    status: z.string().nullable(),
  }),
  versions: z.array(projectStatusVersionSchema),
  // The producer always emits this (it falls back to `project.updated_at`), but
  // the frozen contract sketch allowed `| null`, so we tolerate null defensively.
  latestUpdate: z
    .object({
      kind: z.literal("status_changed"),
      status: z.string(),
      at: z.string(),
    })
    .nullable(),
  serverTime: z.string(),
});

export type ProjectStatusData = z.infer<typeof projectStatusDataSchema>;

export const projectStatusEnvelopeSchema = z.object({
  data: projectStatusDataSchema,
  // Always present at the top level (the route wraps `{ ...body, requestId }`),
  // but tolerated-missing so a contract drift on requestId never blocks a read.
  requestId: z.string().nullish(),
});

export type ProjectStatusEnvelope = z.infer<typeof projectStatusEnvelopeSchema>;

/**
 * Error taxonomy. Mirrors the App-side codes for `project-status`
 * (`PROJECT_STATUS_*`) plus the shared auth / rate-limit codes. `UNKNOWN` is the
 * safety valve when the App omits or returns an unrecognised `code` field.
 */
export const PROJECT_STATUS_ERROR_CODES = {
  NOT_FOUND: "PROJECT_STATUS_NOT_FOUND",
  INTERNAL_FAILED: "PROJECT_STATUS_INTERNAL_FAILED",
  INVALID_REQUEST: "INVALID_REQUEST",
  AUTH_FAILED: "WEBSITE_WEBHOOK_AUTH_FAILED",
  RATE_LIMITED: "RATE_LIMITED",
  UNKNOWN: "UNKNOWN_ERROR",
} as const;

export type ProjectStatusErrorCode =
  (typeof PROJECT_STATUS_ERROR_CODES)[keyof typeof PROJECT_STATUS_ERROR_CODES];

/**
 * Discriminated union returned by `fetchNoonAppProjectStatus`. Never thrown —
 * every failure (including misconfigured env) is folded into the `error`
 * variant so the workspace Server Component can call it without try/catch and
 * fall back to the local `workspace_status` when `status === "error"`.
 */
export type FetchProjectStatusResult =
  | {
      status: "ok";
      data: ProjectStatusData;
      requestId: string | null;
      cacheControl: string | null;
    }
  | {
      status: "error";
      code: ProjectStatusErrorCode;
      httpStatus: number;
      message: string;
      requestId: string | null;
    };
