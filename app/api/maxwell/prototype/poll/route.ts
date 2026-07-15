import { NextResponse } from "next/server";
import { getV0PrototypeStatus } from "@/lib/api-ia";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import {
  getStudioSession,
  createStudioVersion,
  getLatestStudioVersion,
  updateStudioSessionStatus,
  appendStudioMessage,
  type StudioSession,
} from "@/lib/maxwell/repositories";
import {
  hasExceededPollBudget,
  normalizePollAttempt,
  shouldRescueUnstableCompletion,
} from "@/lib/maxwell/prototype-poll-policy";
import { log } from "@/lib/server/logger";
import { serializeV0Source } from "@/lib/maxwell/serialize-v0-source";
import { findMissingLocalImports } from "@/lib/maxwell/prototype-source-integrity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Revert an in-flight session out of its generating/revision state when the
 * poll loop gives up, so it is not left orphaned. Reads the current status
 * first and only transitions from the expected in-flight states, mirroring the
 * v0-error reverts in `app/api/maxwell/prototype/route.ts`:
 *   - create flow stuck in `generating_prototype` → `clarifying`
 *   - update flow stuck in `revision_requested` / `revision_applied` → `prototype_ready`
 */
async function revertInFlightSession(
  session: StudioSession,
  action: string,
): Promise<void> {
  const fresh = await getStudioSession(session.id);
  if (!fresh) return;
  if (action === "create" && fresh.status === "generating_prototype") {
    await updateStudioSessionStatus(fresh.id, "clarifying");
  } else if (
    action === "update" &&
    (fresh.status === "revision_requested" || fresh.status === "revision_applied")
  ) {
    await updateStudioSessionStatus(fresh.id, "prototype_ready");
  }
}

async function isPreviewUrlReady(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    log.debug("maxwell.prototype.poll", "Checking preview URL", {
      url_prefix: url.substring(0, 50),
    });
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
      }
    });

    const contentType = response.headers.get("content-type") ?? "";
    log.debug("maxwell.prototype.poll", "Preview URL response", {
      status: response.status,
      content_type: contentType,
    });

    if (!response.ok) return false;

    return contentType.includes("text/html");
  } catch (err) {
    log.error("maxwell.prototype.poll", err, { phase: "preview_url_fetch" });
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get("chatId");
    const sessionId = searchParams.get("session_id");
    const action = searchParams.get("action");
    const prompt = searchParams.get("prompt");
    const previousDemoUrl = searchParams.get("previous_demo_url");
    const previousVersionId = searchParams.get("previous_version_id");
    const confirmationToken = searchParams.get("confirmation_token");
    // 1-based poll attempt sent by the client. Bounds the loop (give-up cap +
    // signature-instability rescue) — see lib/maxwell/prototype-poll-policy.ts.
    const attempt = normalizePollAttempt(searchParams.get("attempt"));

    if (!chatId || !sessionId || !action) {
      return NextResponse.json({ message: "Missing query params" }, { status: 400 });
    }

    if (!process.env.V0_API_KEY) {
      return NextResponse.json({ message: "V0 API key is not configured." }, { status: 503 });
    }

    const viewer = await getAuthenticatedViewer();
    if (!viewer) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const session = await getStudioSession(sessionId);
    if (!session) {
      return NextResponse.json({ message: "Session not found." }, { status: 404 });
    }
    if (!viewerOwnsStudioSession(viewer, session)) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    // Call v0 API to check status
    const statusResult = await getV0PrototypeStatus(chatId);

    // Bounded-loop guard: the client passes its 1-based attempt count. Once it
    // reaches the hard cap without a committable version, give up gracefully —
    // revert the in-flight session so it is not orphaned in `generating_prototype`
    // (or a revision state), and report `failed` so the client stops recursing.
    // A genuinely-ready prototype is committed well before this cap thanks to the
    // rescue threshold below, so reaching it means the preview never stabilized.
    if (hasExceededPollBudget(attempt)) {
      await revertInFlightSession(session, action);
      log.info("maxwell.prototype.poll", "Poll budget exceeded — giving up", {
        session_id: session.id,
        action,
        attempt,
        last_status: statusResult.status,
      });
      return NextResponse.json({ status: "failed", code: "POLL_TIMEOUT" });
    }

    if (statusResult.status === "pending") {
      return NextResponse.json({ status: "pending" });
    }

    if (statusResult.status === "failed") {
      // Revert status to clarifying
      await updateStudioSessionStatus(session.id, "clarifying");
      return NextResponse.json({ status: "failed" });
    }

    if (statusResult.status === "completed") {
      if (!statusResult.demoUrl) {
         await updateStudioSessionStatus(session.id, "clarifying");
         return NextResponse.json({ status: "failed", message: "Demo URL is missing." });
      }

      const baseDemoUrl = statusResult.demoUrl.split("?")[0];
      const completionSignature = `${statusResult.versionId ?? "unknown"}|${baseDemoUrl}`;

      // Guardrail: require one extra poll cycle with the same completed signature.
      // This reduces race conditions where v0 marks completed before the final preview
      // is fully stabilized for immediate rendering.
      //
      // Rescue: v0's chat-mode can keep regenerating the version id, so the
      // signature never stabilizes and the loop would never end. Once we are past
      // the rescue threshold, stop requiring stabilization and accept the latest
      // completed version — the preview-ready gate below still protects against
      // committing a cold URL. See lib/maxwell/prototype-poll-policy.ts.
      const stabilized = confirmationToken === completionSignature;
      if (!stabilized && !shouldRescueUnstableCompletion(attempt)) {
        return NextResponse.json({ status: "pending", completion_token: completionSignature });
      }

      // Content gate (W2, 2026-07-14 E2E): v0 can report completed while the
      // emitted source imports components it never generated — the demo shell
      // still serves HTML, so the preview-ready check below is blind to it,
      // and committing the version burns the client's monthly quota on a
      // broken deploy. Keep answering `pending` while imports are unresolved:
      // either v0's next revision emits the missing files (the "completed
      // before all files" race) or the poll budget cap turns this into a
      // clean `failed` with no version committed.
      const missingImports = findMissingLocalImports(statusResult.files);
      if (missingImports.length > 0) {
        log.warn("maxwell.prototype.poll", "Completed version has unresolved local imports — holding commit", {
          session_id: session.id,
          action,
          attempt,
          missing_imports: missingImports.slice(0, 10),
        });
        return NextResponse.json({ status: "pending", completion_token: completionSignature });
      }

      // Even when v0 reports completed, the preview endpoint can still be warming up.
      // Keep polling until the URL serves a real HTML response.
      const previewReady = await isPreviewUrlReady(statusResult.demoUrl);
      if (!previewReady) {
        return NextResponse.json({ status: "pending", completion_token: completionSignature });
      }

      // v0 may briefly report "completed" while still serving the previous preview URL.
      // For updates, wait until the preview URL/version changes before committing a new version.
      if (
        action === "update" &&
        (
          (previousDemoUrl && baseDemoUrl === previousDemoUrl.split("?")[0]) ||
          (previousVersionId && statusResult.versionId && statusResult.versionId === previousVersionId)
        )
      ) {
        return NextResponse.json({ status: "pending" });
      }

      // Additional guard to avoid storing duplicate versions when URL has not changed.
      const latestVersion = await getLatestStudioVersion(session.id);
      if (latestVersion && latestVersion.previewUrl.split("?")[0] === baseDemoUrl) {
        return NextResponse.json({ status: "pending" });
      }

      // Generation successful. Commit to Database. Persist the V0 source code
      // (serialized per-file blocks) so the share flow can forward it to App as
      // `prototype.generated_html` for the post-payment Opus pipeline. Null when
      // V0 returned no files — the share action then omits the field and the
      // version degrades to demo-url-only.
      const generatedHtml = serializeV0Source(statusResult.files);
      const version = await createStudioVersion({
        studioSessionId: session.id,
        previewUrl: statusResult.demoUrl, // Guardamos la URL completa con el token para el iframe
        v0ChatId: chatId,
        changeSummary: action === "update" && prompt ? prompt : undefined,
        source: action === "update" ? "correction" : "initial",
        generatedHtml,
      });

      if (action === "create") {
        await appendStudioMessage({
          studioSessionId: session.id,
          role: "assistant",
          content: `Prototype Version ${version.versionNumber} generated.`,
          messageType: "prototype_announcement",
        });
        await updateStudioSessionStatus(session.id, "prototype_ready");

        return NextResponse.json({
          status: "completed",
          chatId: chatId,
          demoUrl: statusResult.demoUrl,
          version_id: statusResult.versionId ?? null,
          session_id: session.id,
          session_status: "prototype_ready",
          version_number: version.versionNumber,
          corrections_used: session.correctionsUsed,
          max_corrections: session.maxCorrections,
        });
      } else if (action === "update") {
        if (prompt) {
          await appendStudioMessage({
            studioSessionId: session.id,
            role: "user",
            content: prompt,
            messageType: "correction_request",
          });
        }
    
        await updateStudioSessionStatus(session.id, "revision_applied");
        await updateStudioSessionStatus(session.id, "prototype_ready");

        return NextResponse.json({
          status: "completed",
          chatId: chatId,
          demoUrl: statusResult.demoUrl,
          version_id: statusResult.versionId ?? null,
          session_id: session.id,
          session_status: "prototype_ready",
          version_number: version.versionNumber,
          corrections_used: session.correctionsUsed,
          max_corrections: session.maxCorrections,
        });
      }
    }

    return NextResponse.json({ status: "unknown" });
  } catch (error) {
    log.error("maxwell.prototype.poll", error);
    return NextResponse.json(
      { message: "Could not poll the prototype status right now.", status: "error" },
      { status: 500 }
    );
  }
}
