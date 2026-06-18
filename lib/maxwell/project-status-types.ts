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
 * Forward-compat: we DO NOT use `.strict()`. Stripping unknown keys keeps the
 * consumer tolerant of additive producer changes. Fase 2 (versioning contract
 * co-signed 2026-06-18 — see docs/2026-06-17-v3-fase2-versioning-publish-design.md
 * §9.2) added `published` per version + top-level `publishedSequence`/`publishedUrl`
 * (modeled below) and WIDENED the per-version `state` from a single literal to the
 * App's client-visible publish lifecycle. `state` is now a plain string so a new
 * lifecycle value never rejects the payload (see the version schema note).
 *
 * Signing input for the GET is the empty-body trailing-dot convention
 * `${unix_timestamp}.` (same as `lib/maxwell/prototipo-render-fetch.ts`).
 */

import { z } from "zod";

/**
 * A client-visible version row. Fase 2 widens this from Slice 1a's single
 * `ready_for_client_preview` literal to the App's full client-visible publish
 * lifecycle (`published | previous_published | rolled_back`), co-signed
 * 2026-06-18.
 *
 * `state` is a PLAIN STRING on purpose. A `z.literal`/`z.enum` would reject any
 * new lifecycle value and fail the ENTIRE versions[] (and thus the whole status
 * read). Keeping it a string lets NoonWeb own the client-facing label (§8.1) and
 * degrade any unmapped/future state to a neutral label via `mapVersionStateToMeta`
 * — exactly how `project.status` is handled by `mapProjectStatusToMeta`.
 */
export const projectStatusVersionSchema = z.object({
  sequence: z.number(),
  state: z.string(),
  // Permissive on purpose: a malformed/odd preview URL on a single version must
  // not reject the whole status payload. URL validity is a render-time concern.
  previewUrl: z.string().nullable(),
  at: z.string(),
  // Fase 2 (NEW): convenience boolean === (state === 'published'). Optional so the
  // pre-Fase-2 producer (which omits it) still parses; the UI treats `state` as
  // the canonical signal and never relies on this boolean alone.
  published: z.boolean().optional(),
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
  // Fase 2 (NEW): which version sequence is the live published one + its public
  // client-facing URL. Optional/nullable so the pre-Fase-2 producer (which omits
  // both) still parses; absent → "nothing published yet".
  publishedSequence: z.number().nullable().optional(),
  publishedUrl: z.string().nullable().optional(),
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
