/**
 * lib/maxwell/repositories.ts
 * Capa de persistencia para Maxwell Studio.
 * Migrado de SQLite (node:sqlite) a PostgreSQL (postgres.js / Supabase).
 * Todas las funciones son async.
 */

import { getDb } from "@/lib/server/db";
import { assertValidTransition } from "./state-machine";
import { buildProposalReviewTimeline, deriveProposalExpiry } from "./proposal-lifecycle";
import { PUBLIC_PROPOSAL_STATUSES } from "./proposal-visibility";
import type { WorkspaceStatus } from "./workspace-status";
export type { WorkspaceStatus } from "./workspace-status";
import type {
  ClientRequestType,
  ClientRequestPriority,
  ClientVisibleState,
} from "./client-requests";

// ============================================================================
// Types
// ============================================================================

export type StudioStatus =
  | "intake"
  | "clarifying"
  | "generating_prototype"
  | "prototype_ready"
  | "revision_requested"
  | "revision_applied"
  | "prototype_shared"
  | "approved_for_proposal"
  | "proposal_pending_review"
  | "proposal_sent"
  | "converted";

export type MessageRole = "user" | "assistant" | "system";
export type MessageFeedback = "up" | "down";

export type MessageType =
  | "chat"
  | "thinking"
  | "correction_request"
  | "prototype_announcement"
  | "approval"
  | "proposal_request"
  | "system_event";

export type VersionSource = "initial" | "correction" | "agent_override";

export type ProposalStatus =
  | "pending_review"
  | "under_review"
  | "approved"
  | "sent"
  | "payment_pending"
  | "payment_under_verification"
  | "paid"
  | "expired"
  | "returned"
  | "escalated";

export type ProposalCaseClassification = "normal" | "special";
export type ProposalDeliveryChannel = "email";
export type ProposalDeliveryStatus = "pending_review" | "sent" | "opened";
export type WorkspacePaymentStatus = "pending" | "confirmed" | "failed" | "refunded";
export type WorkspaceUpdateType = "status_update" | "milestone" | "material" | "note";
export type PaymentEventType =
  | "initiated"
  | "received"
  | "confirmed"
  | "failed"
  | "refund_initiated"
  | "refunded";

export type StudioSession = {
  id: string;
  initialPrompt: string;
  status: StudioStatus;
  ownerEmail: string | null;
  ownerName: string | null;
  ownerImage: string | null;
  projectType: string | null;
  goalSummary: string | null;
  complexityHint: string | null;
  language: string;
  correctionsUsed: number;
  maxCorrections: number;
  proposalRequestedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Bloque 11 — id of the classified visual style family (see
   * `lib/maxwell/style-packs.ts`). Null until the first prototype is
   * generated; persists across corrections so the visual identity stays
   * consistent.
   */
  stylePackId: string | null;
  /**
   * ADR-028 D6 — D-upstream wire share state. Populated when the seller
   * shares the current prototipo with the client and App emits a token.
   * Overwritten on regenerate (App supersedes V1, Web's row points at V2).
   * Null until the first share; reverts to null only if a future iteration
   * explicitly unshares.
   */
  prototypeWorkspaceId: string | null;
  shareToken: string | null;
  shareTokenUrl: string | null;
  prototypeSharedAt: string | null;
};

/** Lightweight row for studio history picker (non-deleted sessions only). */
export type StudioSessionListItem = {
  id: string;
  initialPrompt: string;
  status: StudioStatus;
  goalSummary: string | null;
  updatedAt: string;
  /**
   * v3 client portal (Slice 1d) — true when this session has a provisioned
   * client workspace (a `client_workspace` row exists). Drives the
   * "Open workspace" re-entry affordance in Studio. NOTE: this is the
   * post-payment client portal, NOT the Studio prototype-preview pane that the
   * shell/header also call "workspace".
   */
  hasClientWorkspace: boolean;
  /**
   * The owner's public proposal token when the session's latest proposal is in a
   * publicly-viewable status (see proposal-visibility). Drives the "View
   * proposal" link on the chats-list row. Null → no viewable proposal.
   */
  proposalPublicToken: string | null;
};

export type StudioMessage = {
  id: string;
  studioSessionId: string;
  role: MessageRole;
  messageType: MessageType;
  content: string;
  createdAt: string;
  feedback?: MessageFeedback | null;
};

export type StudioBrief = {
  id: string;
  studioSessionId: string;
  objective: string | null;
  users: string | null;
  coreFlow: string | null;
  styleDirection: string | null;
  integrations: string | null;
  assumptions: string | null;
  constraints: string | null;
  platform: string | null;
  primaryUser: string | null;
  answersJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type StudioVersion = {
  id: string;
  studioSessionId: string;
  versionNumber: number;
  previewUrl: string;
  v0ChatId: string;
  changeSummary: string | null;
  source: VersionSource;
  createdAt: string;
  /**
   * Serialized V0 source code for this version (delimited per-file blocks),
   * forwarded to App on share as `prototype.generated_html`. Null for versions
   * created before migration 020 or when V0 returned no files.
   */
  generatedHtml: string | null;
};

export type StudioEventType =
  | "session_created"
  | "status_transition"
  | "brief_updated"
  | "system_recovery"
  | "message_regenerated"
  | "proposal_requested"
  | "proposal_reviewed"
  | "payment_recorded"
  | "workspace_updated";

export type StudioEvent = {
  id: string;
  studioSessionId: string;
  eventType: StudioEventType;
  fromStatus: StudioStatus | null;
  toStatus: StudioStatus | null;
  actor: string | null;
  payloadJson: Record<string, unknown> | null;
  createdAt: string;
};

/** v3 membership billing — the payment modality the client chooses at checkout
 *  (doc maxwell-commercial-constraints.md §2). Activation is charged either way;
 *  membership additionally carries a recurring monthly (manual until M1). */
export type PaymentModality = "one_time" | "membership";

export type ProposalRequest = {
  id: string;
  studioSessionId: string;
  versionNumber: number;
  publicToken: string;
  status: ProposalStatus;
  caseClassification: ProposalCaseClassification;
  reviewRequired: boolean;
  reviewerId: string | null;
  draftContent: string | null;
  deliveryChannel: ProposalDeliveryChannel;
  deliveryStatus: ProposalDeliveryStatus;
  deliveryRecipient: string | null;
  approvedAmountUsd: number | null;
  approvedCurrency: string | null;
  paymentModality: PaymentModality | null;
  monthlyAmountUsd: number | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  /** v3 membership M1: Stripe correlation ids for the recurring subscription. */
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  stripePaidAt: string | null;
  sentAt: string | null;
  firstOpenedAt: string | null;
  expiresAt: string | null;
  reviewNotifiedAt: string;
  reviewRemindedAt: string | null;
  reviewEscalatedAt: string | null;
  autoSendDueAt: string | null;
  supersedesProposalRequestId: string | null;
  supersededByProposalRequestId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProposalWithSession = ProposalRequest & {
  sessionGoalSummary: string | null;
  sessionInitialPrompt: string;
  sessionStatus: StudioStatus;
};

export type ProposalReviewEvent = {
  id: string;
  proposalRequestId: string;
  action: string;
  actor: string;
  notes: string | null;
  createdAt: string;
};

export type ClientWorkspace = {
  id: string;
  studioSessionId: string;
  paymentStatus: WorkspacePaymentStatus;
  workspaceStatus: WorkspaceStatus;
  latestUpdateSummary: string | null;
  /** App's internal project UUID, captured from the payment-confirmed response. */
  noonAppProjectId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceUpdate = {
  id: string;
  clientWorkspaceId: string;
  title: string;
  content: string | null;
  updateType: WorkspaceUpdateType;
  materialUrl: string | null;
  isClientVisible: boolean;
  createdBy: string;
  createdAt: string;
};

export type PaymentEvent = {
  id: string;
  studioSessionId: string;
  eventType: PaymentEventType;
  amountUsd: number | null;
  reference: string | null;
  notes: string | null;
  provider: string | null;
  providerEventId: string | null;
  providerSessionId: string | null;
  providerPaymentIntentId: string | null;
  currency: string | null;
  payloadJson: Record<string, unknown> | null;
  createdBy: string;
  createdAt: string;
};

// ============================================================================
// Raw row types (postgres.js returns snake_case)
// ============================================================================

type SessionRow = {
  id: string; initial_prompt: string; status: string;
  owner_email: string | null; owner_name: string | null; owner_image: string | null;
  project_type: string | null; goal_summary: string | null;
  complexity_hint: string | null; language: string;
  corrections_used: number; max_corrections: number;
  proposal_requested_at: string | Date | null; created_at: string | Date; updated_at: string | Date;
  deleted_at?: string | Date | null;
  /** Bloque 11 — see StudioSession.stylePackId comment. */
  style_pack_id?: string | null;
  /** ADR-028 D6 — D-upstream wire share state. */
  prototype_workspace_id?: string | null;
  share_token?: string | null;
  share_token_url?: string | null;
  prototype_shared_at?: string | Date | null;
};

type MessageRow = {
  id: string; studio_session_id: string; role: string;
  message_type: string; content: string; created_at: string | Date;
};

type MessageWithFeedbackRow = MessageRow & {
  viewer_feedback: string | null;
};

type BriefRow = {
  id: string; studio_session_id: string; objective: string | null;
  users: string | null; core_flow: string | null;
  style_direction: string | null; integrations: string | null;
  assumptions: string | null; constraints: string | null;
  platform: string | null; primary_user: string | null;
  answers_json: unknown; created_at: string | Date; updated_at: string | Date;
};

type VersionRow = {
  id: string; studio_session_id: string; version_number: number;
  preview_url: string; v0_chat_id: string; change_summary: string | null;
  source: string; created_at: string | Date; generated_html: string | null;
};

type ProposalRow = {
  id: string; studio_session_id: string; status: string;
  version_number: number;
  public_token: string;
  case_classification: string;
  review_required: boolean | number; reviewer_id: string | null;
  draft_content: string | null;
  delivery_channel: string;
  delivery_status: string;
  delivery_recipient: string | null;
  approved_amount_usd: number | string | null;
  approved_currency: string | null;
  payment_modality: string | null;
  monthly_amount_usd: number | string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  stripe_paid_at: string | Date | null;
  sent_at: string | Date | null;
  first_opened_at: string | Date | null;
  expires_at: string | Date | null;
  review_notified_at: string | Date;
  review_reminded_at: string | Date | null;
  review_escalated_at: string | Date | null;
  auto_send_due_at: string | Date | null;
  supersedes_proposal_request_id: string | null;
  superseded_by_proposal_request_id: string | null;
  created_at: string | Date; updated_at: string | Date;
};

type ProposalReviewEventRow = {
  id: string;
  proposal_request_id: string;
  action: string;
  actor: string;
  notes: string | null;
  created_at: string | Date;
};

type WorkspaceRow = {
  id: string; studio_session_id: string; payment_status: string;
  workspace_status: string; latest_update_summary: string | null;
  noon_app_project_id: string | null;
  created_at: string | Date; updated_at: string | Date;
};

type UpdateRow = {
  id: string; client_workspace_id: string; title: string;
  content: string | null; update_type: string; material_url: string | null;
  is_client_visible: boolean | number; created_by: string; created_at: string | Date;
};

type PaymentEventRow = {
  id: string; studio_session_id: string; event_type: string;
  amount_usd: number | string | null; reference: string | null;
  notes: string | null; provider: string | null;
  provider_event_id: string | null; provider_session_id: string | null;
  provider_payment_intent_id: string | null; currency: string | null;
  payload_json: unknown; created_by: string; created_at: string | Date;
};

type EventRow = {
  id: string; studio_session_id: string; event_type: string;
  from_status: string | null; to_status: string | null;
  actor: string | null; payload_json: unknown; created_at: string | Date;
};

// ============================================================================
// Mappers
// ============================================================================

const ACTIVE_PROPOSAL_STATUSES: ProposalStatus[] = [
  "pending_review",
  "under_review",
  "approved",
  "payment_pending",
  "payment_under_verification",
  "escalated",
];

// States where the client has acted on the proposal and the workspace is
// expected to materialise shortly. Used to differentiate "workspace not found"
// (404) from "workspace is being prepared" (200 with pending indicator).
export const WORKSPACE_PREPARING_PROPOSAL_STATUSES: ProposalStatus[] = [
  "payment_pending",
  "payment_under_verification",
  "paid",
];

export function isProposalAwaitingWorkspace(status: ProposalStatus): boolean {
  return WORKSPACE_PREPARING_PROPOSAL_STATUSES.includes(status);
}

function toIsoTimestamp(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function toBoolean(value: boolean | number | null | undefined): boolean {
  if (typeof value === "boolean") return value;
  return Number(value) === 1;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === "number" ? value : Number(value);
}

function toJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function mapSession(r: SessionRow): StudioSession {
  return {
    id: r.id, initialPrompt: r.initial_prompt, status: r.status as StudioStatus,
    ownerEmail: r.owner_email, ownerName: r.owner_name, ownerImage: r.owner_image,
    projectType: r.project_type, goalSummary: r.goal_summary,
    complexityHint: r.complexity_hint, language: r.language,
    correctionsUsed: Number(r.corrections_used), maxCorrections: Number(r.max_corrections),
    proposalRequestedAt: toIsoTimestamp(r.proposal_requested_at),
    createdAt: toIsoTimestamp(r.created_at)!,
    updatedAt: toIsoTimestamp(r.updated_at)!,
    stylePackId: r.style_pack_id ?? null,
    prototypeWorkspaceId: r.prototype_workspace_id ?? null,
    shareToken: r.share_token ?? null,
    shareTokenUrl: r.share_token_url ?? null,
    prototypeSharedAt: toIsoTimestamp(r.prototype_shared_at),
  };
}

function mapMessage(r: MessageRow): StudioMessage {
  return {
    id: r.id, studioSessionId: r.studio_session_id,
    role: r.role as MessageRole, messageType: r.message_type as MessageType,
    content: r.content, createdAt: toIsoTimestamp(r.created_at)!,
  };
}

function mapMessageWithFeedback(r: MessageWithFeedbackRow): StudioMessage {
  const feedback =
    r.viewer_feedback === "up" || r.viewer_feedback === "down"
      ? r.viewer_feedback
      : null;

  return {
    ...mapMessage(r),
    feedback,
  };
}

function mapBrief(r: BriefRow): StudioBrief {
  return {
    id: r.id,
    studioSessionId: r.studio_session_id,
    objective: r.objective,
    users: r.users,
    coreFlow: r.core_flow,
    styleDirection: r.style_direction,
    integrations: r.integrations,
    assumptions: r.assumptions,
    constraints: r.constraints,
    platform: r.platform,
    primaryUser: r.primary_user,
    answersJson: toJsonObject(r.answers_json),
    createdAt: toIsoTimestamp(r.created_at)!,
    updatedAt: toIsoTimestamp(r.updated_at)!,
  };
}

function mapVersion(r: VersionRow): StudioVersion {
  return {
    id: r.id, studioSessionId: r.studio_session_id,
    versionNumber: Number(r.version_number), previewUrl: r.preview_url,
    v0ChatId: r.v0_chat_id, changeSummary: r.change_summary,
    source: r.source as VersionSource, createdAt: toIsoTimestamp(r.created_at)!,
    generatedHtml: r.generated_html,
  };
}

function mapProposal(r: ProposalRow): ProposalRequest {
  return {
    id: r.id, studioSessionId: r.studio_session_id,
    versionNumber: Number(r.version_number),
    publicToken: r.public_token,
    status: r.status as ProposalStatus, reviewRequired: toBoolean(r.review_required),
    caseClassification: r.case_classification as ProposalCaseClassification,
    reviewerId: r.reviewer_id, draftContent: r.draft_content,
    deliveryChannel: r.delivery_channel as ProposalDeliveryChannel,
    deliveryStatus: r.delivery_status as ProposalDeliveryStatus,
    deliveryRecipient: r.delivery_recipient,
    approvedAmountUsd: toNumber(r.approved_amount_usd),
    approvedCurrency: r.approved_currency,
    paymentModality: r.payment_modality as PaymentModality | null,
    monthlyAmountUsd: toNumber(r.monthly_amount_usd),
    stripeCheckoutSessionId: r.stripe_checkout_session_id,
    stripePaymentIntentId: r.stripe_payment_intent_id,
    stripeSubscriptionId: r.stripe_subscription_id,
    stripeCustomerId: r.stripe_customer_id,
    stripePaidAt: toIsoTimestamp(r.stripe_paid_at),
    sentAt: toIsoTimestamp(r.sent_at),
    firstOpenedAt: toIsoTimestamp(r.first_opened_at),
    expiresAt: toIsoTimestamp(r.expires_at),
    reviewNotifiedAt: toIsoTimestamp(r.review_notified_at)!,
    reviewRemindedAt: toIsoTimestamp(r.review_reminded_at),
    reviewEscalatedAt: toIsoTimestamp(r.review_escalated_at),
    autoSendDueAt: toIsoTimestamp(r.auto_send_due_at),
    supersedesProposalRequestId: r.supersedes_proposal_request_id,
    supersededByProposalRequestId: r.superseded_by_proposal_request_id,
    createdAt: toIsoTimestamp(r.created_at)!,
    updatedAt: toIsoTimestamp(r.updated_at)!,
  };
}

function mapWorkspace(r: WorkspaceRow): ClientWorkspace {
  return {
    id: r.id, studioSessionId: r.studio_session_id,
    paymentStatus: r.payment_status as WorkspacePaymentStatus,
    workspaceStatus: r.workspace_status as WorkspaceStatus,
    latestUpdateSummary: r.latest_update_summary,
    noonAppProjectId: r.noon_app_project_id ?? null,
    createdAt: toIsoTimestamp(r.created_at)!,
    updatedAt: toIsoTimestamp(r.updated_at)!,
  };
}

function mapUpdate(r: UpdateRow): WorkspaceUpdate {
  return {
    id: r.id, clientWorkspaceId: r.client_workspace_id, title: r.title,
    content: r.content, updateType: r.update_type as WorkspaceUpdateType,
    materialUrl: r.material_url, isClientVisible: toBoolean(r.is_client_visible),
    createdBy: r.created_by, createdAt: toIsoTimestamp(r.created_at)!,
  };
}

function mapPaymentEvent(r: PaymentEventRow): PaymentEvent {
  return {
    id: r.id, studioSessionId: r.studio_session_id,
    eventType: r.event_type as PaymentEventType, amountUsd: toNumber(r.amount_usd),
    reference: r.reference, notes: r.notes,
    provider: r.provider,
    providerEventId: r.provider_event_id,
    providerSessionId: r.provider_session_id,
    providerPaymentIntentId: r.provider_payment_intent_id,
    currency: r.currency,
    payloadJson: r.payload_json && typeof r.payload_json === "object" && !Array.isArray(r.payload_json)
      ? (r.payload_json as Record<string, unknown>)
      : null,
    createdBy: r.created_by, createdAt: toIsoTimestamp(r.created_at)!,
  };
}

function mapEvent(r: EventRow): StudioEvent {
  return {
    id: r.id,
    studioSessionId: r.studio_session_id,
    eventType: r.event_type as StudioEventType,
    fromStatus: (r.from_status as StudioStatus | null) ?? null,
    toStatus: (r.to_status as StudioStatus | null) ?? null,
    actor: r.actor,
    payloadJson: r.payload_json && typeof r.payload_json === "object" && !Array.isArray(r.payload_json)
      ? (r.payload_json as Record<string, unknown>)
      : null,
    createdAt: toIsoTimestamp(r.created_at)!,
  };
}

// ============================================================================
// studio_session
// ============================================================================

export async function createStudioSession(input: {
  initialPrompt: string;
  ownerEmail: string;
  ownerName?: string | null;
  ownerImage?: string | null;
  language?: string;
}): Promise<StudioSession> {
  const sql = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const lang = input.language ?? "en";

  await sql`
    INSERT INTO studio_session (
      id, initial_prompt, status, owner_email, owner_name, owner_image, language,
      corrections_used, max_corrections, created_at, updated_at
    ) VALUES (
      ${id},
      ${input.initialPrompt.trim()},
      'intake',
      ${input.ownerEmail.trim().toLowerCase()},
      ${input.ownerName?.trim() ?? null},
      ${input.ownerImage?.trim() ?? null},
      ${lang},
      0,
      2,
      ${now},
      ${now}
    )
  `;

  return (await getStudioSession(id))!;
}

export async function getStudioSession(id: string): Promise<StudioSession | null> {
  const sql = getDb();
  const rows = await sql<SessionRow[]>`
    SELECT * FROM studio_session
    WHERE id = ${id}
      AND deleted_at IS NULL
  `;
  return rows[0] ? mapSession(rows[0]) : null;
}

export async function listStudioSessionsForOwner(
  ownerEmail: string,
  limit = 80,
): Promise<StudioSessionListItem[]> {
  const sql = getDb();
  const email = ownerEmail.trim().toLowerCase();
  type ListRow = {
    id: string;
    initial_prompt: string;
    status: string;
    goal_summary: string | null;
    updated_at: string | Date;
    has_client_workspace: boolean;
    proposal_public_token: string | null;
  };
  // EXISTS (not a JOIN): a session can have more than one `client_workspace`
  // row (see getClientWorkspaceBySession's `ORDER BY created_at DESC LIMIT 1`),
  // so a JOIN would fan the session row out into duplicates. EXISTS yields one
  // boolean per session.
  const rows = await sql<ListRow[]>`
    SELECT id, initial_prompt, status, goal_summary, updated_at,
           EXISTS (
             SELECT 1 FROM client_workspace cw
             WHERE cw.studio_session_id = studio_session.id
           ) AS has_client_workspace,
           (
             SELECT pr.public_token FROM proposal_request pr
             WHERE pr.studio_session_id = studio_session.id
               AND pr.status = ANY(${sql.array(Array.from(PUBLIC_PROPOSAL_STATUSES))})
             ORDER BY pr.created_at DESC
             LIMIT 1
           ) AS proposal_public_token
    FROM studio_session
    WHERE lower(owner_email) = ${email}
      AND deleted_at IS NULL
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    initialPrompt: r.initial_prompt,
    status: r.status as StudioStatus,
    goalSummary: r.goal_summary,
    updatedAt: toIsoTimestamp(r.updated_at)!,
    hasClientWorkspace: r.has_client_workspace,
    proposalPublicToken: r.proposal_public_token,
  }));
}

export async function softDeleteStudioSession(
  id: string,
  ownerEmail: string,
): Promise<boolean> {
  const sql = getDb();
  const now = new Date().toISOString();
  const email = ownerEmail.trim().toLowerCase();
  const rows = await sql<{ id: string }[]>`
    UPDATE studio_session
    SET deleted_at = ${now}, updated_at = ${now}
    WHERE id = ${id}
      AND lower(owner_email) = ${email}
      AND deleted_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}

export async function updateStudioSessionStatus(
  id: string,
  status: StudioStatus,
  extra?: Partial<Pick<StudioSession, "goalSummary" | "projectType" | "complexityHint" | "proposalRequestedAt">>
): Promise<StudioSession> {
  const current = await getStudioSession(id);
  if (!current) {
    throw new Error(`Studio session not found: ${id}`);
  }

  if (current.status !== status) {
    assertValidTransition(current.status, status);
  }

  const sql = getDb();
  const now = new Date().toISOString();

  await sql`
    UPDATE studio_session
    SET status = ${status},
        goal_summary      = COALESCE(${extra?.goalSummary ?? null}, goal_summary),
        project_type      = COALESCE(${extra?.projectType ?? null}, project_type),
        complexity_hint   = COALESCE(${extra?.complexityHint ?? null}, complexity_hint),
        proposal_requested_at = COALESCE(${extra?.proposalRequestedAt ?? null}, proposal_requested_at),
        updated_at = ${now}
    WHERE id = ${id}
  `;

  return (await getStudioSession(id))!;
}

export async function incrementCorrectionsUsed(id: string): Promise<StudioSession> {
  const sql = getDb();
  const now = new Date().toISOString();
  await sql`
    UPDATE studio_session
    SET corrections_used = corrections_used + 1, updated_at = ${now}
    WHERE id = ${id}
  `;
  return (await getStudioSession(id))!;
}

/**
 * Bloque 11 — record the classified style pack id for this session.
 *
 * Called once per session, the first time a prototype is generated. Subsequent
 * prototype corrections read it back via `getStudioSession()` so the visual
 * identity stays consistent across iterations.
 *
 * No validation on the id format here — the catalogue lives in TypeScript
 * (`lib/maxwell/style-packs.ts`), not the DB, so the constraint is enforced
 * at the call site (typed `StylePack["id"]`).
 */
export async function setStylePackId(
  sessionId: string,
  stylePackId: string,
): Promise<void> {
  const sql = getDb();
  const now = new Date().toISOString();
  await sql`
    UPDATE studio_session
    SET style_pack_id = ${stylePackId},
        updated_at    = ${now}
    WHERE id = ${sessionId}
  `;
}

/**
 * ADR-028 D9 — persist the share state returned by App's `prototype-share`
 * endpoint on the studio session row.
 *
 * All four columns are written together (atomically) per D6: there is never a
 * moment where a session holds a `share_token` without the matching workspace
 * id / URL / timestamp. On regenerate the same call OVERWRITES with the V2
 * values, soft-superseding the V1 share locally.
 *
 * Does NOT transition state — and since 2026-07-14 neither does the caller:
 * sharing is an ATTRIBUTE of the session (these four columns), not a status.
 * The session keeps its current status so the seller retains the full
 * prototype_ready action set after sharing.
 */
export async function updateStudioSessionShareToken(
  sessionId: string,
  input: {
    prototypeWorkspaceId: string;
    shareToken: string;
    shareTokenUrl: string;
    prototypeSharedAt: string;
  },
): Promise<StudioSession> {
  const sql = getDb();
  const now = new Date().toISOString();
  await sql`
    UPDATE studio_session
    SET prototype_workspace_id = ${input.prototypeWorkspaceId},
        share_token            = ${input.shareToken},
        share_token_url        = ${input.shareTokenUrl},
        prototype_shared_at    = ${input.prototypeSharedAt},
        updated_at             = ${now}
    WHERE id = ${sessionId}
  `;
  return (await getStudioSession(sessionId))!;
}

// ============================================================================
// studio_message
// ============================================================================

export async function appendStudioMessage(input: {
  studioSessionId: string;
  role: MessageRole;
  content: string;
  messageType?: MessageType;
}): Promise<StudioMessage> {
  const sql = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const messageType = input.messageType ?? "chat";

  await sql`
    INSERT INTO studio_message (id, studio_session_id, role, message_type, content, created_at)
    VALUES (${id}, ${input.studioSessionId}, ${input.role}, ${messageType}, ${input.content}, ${now})
  `;

  return {
    id, studioSessionId: input.studioSessionId,
    role: input.role, messageType, content: input.content, createdAt: now,
  };
}

export async function getStudioMessages(studioSessionId: string): Promise<StudioMessage[]> {
  const sql = getDb();
  const rows = await sql<MessageRow[]>`
    SELECT * FROM studio_message
    WHERE studio_session_id = ${studioSessionId}
    ORDER BY created_at ASC
  `;
  return rows.map(mapMessage);
}

export async function getStudioMessage(id: string): Promise<StudioMessage | null> {
  const sql = getDb();
  const rows = await sql<MessageRow[]>`
    SELECT * FROM studio_message
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] ? mapMessage(rows[0]) : null;
}

export async function getStudioMessagesForViewer(
  studioSessionId: string,
  viewerEmail: string,
): Promise<StudioMessage[]> {
  const sql = getDb();
  const rows = await sql<MessageWithFeedbackRow[]>`
    SELECT sm.*, smf.feedback AS viewer_feedback
    FROM studio_message sm
    LEFT JOIN studio_message_feedback smf
      ON smf.studio_message_id = sm.id
      AND smf.viewer_email = ${viewerEmail.trim().toLowerCase()}
    WHERE sm.studio_session_id = ${studioSessionId}
    ORDER BY sm.created_at ASC
  `;
  return rows.map(mapMessageWithFeedback);
}

export async function getStudioMessagesForOpenAI(
  studioSessionId: string
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const messages = await getStudioMessages(studioSessionId);
  return messages
    .filter((m) => m.role !== "system" && m.messageType === "chat")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
}

export async function setStudioMessageFeedback(input: {
  studioMessageId: string;
  studioSessionId: string;
  viewerEmail: string;
  feedback: MessageFeedback | null;
}): Promise<MessageFeedback | null> {
  const sql = getDb();
  const viewerEmail = input.viewerEmail.trim().toLowerCase();

  if (!input.feedback) {
    await sql`
      DELETE FROM studio_message_feedback
      WHERE studio_message_id = ${input.studioMessageId}
        AND viewer_email = ${viewerEmail}
    `;
    return null;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await sql`
    INSERT INTO studio_message_feedback (
      id, studio_message_id, studio_session_id, viewer_email,
      feedback, created_at, updated_at
    ) VALUES (
      ${id}, ${input.studioMessageId}, ${input.studioSessionId}, ${viewerEmail},
      ${input.feedback}, ${now}, ${now}
    )
    ON CONFLICT (studio_message_id, viewer_email)
    DO UPDATE SET feedback = EXCLUDED.feedback, updated_at = EXCLUDED.updated_at
  `;

  return input.feedback;
}

// ============================================================================
// studio_brief
// ============================================================================

export async function getStudioBrief(studioSessionId: string): Promise<StudioBrief | null> {
  const sql = getDb();
  const rows = await sql<BriefRow[]>`
    SELECT * FROM studio_brief
    WHERE studio_session_id = ${studioSessionId}
  `;
  return rows[0] ? mapBrief(rows[0]) : null;
}

export async function upsertStudioBrief(input: {
  studioSessionId: string;
  objective?: string | null;
  users?: string | null;
  coreFlow?: string | null;
  styleDirection?: string | null;
  integrations?: string | null;
  assumptions?: string | null;
  constraints?: string | null;
  platform?: string | null;
  primaryUser?: string | null;
  answersJson?: Record<string, unknown>;
}): Promise<StudioBrief> {
  const sql = getDb();
  const existing = await getStudioBrief(input.studioSessionId);
  const now = new Date().toISOString();

  if (existing) {
    const rows = await sql<BriefRow[]>`
      UPDATE studio_brief
      SET objective = COALESCE(${input.objective ?? null}, objective),
          users = COALESCE(${input.users ?? null}, users),
          core_flow = COALESCE(${input.coreFlow ?? null}, core_flow),
          style_direction = COALESCE(${input.styleDirection ?? null}, style_direction),
          integrations = COALESCE(${input.integrations ?? null}, integrations),
          assumptions = COALESCE(${input.assumptions ?? null}, assumptions),
          constraints = COALESCE(${input.constraints ?? null}, constraints),
          platform = COALESCE(${input.platform ?? null}, platform),
          primary_user = COALESCE(${input.primaryUser ?? null}, primary_user),
          answers_json = CASE
            WHEN ${JSON.stringify(input.answersJson ?? null)}::jsonb IS NULL THEN answers_json
            ELSE answers_json || ${JSON.stringify(input.answersJson ?? {})}::jsonb
          END,
          updated_at = ${now}
      WHERE studio_session_id = ${input.studioSessionId}
      RETURNING *
    `;
    return mapBrief(rows[0]);
  }

  const id = crypto.randomUUID();
  const rows = await sql<BriefRow[]>`
    INSERT INTO studio_brief (
      id, studio_session_id, objective, users, core_flow,
      style_direction, integrations, assumptions, constraints,
      platform, primary_user, answers_json, created_at, updated_at
    ) VALUES (
      ${id}, ${input.studioSessionId}, ${input.objective ?? null}, ${input.users ?? null}, ${input.coreFlow ?? null},
      ${input.styleDirection ?? null}, ${input.integrations ?? null}, ${input.assumptions ?? null}, ${input.constraints ?? null},
      ${input.platform ?? null}, ${input.primaryUser ?? null}, ${JSON.stringify(input.answersJson ?? {})}::jsonb, ${now}, ${now}
    )
    RETURNING *
  `;
  return mapBrief(rows[0]);
}

// ============================================================================
// studio_version
// ============================================================================

export async function createStudioVersion(input: {
  studioSessionId: string;
  previewUrl: string;
  v0ChatId: string;
  changeSummary?: string;
  source: VersionSource;
  /** Serialized V0 source code for this version (delimited per-file blocks). */
  generatedHtml?: string | null;
}): Promise<StudioVersion> {
  const sql = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const row = await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${input.studioSessionId}))`;

    const maxRows = await tx<{ max_version: number | null }[]>`
      SELECT MAX(version_number) AS max_version
      FROM studio_version
      WHERE studio_session_id = ${input.studioSessionId}
    `;
    const versionNumber = (maxRows[0]?.max_version ?? 0) + 1;

    const rows = await tx<VersionRow[]>`
      INSERT INTO studio_version (
        id, studio_session_id, version_number,
        preview_url, v0_chat_id, change_summary, source, created_at,
        generated_html
      ) VALUES (
        ${id}, ${input.studioSessionId}, ${versionNumber},
        ${input.previewUrl}, ${input.v0ChatId}, ${input.changeSummary ?? null},
        ${input.source}, ${now},
        ${input.generatedHtml ?? null}
      )
      RETURNING *
    `;

    return rows[0];
  });

  return mapVersion(row);
}

export async function getStudioVersions(studioSessionId: string): Promise<StudioVersion[]> {
  const sql = getDb();
  const rows = await sql<VersionRow[]>`
    SELECT * FROM studio_version
    WHERE studio_session_id = ${studioSessionId}
    ORDER BY version_number ASC
  `;
  return rows.map(mapVersion);
}

export async function getLatestStudioVersion(studioSessionId: string): Promise<StudioVersion | null> {
  const sql = getDb();
  const rows = await sql<VersionRow[]>`
    SELECT * FROM studio_version
    WHERE studio_session_id = ${studioSessionId}
    ORDER BY version_number DESC
    LIMIT 1
  `;
  return rows[0] ? mapVersion(rows[0]) : null;
}

// ============================================================================
// proposal_request
// ============================================================================

export async function createProposalRequest(input: {
  studioSessionId: string;
  draftContent: string;
  caseClassification?: ProposalCaseClassification;
  deliveryRecipient?: string | null;
  supersedesProposalRequestId?: string | null;
}): Promise<ProposalRequest> {
  const sql = getDb();
  const id = crypto.randomUUID();
  const publicToken = crypto.randomUUID();
  const now = new Date().toISOString();
  const timeline = buildProposalReviewTimeline(now);
  const row = await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${input.studioSessionId}))`;

    const existing = await tx<ProposalRow[]>`
      SELECT * FROM proposal_request
      WHERE studio_session_id = ${input.studioSessionId}
        AND status = ANY(${tx.array(ACTIVE_PROPOSAL_STATUSES)})
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (existing[0]) {
      return existing[0];
    }

    const previousRows = await tx<ProposalRow[]>`
      SELECT *
      FROM proposal_request
      WHERE studio_session_id = ${input.studioSessionId}
      ORDER BY version_number DESC, created_at DESC
      LIMIT 1
    `;
    const nextVersionNumber = previousRows[0] ? Number(previousRows[0].version_number) + 1 : 1;

    const rows = await tx<ProposalRow[]>`
      INSERT INTO proposal_request (
        id, studio_session_id, version_number, public_token, status,
        case_classification, review_required, draft_content,
        delivery_channel, delivery_status, delivery_recipient,
        review_notified_at, auto_send_due_at,
        supersedes_proposal_request_id,
        created_at, updated_at
      ) VALUES (
        ${id},
        ${input.studioSessionId},
        ${nextVersionNumber},
        ${publicToken},
        'pending_review',
        ${input.caseClassification ?? "normal"},
        TRUE,
        ${input.draftContent},
        'email',
        'pending_review',
        ${input.deliveryRecipient ?? null},
        ${timeline.reviewNotifiedAt},
        ${timeline.autoSendDueAt},
        ${input.supersedesProposalRequestId ?? null},
        ${now},
        ${now}
      )
      RETURNING *
    `;

    if (input.supersedesProposalRequestId) {
      await tx`
        UPDATE proposal_request
        SET superseded_by_proposal_request_id = ${id},
            updated_at = ${now}
        WHERE id = ${input.supersedesProposalRequestId}
      `;
    }

    return rows[0];
  });

  return mapProposal(row);
}

export async function getProposalRequest(id: string): Promise<ProposalRequest | null> {
  const sql = getDb();
  const rows = await sql<ProposalRow[]>`SELECT * FROM proposal_request WHERE id = ${id}`;
  return rows[0] ? mapProposal(rows[0]) : null;
}

export async function getProposalRequestByPublicToken(publicToken: string): Promise<ProposalRequest | null> {
  const sql = getDb();
  const rows = await sql<ProposalRow[]>`
    SELECT *
    FROM proposal_request
    WHERE public_token = ${publicToken}
    LIMIT 1
  `;
  return rows[0] ? mapProposal(rows[0]) : null;
}

/**
 * v3 membership M1 — correlate a recurring Stripe webhook (invoice.* /
 * customer.subscription.*) back to its proposal via the persisted subscription
 * id. Unique partial index (`proposal_request_stripe_subscription_id_key`)
 * guarantees at most one match. The webhook falls back to
 * `subscription.metadata.external_proposal_id` when this returns null.
 */
export async function getProposalRequestByStripeSubscriptionId(
  stripeSubscriptionId: string,
): Promise<ProposalRequest | null> {
  const sql = getDb();
  const rows = await sql<ProposalRow[]>`
    SELECT *
    FROM proposal_request
    WHERE stripe_subscription_id = ${stripeSubscriptionId}
    LIMIT 1
  `;
  return rows[0] ? mapProposal(rows[0]) : null;
}

export async function updateProposalRequest(id: string, patch: {
  status?: ProposalStatus;
  caseClassification?: ProposalCaseClassification;
  reviewerId?: string | null;
  draftContent?: string | null;
  deliveryStatus?: ProposalDeliveryStatus;
  deliveryRecipient?: string | null;
  approvedAmountUsd?: number | null;
  approvedCurrency?: string | null;
  paymentModality?: PaymentModality | null;
  monthlyAmountUsd?: number | null;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  stripePaidAt?: string | null;
  sentAt?: string | null;
  firstOpenedAt?: string | null;
  expiresAt?: string | null;
  reviewNotifiedAt?: string;
  reviewRemindedAt?: string | null;
  reviewEscalatedAt?: string | null;
  autoSendDueAt?: string | null;
  supersededByProposalRequestId?: string | null;
}): Promise<ProposalRequest> {
  const sql = getDb();
  const now = new Date().toISOString();

  await sql`
    UPDATE proposal_request
    SET status = COALESCE(${patch.status ?? null}, status),
        case_classification = CASE
          WHEN ${patch.caseClassification !== undefined}
            THEN ${patch.caseClassification ?? null}
          ELSE case_classification
        END,
        reviewer_id = CASE
          WHEN ${patch.reviewerId !== undefined}
            THEN ${patch.reviewerId ?? null}
          ELSE reviewer_id
        END,
        draft_content = CASE
          WHEN ${patch.draftContent !== undefined}
            THEN ${patch.draftContent ?? null}
          ELSE draft_content
        END,
        delivery_status = CASE
          WHEN ${patch.deliveryStatus !== undefined}
            THEN ${patch.deliveryStatus ?? null}
          ELSE delivery_status
        END,
        delivery_recipient = CASE
          WHEN ${patch.deliveryRecipient !== undefined}
            THEN ${patch.deliveryRecipient ?? null}
          ELSE delivery_recipient
        END,
        approved_amount_usd = CASE
          WHEN ${patch.approvedAmountUsd !== undefined}
            THEN ${patch.approvedAmountUsd ?? null}
          ELSE approved_amount_usd
        END,
        approved_currency = CASE
          WHEN ${patch.approvedCurrency !== undefined}
            THEN ${patch.approvedCurrency ?? null}
          ELSE approved_currency
        END,
        payment_modality = CASE
          WHEN ${patch.paymentModality !== undefined}
            THEN ${patch.paymentModality ?? null}
          ELSE payment_modality
        END,
        monthly_amount_usd = CASE
          WHEN ${patch.monthlyAmountUsd !== undefined}
            THEN ${patch.monthlyAmountUsd ?? null}
          ELSE monthly_amount_usd
        END,
        stripe_checkout_session_id = CASE
          WHEN ${patch.stripeCheckoutSessionId !== undefined}
            THEN ${patch.stripeCheckoutSessionId ?? null}
          ELSE stripe_checkout_session_id
        END,
        stripe_payment_intent_id = CASE
          WHEN ${patch.stripePaymentIntentId !== undefined}
            THEN ${patch.stripePaymentIntentId ?? null}
          ELSE stripe_payment_intent_id
        END,
        stripe_subscription_id = CASE
          WHEN ${patch.stripeSubscriptionId !== undefined}
            THEN ${patch.stripeSubscriptionId ?? null}
          ELSE stripe_subscription_id
        END,
        stripe_customer_id = CASE
          WHEN ${patch.stripeCustomerId !== undefined}
            THEN ${patch.stripeCustomerId ?? null}
          ELSE stripe_customer_id
        END,
        stripe_paid_at = CASE
          WHEN ${patch.stripePaidAt !== undefined}
            THEN ${patch.stripePaidAt ?? null}
          ELSE stripe_paid_at
        END,
        sent_at = CASE
          WHEN ${patch.sentAt !== undefined}
            THEN ${patch.sentAt ?? null}
          ELSE sent_at
        END,
        first_opened_at = CASE
          WHEN ${patch.firstOpenedAt !== undefined}
            THEN ${patch.firstOpenedAt ?? null}
          ELSE first_opened_at
        END,
        expires_at = CASE
          WHEN ${patch.expiresAt !== undefined}
            THEN ${patch.expiresAt ?? null}
          ELSE expires_at
        END,
        review_notified_at = CASE
          WHEN ${patch.reviewNotifiedAt !== undefined}
            THEN ${patch.reviewNotifiedAt ?? null}
          ELSE review_notified_at
        END,
        review_reminded_at = CASE
          WHEN ${patch.reviewRemindedAt !== undefined}
            THEN ${patch.reviewRemindedAt ?? null}
          ELSE review_reminded_at
        END,
        review_escalated_at = CASE
          WHEN ${patch.reviewEscalatedAt !== undefined}
            THEN ${patch.reviewEscalatedAt ?? null}
          ELSE review_escalated_at
        END,
        auto_send_due_at = CASE
          WHEN ${patch.autoSendDueAt !== undefined}
            THEN ${patch.autoSendDueAt ?? null}
          ELSE auto_send_due_at
        END,
        superseded_by_proposal_request_id = CASE
          WHEN ${patch.supersededByProposalRequestId !== undefined}
            THEN ${patch.supersededByProposalRequestId ?? null}
          ELSE superseded_by_proposal_request_id
        END,
        updated_at = ${now}
    WHERE id = ${id}
  `;

  return (await getProposalRequest(id))!;
}

export async function updateProposalDraftContent(id: string, draftContent: string): Promise<ProposalRequest> {
  return updateProposalRequest(id, { draftContent });
}

export async function getLatestProposalRequest(studioSessionId: string): Promise<ProposalRequest | null> {
  const sql = getDb();
  const rows = await sql<ProposalRow[]>`
    SELECT * FROM proposal_request
    WHERE studio_session_id = ${studioSessionId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] ? mapProposal(rows[0]) : null;
}

export async function updateProposalRequestStatus(
  id: string,
  status: ProposalStatus,
  extra?: {
    reviewerId?: string;
    sentAt?: string | null;
    deliveryStatus?: ProposalDeliveryStatus;
    deliveryRecipient?: string | null;
    caseClassification?: ProposalCaseClassification;
    approvedAmountUsd?: number | null;
    approvedCurrency?: string | null;
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    stripePaidAt?: string | null;
  }
): Promise<ProposalRequest> {
  return updateProposalRequest(id, {
    status,
    reviewerId: extra?.reviewerId,
    sentAt: extra?.sentAt,
    deliveryStatus: extra?.deliveryStatus,
    deliveryRecipient: extra?.deliveryRecipient,
    caseClassification: extra?.caseClassification,
    approvedAmountUsd: extra?.approvedAmountUsd,
    approvedCurrency: extra?.approvedCurrency,
    stripeCheckoutSessionId: extra?.stripeCheckoutSessionId,
    stripePaymentIntentId: extra?.stripePaymentIntentId,
    stripePaidAt: extra?.stripePaidAt,
  });
}

export async function updateProposalExpiry(id: string, expiresAt: string): Promise<ProposalRequest> {
  return updateProposalRequest(id, { expiresAt });
}

export async function createProposalRequestVersion(input: {
  proposalRequestId: string;
  draftContent?: string | null;
  caseClassification?: ProposalCaseClassification;
  deliveryRecipient?: string | null;
}): Promise<ProposalRequest> {
  const source = await getProposalRequest(input.proposalRequestId);
  if (!source) {
    throw new Error(`Proposal request ${input.proposalRequestId} not found.`);
  }

  const next = await createProposalRequest({
    studioSessionId: source.studioSessionId,
    draftContent: input.draftContent ?? source.draftContent ?? "",
    caseClassification: input.caseClassification ?? source.caseClassification,
    deliveryRecipient:
      input.deliveryRecipient !== undefined ? input.deliveryRecipient : source.deliveryRecipient,
    supersedesProposalRequestId: source.id,
  });

  return next;
}

export async function markProposalFirstOpened(publicToken: string): Promise<ProposalRequest | null> {
  const sql = getDb();
  const now = new Date().toISOString();
  let openedNow = false;

  const row = await sql.begin(async (tx) => {
    const rows = await tx<ProposalRow[]>`
      SELECT *
      FROM proposal_request
      WHERE public_token = ${publicToken}
      LIMIT 1
      FOR UPDATE
    `;

    const proposal = rows[0];
    if (!proposal) {
      return null;
    }

    if (proposal.first_opened_at) {
      return proposal;
    }

    openedNow = true;
    const expiresAt = deriveProposalExpiry(now);
    const updatedRows = await tx<ProposalRow[]>`
      UPDATE proposal_request
      SET first_opened_at = ${now},
          expires_at = COALESCE(expires_at, ${expiresAt}),
          delivery_status = CASE
            WHEN delivery_status = 'sent' THEN 'opened'
            ELSE delivery_status
          END,
          updated_at = ${now}
      WHERE id = ${proposal.id}
      RETURNING *
    `;

    return updatedRows[0];
  });

  if (openedNow && row) {
    await appendProposalReviewEvent({
      proposalRequestId: row.id,
      action: "opened",
      actor: "client",
      notes: "First client open recorded for proposal validity.",
    });
  }

  return row ? mapProposal(row) : null;
}

export async function getProposalRequestsWithSession(opts?: {
  statuses?: ProposalStatus[];
  limit?: number;
}): Promise<ProposalWithSession[]> {
  const sql = getDb();
  const limit = opts?.limit ?? 100;
  const statuses = opts?.statuses;

  type JoinedRow = ProposalRow & {
    session_goal_summary: string | null;
    session_initial_prompt: string;
    session_status: string;
  };

  const rows = statuses && statuses.length > 0
    ? await sql<JoinedRow[]>`
        SELECT pr.*, ss.goal_summary AS session_goal_summary,
               ss.initial_prompt AS session_initial_prompt, ss.status AS session_status
        FROM proposal_request pr
        JOIN studio_session ss ON ss.id = pr.studio_session_id
        WHERE pr.status = ANY(${sql.array(statuses)})
        ORDER BY pr.created_at DESC
        LIMIT ${limit}
      `
    : await sql<JoinedRow[]>`
        SELECT pr.*, ss.goal_summary AS session_goal_summary,
               ss.initial_prompt AS session_initial_prompt, ss.status AS session_status
        FROM proposal_request pr
        JOIN studio_session ss ON ss.id = pr.studio_session_id
        ORDER BY pr.created_at DESC
        LIMIT ${limit}
      `;

  return rows.map((row) => ({
    ...mapProposal(row),
    sessionGoalSummary: row.session_goal_summary,
    sessionInitialPrompt: row.session_initial_prompt,
    sessionStatus: row.session_status as StudioStatus,
  }));
}

export async function appendProposalReviewEvent(input: {
  proposalRequestId: string;
  action: string;
  actor: string;
  notes?: string;
}): Promise<ProposalReviewEvent> {
  const sql = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await sql`
    INSERT INTO proposal_review_event (id, proposal_request_id, action, actor, notes, created_at)
    VALUES (${id}, ${input.proposalRequestId}, ${input.action}, ${input.actor}, ${input.notes ?? null}, ${now})
  `;

  return {
    id, proposalRequestId: input.proposalRequestId,
    action: input.action, actor: input.actor,
    notes: input.notes ?? null, createdAt: now,
  };
}

export async function getProposalReviewEvents(
  proposalRequestId: string
): Promise<ProposalReviewEvent[]> {
  const sql = getDb();
  const rows = await sql<ProposalReviewEventRow[]>`
    SELECT *
    FROM proposal_review_event
    WHERE proposal_request_id = ${proposalRequestId}
    ORDER BY created_at DESC
  `;

  return rows.map((row) => ({
    id: row.id,
    proposalRequestId: row.proposal_request_id,
    action: row.action,
    actor: row.actor,
    notes: row.notes,
    createdAt: toIsoTimestamp(row.created_at)!,
  }));
}

// ============================================================================
// client_workspace
// ============================================================================

export async function createClientWorkspace(input: {
  studioSessionId: string;
  paymentStatus: WorkspacePaymentStatus;
}): Promise<ClientWorkspace> {
  const sql = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const initialStatus: WorkspaceStatus =
    input.paymentStatus === "confirmed" ? "active" : "in_preparation";
  const row = await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${input.studioSessionId}))`;

    const existing = await tx<WorkspaceRow[]>`
      SELECT * FROM client_workspace
      WHERE studio_session_id = ${input.studioSessionId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (existing[0]) {
      return existing[0];
    }

    const rows = await tx<WorkspaceRow[]>`
      INSERT INTO client_workspace (
        id, studio_session_id, payment_status, workspace_status, created_at, updated_at
      ) VALUES (${id}, ${input.studioSessionId}, ${input.paymentStatus}, ${initialStatus}, ${now}, ${now})
      RETURNING *
    `;

    return rows[0];
  });

  return mapWorkspace(row);
}

export async function getClientWorkspace(id: string): Promise<ClientWorkspace | null> {
  const sql = getDb();
  const rows = await sql<WorkspaceRow[]>`SELECT * FROM client_workspace WHERE id = ${id}`;
  return rows[0] ? mapWorkspace(rows[0]) : null;
}

export async function getClientWorkspaceBySession(studioSessionId: string): Promise<ClientWorkspace | null> {
  const sql = getDb();
  const rows = await sql<WorkspaceRow[]>`
    SELECT * FROM client_workspace
    WHERE studio_session_id = ${studioSessionId}
    ORDER BY created_at DESC LIMIT 1
  `;
  return rows[0] ? mapWorkspace(rows[0]) : null;
}

/**
 * Reverse lookup: App project id → workspace (B8 #4). The AI-MVP milestone
 * webhook only carries `project_id`; this resolves it back to the workspace
 * (and thus the studio session / recipient) to send the "first version ready"
 * email. The mapping is write-once (see setClientWorkspaceNoonAppProjectId),
 * so at most one row matches in practice.
 */
export async function getClientWorkspaceByNoonAppProjectId(
  noonAppProjectId: string,
): Promise<ClientWorkspace | null> {
  const sql = getDb();
  const rows = await sql<WorkspaceRow[]>`
    SELECT * FROM client_workspace
    WHERE noon_app_project_id = ${noonAppProjectId}
    ORDER BY created_at DESC LIMIT 1
  `;
  return rows[0] ? mapWorkspace(rows[0]) : null;
}

/**
 * Persist App's project id on the workspace, captured from the payment-confirmed
 * response (PR-B). Write-once: only sets the column when it is currently NULL, so
 * a webhook retry or a corrected/different id can never silently overwrite the
 * mapping the client UI relies on. Returns true when this call set the value.
 */
export async function setClientWorkspaceNoonAppProjectId(
  id: string,
  noonAppProjectId: string,
): Promise<boolean> {
  const sql = getDb();
  const now = new Date().toISOString();
  const rows = await sql<{ id: string }[]>`
    UPDATE client_workspace
    SET noon_app_project_id = ${noonAppProjectId}, updated_at = ${now}
    WHERE id = ${id} AND noon_app_project_id IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}

export async function activateClientWorkspace(id: string, latestUpdateSummary?: string): Promise<ClientWorkspace> {
  const sql = getDb();
  const now = new Date().toISOString();
  await sql`
    UPDATE client_workspace
    SET payment_status = 'confirmed', workspace_status = 'active',
        latest_update_summary = COALESCE(${latestUpdateSummary ?? null}, latest_update_summary),
        updated_at = ${now}
    WHERE id = ${id}
  `;
  return (await getClientWorkspace(id))!;
}

export async function updateClientWorkspaceStatus(
  id: string,
  status: WorkspaceStatus,
  latestUpdateSummary?: string
): Promise<ClientWorkspace> {
  const sql = getDb();
  const now = new Date().toISOString();
  await sql`
    UPDATE client_workspace
    SET workspace_status = ${status},
        latest_update_summary = COALESCE(${latestUpdateSummary ?? null}, latest_update_summary),
        updated_at = ${now}
    WHERE id = ${id}
  `;
  return (await getClientWorkspace(id))!;
}

// ============================================================================
// workspace_update
// ============================================================================

export async function createWorkspaceUpdate(input: {
  clientWorkspaceId: string;
  title: string;
  content?: string;
  updateType?: WorkspaceUpdateType;
  materialUrl?: string;
  isClientVisible?: boolean;
  createdBy: string;
}): Promise<WorkspaceUpdate> {
  const sql = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const updateType = input.updateType ?? "status_update";
  const isClientVisible = input.isClientVisible !== false;

  await sql`
    INSERT INTO workspace_update (
      id, client_workspace_id, title, content,
      update_type, material_url, is_client_visible, created_by, created_at
    ) VALUES (
      ${id}, ${input.clientWorkspaceId}, ${input.title}, ${input.content ?? null},
      ${updateType}, ${input.materialUrl ?? null}, ${isClientVisible}, ${input.createdBy}, ${now}
    )
  `;

  return {
    id, clientWorkspaceId: input.clientWorkspaceId, title: input.title,
    content: input.content ?? null, updateType,
    materialUrl: input.materialUrl ?? null, isClientVisible: input.isClientVisible !== false,
    createdBy: input.createdBy, createdAt: now,
  };
}

export async function getWorkspaceUpdates(
  clientWorkspaceId: string,
  opts?: { clientVisibleOnly?: boolean }
): Promise<WorkspaceUpdate[]> {
  const sql = getDb();
  const rows = opts?.clientVisibleOnly
    ? await sql<UpdateRow[]>`
        SELECT * FROM workspace_update
        WHERE client_workspace_id = ${clientWorkspaceId} AND is_client_visible IS TRUE
        ORDER BY created_at DESC
      `
    : await sql<UpdateRow[]>`
        SELECT * FROM workspace_update
        WHERE client_workspace_id = ${clientWorkspaceId}
        ORDER BY created_at DESC
      `;
  return rows.map(mapUpdate);
}

// ============================================================================
// client_comment (v3 client-portal Slice 1b — comment outbox)
// ============================================================================

export type ClientComment = {
  id: string;
  clientWorkspaceId: string;
  body: string;
  /** Stable idempotency key sent to App; == `id`, reused verbatim on retry. */
  externalCommentId: string;
  /** App's comment id from the receiver reply; null until a forward succeeds. */
  noonAppCommentId: string | null;
  /** Set when the forward to App succeeded; null = dead-letter (not delivered). */
  forwardedAt: string | null;
  createdAt: string;
};

type ClientCommentRow = {
  id: string;
  client_workspace_id: string;
  body: string;
  external_comment_id: string;
  noon_app_comment_id: string | null;
  forwarded_at: string | null;
  created_at: string;
};

function mapClientComment(r: ClientCommentRow): ClientComment {
  return {
    id: r.id,
    clientWorkspaceId: r.client_workspace_id,
    body: r.body,
    externalCommentId: r.external_comment_id,
    noonAppCommentId: r.noon_app_comment_id ?? null,
    forwardedAt: r.forwarded_at ?? null,
    createdAt: r.created_at,
  };
}

/**
 * Persist a client comment in the local outbox (the source of truth for the
 * client's message log). `external_comment_id` is set to the row id — one stable
 * key generated once and reused verbatim on every forward retry so App de-dupes
 * cleanly. The forward itself happens in the server action (best-effort).
 */
export async function createClientComment(input: {
  clientWorkspaceId: string;
  body: string;
}): Promise<ClientComment> {
  const sql = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const rows = await sql<ClientCommentRow[]>`
    INSERT INTO client_comment (
      id, client_workspace_id, body, external_comment_id,
      noon_app_comment_id, forwarded_at, created_at
    ) VALUES (
      ${id}, ${input.clientWorkspaceId}, ${input.body}, ${id},
      NULL, NULL, ${now}
    )
    RETURNING *
  `;
  return mapClientComment(rows[0]!);
}

/** Mark a comment as delivered, persisting App's returned comment id (may be null). */
export async function markClientCommentForwarded(
  id: string,
  noonAppCommentId: string | null,
): Promise<void> {
  const sql = getDb();
  const now = new Date().toISOString();
  await sql`
    UPDATE client_comment
    SET forwarded_at = ${now}, noon_app_comment_id = ${noonAppCommentId}
    WHERE id = ${id}
  `;
}

/** The client's message log for a workspace, oldest-first (chat order). */
export async function getClientCommentsByWorkspace(
  clientWorkspaceId: string,
): Promise<ClientComment[]> {
  const sql = getDb();
  const rows = await sql<ClientCommentRow[]>`
    SELECT * FROM client_comment
    WHERE client_workspace_id = ${clientWorkspaceId}
    ORDER BY created_at ASC
  `;
  return rows.map(mapClientComment);
}

// ============================================================================
// client_request (v3 client-request system §9, Slice A — request outbox +
// App-owned client-visible state projection)
// ============================================================================

export type ClientRequest = {
  id: string;
  clientWorkspaceId: string;
  type: ClientRequestType;
  clientPriority: ClientRequestPriority;
  body: string;
  /**
   * Optional link to a project version (B.4). == the App's
   * `versionSequenceNumber`. NoonWeb-owned + immutable after create; null for a
   * request not tied to a version. REQUIRED when `type === "rollback"` (enforced
   * in the server action, not the DB).
   */
  versionRef: number | null;
  /** Opaque submitter id (HMAC of the client email) — never the raw email. */
  submittedBy: string;
  /** Stable idempotency key sent to App; == `id`, reused verbatim on retry. */
  externalRequestId: string;
  /** Set when the create forward to App succeeded; null = dead-letter. */
  forwardedAt: string | null;
  /**
   * App-owned client-visible projection. null until the App pushes the first
   * state (the UI renders null as "Received" copy). NoonWeb NEVER writes this
   * except from the outbound state receiver (Slice B).
   */
  clientVisibleState: ClientVisibleState | null;
  /** Monotonicity guard for the projection; 0 = no App push yet. */
  stateRevision: number;
  stateUpdatedAt: string | null;
  createdAt: string;
};

/** The only update kind the App supports today; 'attachment' (B.5b) is deferred. */
export type ClientRequestUpdateKind = "clarification";

/** A client's clarification reply to a request (B.5a outbox row). */
export type ClientRequestUpdate = {
  id: string;
  clientRequestId: string;
  kind: ClientRequestUpdateKind;
  body: string;
  /** Stable idempotency key sent to App; == `id`, reused verbatim on retry. */
  externalUpdateId: string;
  /** Set when the forward to App succeeded; null = dead-letter. */
  forwardedAt: string | null;
  createdAt: string;
};

/** A request plus its client-posted clarification replies (oldest-first). */
export type ClientRequestWithUpdates = ClientRequest & {
  updates: ClientRequestUpdate[];
};

type ClientRequestRow = {
  id: string;
  client_workspace_id: string;
  type: string;
  client_priority: string;
  body: string;
  version_ref: number | null;
  submitted_by: string;
  external_request_id: string;
  forwarded_at: string | null;
  client_visible_state: string | null;
  state_revision: number;
  state_updated_at: string | null;
  created_at: string;
};

function mapClientRequest(r: ClientRequestRow): ClientRequest {
  return {
    id: r.id,
    clientWorkspaceId: r.client_workspace_id,
    type: r.type as ClientRequestType,
    clientPriority: r.client_priority as ClientRequestPriority,
    body: r.body,
    versionRef: r.version_ref != null ? Number(r.version_ref) : null,
    submittedBy: r.submitted_by,
    externalRequestId: r.external_request_id,
    forwardedAt: r.forwarded_at ?? null,
    clientVisibleState: (r.client_visible_state as ClientVisibleState | null) ?? null,
    stateRevision: Number(r.state_revision),
    stateUpdatedAt: r.state_updated_at ?? null,
    createdAt: r.created_at,
  };
}

type ClientRequestUpdateRow = {
  id: string;
  client_request_id: string;
  kind: string;
  body: string;
  external_update_id: string;
  forwarded_at: string | null;
  created_at: string;
};

function mapClientRequestUpdate(r: ClientRequestUpdateRow): ClientRequestUpdate {
  return {
    id: r.id,
    clientRequestId: r.client_request_id,
    kind: r.kind as ClientRequestUpdateKind,
    body: r.body,
    externalUpdateId: r.external_update_id,
    forwardedAt: r.forwarded_at ?? null,
    createdAt: r.created_at,
  };
}

/**
 * Persist a client request in the local outbox (the source of truth for the
 * client's request log AND the anchor the App-owned client-visible state
 * projects back onto). `external_request_id` is set to the row id — one stable
 * key generated once and reused verbatim on every forward retry so App de-dupes
 * cleanly. The forward itself happens in the server action (best-effort). The
 * projection columns start unset: client_visible_state NULL, state_revision 0.
 */
export async function createClientRequest(input: {
  clientWorkspaceId: string;
  type: ClientRequestType;
  clientPriority: ClientRequestPriority;
  body: string;
  /** Optional version link (B.4); null for a request not tied to a version. */
  versionRef?: number | null;
  submittedBy: string;
}): Promise<ClientRequest> {
  const sql = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const rows = await sql<ClientRequestRow[]>`
    INSERT INTO client_request (
      id, client_workspace_id, type, client_priority, body, version_ref, submitted_by,
      external_request_id, forwarded_at,
      client_visible_state, state_revision, state_updated_at, created_at
    ) VALUES (
      ${id}, ${input.clientWorkspaceId}, ${input.type}, ${input.clientPriority},
      ${input.body}, ${input.versionRef ?? null}, ${input.submittedBy},
      ${id}, NULL,
      NULL, 0, NULL, ${now}
    )
    RETURNING *
  `;
  return mapClientRequest(rows[0]!);
}

/** Mark a request's create-forward as delivered. */
export async function markClientRequestForwarded(id: string): Promise<void> {
  const sql = getDb();
  const now = new Date().toISOString();
  await sql`
    UPDATE client_request
    SET forwarded_at = ${now}
    WHERE id = ${id}
  `;
}

/**
 * The client's request log for a workspace, oldest-first, each request carrying
 * its clarification replies (B.5a), also oldest-first. One extra query, grouped
 * in memory — the request count per workspace is small.
 */
export async function getClientRequestsByWorkspace(
  clientWorkspaceId: string,
): Promise<ClientRequestWithUpdates[]> {
  const sql = getDb();
  const rows = await sql<ClientRequestRow[]>`
    SELECT * FROM client_request
    WHERE client_workspace_id = ${clientWorkspaceId}
    ORDER BY created_at ASC
  `;
  const requests = rows.map(mapClientRequest);
  if (requests.length === 0) return [];

  const updateRows = await sql<ClientRequestUpdateRow[]>`
    SELECT u.* FROM client_request_update u
    JOIN client_request r ON r.id = u.client_request_id
    WHERE r.client_workspace_id = ${clientWorkspaceId}
    ORDER BY u.created_at ASC
  `;
  const byRequest = new Map<string, ClientRequestUpdate[]>();
  for (const row of updateRows) {
    const update = mapClientRequestUpdate(row);
    const list = byRequest.get(update.clientRequestId);
    if (list) list.push(update);
    else byRequest.set(update.clientRequestId, [update]);
  }

  return requests.map((request) => ({
    ...request,
    updates: byRequest.get(request.id) ?? [],
  }));
}

/** Look up one request scoped to a workspace (ownership check for B.5a updates). */
export async function getClientRequestForWorkspace(
  id: string,
  clientWorkspaceId: string,
): Promise<ClientRequest | null> {
  const sql = getDb();
  const rows = await sql<ClientRequestRow[]>`
    SELECT * FROM client_request
    WHERE id = ${id} AND client_workspace_id = ${clientWorkspaceId}
    LIMIT 1
  `;
  return rows[0] ? mapClientRequest(rows[0]) : null;
}

export type ApplyClientRequestStateOutcome = "applied" | "stale" | "not_found";

/**
 * Apply an App-pushed client-visible state to a request (§9 Slice B outbound
 * receiver). Monotonic by `revision`: the guarded UPDATE only advances when the
 * incoming revision strictly exceeds the stored `state_revision`, so a late
 * re-delivery of an older state (durable-queue retry, ADR-027) can never regress
 * what the client sees. This is the ONLY writer of the projection columns —
 * NoonWeb never derives the client-visible state itself.
 *
 * Returns:
 *   - "applied"   — the state advanced,
 *   - "stale"     — the request exists but the revision did not advance (no-op),
 *   - "not_found" — no request with that external id.
 */
export async function applyClientRequestState(
  externalRequestId: string,
  input: { clientVisibleState: ClientVisibleState; revision: number; at: string },
): Promise<ApplyClientRequestStateOutcome> {
  const sql = getDb();
  const updated = await sql<{ id: string }[]>`
    UPDATE client_request
    SET client_visible_state = ${input.clientVisibleState},
        state_revision = ${input.revision},
        state_updated_at = ${input.at}
    WHERE external_request_id = ${externalRequestId}
      AND state_revision < ${input.revision}
    RETURNING id
  `;
  if (updated.length > 0) return "applied";

  const existing = await sql<{ id: string }[]>`
    SELECT id FROM client_request WHERE external_request_id = ${externalRequestId}
  `;
  return existing.length > 0 ? "stale" : "not_found";
}

/**
 * Persist a client's clarification reply in the local outbox (B.5a). The local
 * row is the durable record + the dead-letter anchor; `external_update_id == id`
 * is the stable key reused on every forward retry so the App de-dupes on
 * `(externalRequestId, updateId)`. The forward itself happens in the server
 * action (best-effort).
 */
export async function createClientRequestUpdate(input: {
  clientRequestId: string;
  kind: ClientRequestUpdateKind;
  body: string;
}): Promise<ClientRequestUpdate> {
  const sql = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const rows = await sql<ClientRequestUpdateRow[]>`
    INSERT INTO client_request_update (
      id, client_request_id, kind, body, external_update_id, forwarded_at, created_at
    ) VALUES (
      ${id}, ${input.clientRequestId}, ${input.kind}, ${input.body}, ${id}, NULL, ${now}
    )
    RETURNING *
  `;
  return mapClientRequestUpdate(rows[0]!);
}

/** Mark a request-update's forward as delivered. */
export async function markClientRequestUpdateForwarded(id: string): Promise<void> {
  const sql = getDb();
  const now = new Date().toISOString();
  await sql`
    UPDATE client_request_update
    SET forwarded_at = ${now}
    WHERE id = ${id}
  `;
}

// ============================================================================
// client_request_attachment (§9 B.5b — attachment outbox; bytes in Supabase Storage)
// ============================================================================

export type ClientRequestAttachment = {
  id: string;
  clientRequestId: string;
  /** Private Supabase Storage object key (NoonWeb-owned). */
  blobKey: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  /** Optional note accompanying the file. */
  body: string | null;
  /** Stable idempotency key sent to App as `updateId`; == `id`, reused on retry. */
  externalUpdateId: string;
  forwardedAt: string | null;
  createdAt: string;
};

type ClientRequestAttachmentRow = {
  id: string;
  client_request_id: string;
  blob_key: string;
  filename: string;
  mime: string;
  size_bytes: number;
  body: string | null;
  external_update_id: string;
  forwarded_at: string | null;
  created_at: string;
};

function mapClientRequestAttachment(r: ClientRequestAttachmentRow): ClientRequestAttachment {
  return {
    id: r.id,
    clientRequestId: r.client_request_id,
    blobKey: r.blob_key,
    filename: r.filename,
    mime: r.mime,
    sizeBytes: Number(r.size_bytes),
    body: r.body ?? null,
    externalUpdateId: r.external_update_id,
    forwardedAt: r.forwarded_at ?? null,
    createdAt: r.created_at,
  };
}

/**
 * Persist a client attachment in the local outbox (B.5b). The bytes already live
 * in Storage at `blobKey`; this row is the durable record + dead-letter anchor.
 * `external_update_id == id` is the stable key reused on every forward retry so
 * the App de-dupes on `(externalRequestId, updateId)`.
 */
export async function createClientRequestAttachment(input: {
  clientRequestId: string;
  blobKey: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  body?: string | null;
}): Promise<ClientRequestAttachment> {
  const sql = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const rows = await sql<ClientRequestAttachmentRow[]>`
    INSERT INTO client_request_attachment (
      id, client_request_id, blob_key, filename, mime, size_bytes, body,
      external_update_id, forwarded_at, created_at
    ) VALUES (
      ${id}, ${input.clientRequestId}, ${input.blobKey}, ${input.filename},
      ${input.mime}, ${input.sizeBytes}, ${input.body ?? null},
      ${id}, NULL, ${now}
    )
    RETURNING *
  `;
  return mapClientRequestAttachment(rows[0]!);
}

/** Mark an attachment's forward as delivered. */
export async function markClientRequestAttachmentForwarded(id: string): Promise<void> {
  const sql = getDb();
  const now = new Date().toISOString();
  await sql`
    UPDATE client_request_attachment
    SET forwarded_at = ${now}
    WHERE id = ${id}
  `;
}

/** A workspace's attachments for a request, oldest-first (display). */
export async function getClientRequestAttachmentsByRequest(
  clientRequestId: string,
): Promise<ClientRequestAttachment[]> {
  const sql = getDb();
  const rows = await sql<ClientRequestAttachmentRow[]>`
    SELECT * FROM client_request_attachment
    WHERE client_request_id = ${clientRequestId}
    ORDER BY created_at ASC
  `;
  return rows.map(mapClientRequestAttachment);
}

/**
 * Resolve an attachment for the App's signed-read, gated on the parent request's
 * project being payment-activated (the §B.5b access gate). Returns only what the
 * signed-read needs (the Storage key + display metadata), or null → 404
 * non-revealing. The HMAC on the endpoint is the authn; this is the authz/resolve.
 */
export async function getAttachmentForSignedRead(
  id: string,
): Promise<{ blobKey: string; mime: string; filename: string } | null> {
  const sql = getDb();
  const rows = await sql<{ blob_key: string; mime: string; filename: string }[]>`
    SELECT a.blob_key, a.mime, a.filename
    FROM client_request_attachment a
    JOIN client_request r ON r.id = a.client_request_id
    JOIN client_workspace w ON w.id = r.client_workspace_id
    WHERE a.id = ${id} AND w.noon_app_project_id IS NOT NULL
    LIMIT 1
  `;
  const row = rows[0];
  return row ? { blobKey: row.blob_key, mime: row.mime, filename: row.filename } : null;
}

// ============================================================================
// payment_event
// ============================================================================

export async function appendPaymentEvent(input: {
  studioSessionId: string;
  eventType: PaymentEventType;
  amountUsd?: number;
  reference?: string;
  notes?: string;
  provider?: string;
  providerEventId?: string;
  providerSessionId?: string;
  providerPaymentIntentId?: string;
  currency?: string;
  payloadJson?: Record<string, unknown> | null;
  createdBy: string;
}): Promise<PaymentEvent> {
  const sql = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const rows = await sql<PaymentEventRow[]>`
    INSERT INTO payment_event (
      id, studio_session_id, event_type, amount_usd,
      reference, notes, provider, provider_event_id,
      provider_session_id, provider_payment_intent_id, currency,
      payload_json, created_by, created_at
    ) VALUES (
      ${id}, ${input.studioSessionId}, ${input.eventType}, ${input.amountUsd ?? null},
      ${input.reference ?? null}, ${input.notes ?? null}, ${input.provider ?? null},
      ${input.providerEventId ?? null}, ${input.providerSessionId ?? null},
      ${input.providerPaymentIntentId ?? null}, ${input.currency ?? null},
      ${JSON.stringify(input.payloadJson ?? null)}::jsonb, ${input.createdBy}, ${now}
    )
    ON CONFLICT (provider_event_id) WHERE provider_event_id IS NOT NULL DO NOTHING
    RETURNING *
  `;

  if (rows[0]) {
    return mapPaymentEvent(rows[0]);
  }

  if (input.providerEventId) {
    const existing = await getPaymentEventByProviderEventId(input.providerEventId);
    if (existing) return existing;
  }

  throw new Error("Payment event insert was ignored but no existing event was found.");
}

export async function getPaymentEvents(studioSessionId: string): Promise<PaymentEvent[]> {
  const sql = getDb();
  const rows = await sql<PaymentEventRow[]>`
    SELECT * FROM payment_event
    WHERE studio_session_id = ${studioSessionId}
    ORDER BY created_at ASC
  `;
  return rows.map(mapPaymentEvent);
}

export async function getPaymentEventByProviderEventId(
  providerEventId: string,
): Promise<PaymentEvent | null> {
  const sql = getDb();
  const rows = await sql<PaymentEventRow[]>`
    SELECT *
    FROM payment_event
    WHERE provider_event_id = ${providerEventId}
    LIMIT 1
  `;
  return rows[0] ? mapPaymentEvent(rows[0]) : null;
}

/**
 * Look up a CONFIRMED payment event by the Stripe checkout session id. Used to
 * de-duplicate activation across the two paths that race for the same session:
 * the Stripe webhook and the client's return from Checkout. The `confirmed`
 * filter is essential — the checkout route writes an `initiated` event under the
 * same `provider_session_id`, and that one must NOT count as an existing
 * confirmation.
 */
export async function getConfirmedPaymentEventBySessionId(
  providerSessionId: string,
): Promise<PaymentEvent | null> {
  const sql = getDb();
  const rows = await sql<PaymentEventRow[]>`
    SELECT *
    FROM payment_event
    WHERE provider_session_id = ${providerSessionId}
      AND event_type = 'confirmed'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] ? mapPaymentEvent(rows[0]) : null;
}

// ============================================================================
// studio_event
// ============================================================================

export async function appendStudioEvent(input: {
  studioSessionId: string;
  eventType: StudioEventType;
  fromStatus?: StudioStatus | null;
  toStatus?: StudioStatus | null;
  actor?: string | null;
  payloadJson?: Record<string, unknown> | null;
}): Promise<StudioEvent> {
  const sql = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const rows = await sql<EventRow[]>`
    INSERT INTO studio_event (
      id, studio_session_id, event_type,
      from_status, to_status, actor, payload_json, created_at
    ) VALUES (
      ${id}, ${input.studioSessionId}, ${input.eventType},
      ${input.fromStatus ?? null}, ${input.toStatus ?? null},
      ${input.actor ?? null}, ${JSON.stringify(input.payloadJson ?? null)}::jsonb, ${now}
    )
    RETURNING *
  `;

  return mapEvent(rows[0]);
}

export async function getStudioEvents(studioSessionId: string): Promise<StudioEvent[]> {
  const sql = getDb();
  const rows = await sql<EventRow[]>`
    SELECT * FROM studio_event
    WHERE studio_session_id = ${studioSessionId}
    ORDER BY created_at ASC
  `;
  return rows.map(mapEvent);
}

// ============================================================================
// proposal_access_audit (B19)
//
// Append-only audit table for public access to /maxwell/proposal/[token].
// Schema in supabase/migrations/20260518_015_proposal_access_audit.sql.
// ============================================================================

/** Constrained set of audit actions — keep in sync with the CHECK constraint. */
export type ProposalAccessAction =
  | "page_view"
  | "page_view_blocked"
  | "payment_evidence"
  | "status_change";

/**
 * Insert one row into proposal_access_audit. Append-only, never updates.
 *
 * Designed to be called from a RSC or route handler AFTER any rate-limit
 * check has settled (so we capture blocked accesses too). Caller is
 * responsible for computing the SHA-256 hash of the client IP via
 * `hashClientIp()` from `lib/server/audit/client-ip.ts` — the table
 * never sees the raw IP.
 *
 * Never throws on insert failure — audit MUST NOT break the user flow.
 * Failures are swallowed and logged at the call site (see helper
 * `recordProposalAccessSafe()` in the same audit module).
 */
export async function insertProposalAccessAudit(input: {
  proposalToken: string;
  action: ProposalAccessAction;
  responseStatus: number;
  clientIpHash?: string | null;
  userAgentTruncated?: string | null;
}): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO proposal_access_audit (
      proposal_token, action, response_status, client_ip_hash, user_agent_truncated
    ) VALUES (
      ${input.proposalToken},
      ${input.action},
      ${input.responseStatus},
      ${input.clientIpHash ?? null},
      ${input.userAgentTruncated ?? null}
    )
  `;
}

// ============================================================================
// ai_mvp_milestone  (cross-repo post-payment pipeline milestones from App)
// ============================================================================

/** §19.3 client-copy keys — keep in sync with the CHECK constraint (migration 0021). */
export type AiMvpMilestoneKind = "started" | "version-ready" | "escalated";

export type AiMvpMilestone = {
  id: string;
  projectId: string;
  kind: AiMvpMilestoneKind;
  versionUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type AiMvpMilestoneRow = {
  id: string;
  project_id: string;
  kind: AiMvpMilestoneKind;
  version_url: string | null;
  created_at: string;
  updated_at: string;
};

function mapAiMvpMilestone(r: AiMvpMilestoneRow): AiMvpMilestone {
  return {
    id: r.id,
    projectId: r.project_id,
    kind: r.kind,
    versionUrl: r.version_url,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Persist one inbound AI MVP milestone, idempotent on (project_id, kind).
 *
 * App's durable queue retries on any non-2xx, so the same milestone can land
 * repeatedly (handoff §5/§6). The UNIQUE (project_id, kind) constraint mirrors
 * App's idempotency key `aimvp-milestone:<project_id>:<kind>`, making dedup
 * structural rather than time-based:
 *
 *   - First arrival            → INSERT, `created: true`.
 *   - Retry (same project+kind)→ ON CONFLICT updates `version_url` only when a
 *     non-null one arrives (a later `version-ready` re-send that finally carries
 *     a resolved URL fills the gap; an early null never clobbers a stored URL).
 *     Returns `created: false`.
 *
 * Either way the row is upserted and the caller can safely return 2xx.
 */
export async function recordAiMvpMilestone(input: {
  projectId: string;
  kind: AiMvpMilestoneKind;
  versionUrl?: string | null;
}): Promise<{ milestone: AiMvpMilestone; created: boolean }> {
  const sql = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // xmax = 0 on a freshly inserted row; non-zero when the row already existed
  // and the ON CONFLICT branch ran. This distinguishes first-arrival from retry
  // without a second round-trip.
  const rows = await sql<(AiMvpMilestoneRow & { was_inserted: boolean })[]>`
    INSERT INTO ai_mvp_milestone (id, project_id, kind, version_url, created_at, updated_at)
    VALUES (${id}, ${input.projectId}, ${input.kind}, ${input.versionUrl ?? null}, ${now}, ${now})
    ON CONFLICT (project_id, kind) DO UPDATE SET
      version_url = COALESCE(EXCLUDED.version_url, ai_mvp_milestone.version_url),
      updated_at = ${now}
    RETURNING *, (xmax = 0) AS was_inserted
  `;

  const row = rows[0];
  const { was_inserted, ...milestoneRow } = row;
  return { milestone: mapAiMvpMilestone(milestoneRow), created: was_inserted };
}

/** All milestones for a project, newest transition first. Source for the PR-B UI. */
export async function getAiMvpMilestonesByProjectId(
  projectId: string,
): Promise<AiMvpMilestone[]> {
  const sql = getDb();
  const rows = await sql<AiMvpMilestoneRow[]>`
    SELECT * FROM ai_mvp_milestone
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
  `;
  return rows.map(mapAiMvpMilestone);
}

// ---------------------------------------------------------------------------
// Proposal-review-decision receiver idempotency ledger (contract §7.6,
// migration 20260708_031). The App emits `X-Noon-Idempotency-Key:
// <external_proposal_id>:<decision>` on EVERY delivery (first attempt, retries,
// admin replays); a duplicate key must replay the first successful response
// body verbatim without re-running side effects (emails, state transitions).
// ---------------------------------------------------------------------------

/** The stored first-success response for an idempotency key; null when fresh. */
export async function findReceivedProposalReviewDecision(
  idempotencyKey: string,
): Promise<{ responseBody: unknown } | null> {
  const sql = getDb();
  const rows = await sql<{ response_body: unknown }[]>`
    SELECT response_body FROM proposal_review_decision_received
    WHERE idempotency_key = ${idempotencyKey}
    LIMIT 1
  `;
  return rows.length > 0 ? { responseBody: rows[0].response_body } : null;
}

/**
 * Record a successful (2xx) processing outcome under its idempotency key.
 * ON CONFLICT DO NOTHING: if a concurrent delivery recorded first, the earlier
 * body stays authoritative (both processed the same logical decision; the
 * handler's state-based early-returns make the loser's side effects no-ops).
 */
export async function recordReceivedProposalReviewDecision(input: {
  idempotencyKey: string;
  externalProposalId: string;
  decision: string;
  responseBody: unknown;
}): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO proposal_review_decision_received
      (id, idempotency_key, external_proposal_id, decision, response_body, created_at)
    VALUES
      (${crypto.randomUUID()}, ${input.idempotencyKey}, ${input.externalProposalId},
       ${input.decision}, ${JSON.stringify(input.responseBody ?? null)}::jsonb, ${new Date().toISOString()})
    ON CONFLICT (idempotency_key) DO NOTHING
  `;
}

// ============================================================================
// F5-05 (auditoría 2026-07) — queries del reaper: sesiones in-flight colgadas
// y dead-letters del outbox (forwarded_at IS NULL). Los índices parciales
// *_unforwarded (migraciones 023/024) existían sin consumidor; estas queries
// son ese consumidor.
// ============================================================================

export type RevertedStudioSession = { id: string; status: StudioStatus };

/**
 * Revierte sesiones de studio abandonadas a mitad de generación — el único
 * revert existente (`revertInFlightSession` en el poll) depende de que el
 * browser del cliente siga polleando. Mismo mapping que el poll:
 * `generating_prototype` → `clarifying`; `revision_*` → `prototype_ready`.
 * El umbral del caller debe superar de sobra el poll budget (~3 min).
 */
export async function revertStaleInFlightStudioSessions(
  cutoffIso: string,
): Promise<RevertedStudioSession[]> {
  const sql = getDb();
  const now = new Date().toISOString();
  return sql<RevertedStudioSession[]>`
    UPDATE studio_session
    SET status = CASE
          WHEN status = 'generating_prototype' THEN 'clarifying'
          ELSE 'prototype_ready'
        END,
        updated_at = ${now}
    WHERE status IN ('generating_prototype', 'revision_requested', 'revision_applied')
      AND updated_at < ${cutoffIso}
      AND deleted_at IS NULL
    RETURNING id, status
  `;
}

export type UnforwardedClientComment = {
  id: string;
  body: string;
  externalCommentId: string;
  createdAt: string;
  noonAppProjectId: string;
};

/** Dead-letters de comment con workspace mapeado a proyecto App (re-forwardeables). */
export async function listUnforwardedClientComments(
  cutoffIso: string,
  limit: number,
): Promise<UnforwardedClientComment[]> {
  const sql = getDb();
  return sql<UnforwardedClientComment[]>`
    SELECT c.id, c.body, c.external_comment_id AS "externalCommentId",
           c.created_at AS "createdAt", w.noon_app_project_id AS "noonAppProjectId"
    FROM client_comment c
    JOIN client_workspace w ON w.id = c.client_workspace_id
    WHERE c.forwarded_at IS NULL
      AND c.created_at < ${cutoffIso}
      AND w.noon_app_project_id IS NOT NULL
    ORDER BY c.created_at ASC
    LIMIT ${limit}
  `;
}

export type UnforwardedClientRequest = {
  id: string;
  type: ClientRequestType;
  clientPriority: ClientRequestPriority;
  body: string;
  versionRef: number | null;
  submittedBy: string;
  externalRequestId: string;
  createdAt: string;
  noonAppProjectId: string;
};

export async function listUnforwardedClientRequests(
  cutoffIso: string,
  limit: number,
): Promise<UnforwardedClientRequest[]> {
  const sql = getDb();
  return sql<UnforwardedClientRequest[]>`
    SELECT r.id, r.type, r.client_priority AS "clientPriority", r.body,
           r.version_ref::int AS "versionRef", r.submitted_by AS "submittedBy",
           r.external_request_id AS "externalRequestId", r.created_at AS "createdAt",
           w.noon_app_project_id AS "noonAppProjectId"
    FROM client_request r
    JOIN client_workspace w ON w.id = r.client_workspace_id
    WHERE r.forwarded_at IS NULL
      AND r.created_at < ${cutoffIso}
      AND w.noon_app_project_id IS NOT NULL
    ORDER BY r.created_at ASC
    LIMIT ${limit}
  `;
}

export type UnforwardedClientRequestUpdate = {
  id: string;
  body: string;
  externalUpdateId: string;
  createdAt: string;
  parentExternalRequestId: string;
};

/**
 * Solo updates cuyo request padre YA fue forwardeado — la App resuelve el update
 * por el externalRequestId del padre; si el padre es él mismo un dead-letter,
 * el forward daría 4xx determinista. El barrido de requests corre antes, así
 * que el padre se destranca en una pasada anterior (o la misma).
 */
export async function listUnforwardedClientRequestUpdates(
  cutoffIso: string,
  limit: number,
): Promise<UnforwardedClientRequestUpdate[]> {
  const sql = getDb();
  return sql<UnforwardedClientRequestUpdate[]>`
    SELECT u.id, u.body, u.external_update_id AS "externalUpdateId",
           u.created_at AS "createdAt", r.external_request_id AS "parentExternalRequestId"
    FROM client_request_update u
    JOIN client_request r ON r.id = u.client_request_id
    WHERE u.forwarded_at IS NULL
      AND u.created_at < ${cutoffIso}
      AND r.forwarded_at IS NOT NULL
    ORDER BY u.created_at ASC
    LIMIT ${limit}
  `;
}

export type UnforwardedClientRequestAttachment = {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  body: string | null;
  externalUpdateId: string;
  createdAt: string;
  parentExternalRequestId: string;
};

export async function listUnforwardedClientRequestAttachments(
  cutoffIso: string,
  limit: number,
): Promise<UnforwardedClientRequestAttachment[]> {
  const sql = getDb();
  return sql<UnforwardedClientRequestAttachment[]>`
    SELECT a.id, a.filename, a.mime, a.size_bytes::int AS "sizeBytes", a.body,
           a.external_update_id AS "externalUpdateId", a.created_at AS "createdAt",
           r.external_request_id AS "parentExternalRequestId"
    FROM client_request_attachment a
    JOIN client_request r ON r.id = a.client_request_id
    WHERE a.forwarded_at IS NULL
      AND a.created_at < ${cutoffIso}
      AND r.forwarded_at IS NOT NULL
    ORDER BY a.created_at ASC
    LIMIT ${limit}
  `;
}
