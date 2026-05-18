import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { getReviewRequestAccess } from "@/lib/auth/review";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import {
  getStudioSession,
  getClientWorkspaceBySession,
  getWorkspaceUpdates,
  createWorkspaceUpdate,
  updateClientWorkspaceStatus,
  appendPaymentEvent,
  getPaymentEvents,
  getLatestProposalRequest,
  isProposalAwaitingWorkspace,
} from "@/lib/maxwell/repositories";
import type { WorkspaceStatus } from "@/lib/maxwell/repositories";
import { WORKSPACE_STATUS_VALUES } from "@/lib/maxwell/workspace-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const addUpdateSchema = z.object({
  action: z.literal("add_update"),
  workspace_id: z.string().min(1),
  title: z.string().min(1).max(200),
  content: z.string().max(4000).optional(),
  update_type: z.enum(["status_update", "milestone", "material", "note"]).optional(),
  material_url: z.string().url().optional(),
  is_client_visible: z.boolean().optional(),
  created_by: z.string().min(1).optional(),
});

const changeStatusSchema = z.object({
  action: z.literal("change_status"),
  workspace_id: z.string().min(1),
  status: z.enum(WORKSPACE_STATUS_VALUES),
  summary: z.string().max(500).optional(),
});

const logPaymentSchema = z.object({
  action: z.literal("log_payment"),
  session_id: z.string().min(1),
  event_type: z.enum([
    "initiated",
    "received",
    "confirmed",
    "failed",
    "refund_initiated",
    "refunded",
  ]),
  amount_usd: z.number().positive().optional(),
  reference: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  created_by: z.string().min(1).optional(),
});

const workspaceActionSchema = z.discriminatedUnion("action", [
  addUpdateSchema,
  changeStatusSchema,
  logPaymentSchema,
]);

export async function GET(request: Request) {
  const reviewAccess = await getReviewRequestAccess(request);
  const viewer = reviewAccess.viewer ?? (await getAuthenticatedViewer());
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");
  const isInternal = reviewAccess.authorized;

  if (!sessionId) {
    return NextResponse.json({ message: "Missing session_id." }, { status: 400 });
  }

  if (!viewer && !isInternal) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const session = await getStudioSession(sessionId);
  if (!session) {
    return NextResponse.json({ message: "Session not found." }, { status: 404 });
  }

  if (!isInternal && viewer && !viewerOwnsStudioSession(viewer, session)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const workspace = await getClientWorkspaceBySession(sessionId);
  if (!workspace) {
    // Differentiate "preparing" (proposal in a payment-related state, workspace
    // not yet provisioned) from "not found" (no payment activity at all).
    // The client UI uses workspace_status: "pending" to show an intermediate
    // view instead of a 404. See roadmap §5 Día 2 (B12).
    const proposal = await getLatestProposalRequest(sessionId);
    if (proposal && isProposalAwaitingWorkspace(proposal.status)) {
      return NextResponse.json({
        workspace: null,
        workspace_status: "pending",
        proposal_status: proposal.status,
        project_name: session.goalSummary,
        message: "Workspace is being prepared.",
      });
    }
    return NextResponse.json({ message: "Workspace not found." }, { status: 404 });
  }

  const updates = await getWorkspaceUpdates(workspace.id, {
    clientVisibleOnly: !isInternal,
  });
  const paymentEvents = isInternal ? await getPaymentEvents(sessionId) : [];

  return NextResponse.json({
    workspace,
    workspace_status: "ready",
    project_name: session.goalSummary,
    updates,
    ...(isInternal ? { payment_events: paymentEvents } : {}),
  });
}

export async function POST(request: Request) {
  const access = await getReviewRequestAccess(request);
  if (!access.authorized) {
    const status = access.reason === "sign_in_required" ? 401 : 403;
    return NextResponse.json({ message: "Unauthorized." }, { status });
  }

  try {
    const body = await request.json();
    const payload = workspaceActionSchema.parse(body);

    if (payload.action === "add_update") {
      const update = await createWorkspaceUpdate({
        clientWorkspaceId: payload.workspace_id,
        title: payload.title,
        content: payload.content,
        updateType: payload.update_type,
        materialUrl: payload.material_url,
        isClientVisible: payload.is_client_visible,
        createdBy: payload.created_by ?? access.actor,
      });
      return NextResponse.json({ update, message: "Update added." });
    }

    if (payload.action === "change_status") {
      const updated = await updateClientWorkspaceStatus(
        payload.workspace_id,
        payload.status as WorkspaceStatus,
        payload.summary,
      );
      return NextResponse.json({
        workspace: updated,
        message: `Status changed to ${payload.status}.`,
      });
    }

    const event = await appendPaymentEvent({
      studioSessionId: payload.session_id,
      eventType: payload.event_type,
      amountUsd: payload.amount_usd,
      reference: payload.reference,
      notes: payload.notes,
      createdBy: payload.created_by ?? access.actor,
    });

    return NextResponse.json({ event, message: "Payment event logged." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid request.", fieldErrors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    console.error("Workspace error:", error);
    return NextResponse.json(
      { message: "Action failed. Please try again." },
      { status: 500 },
    );
  }
}
