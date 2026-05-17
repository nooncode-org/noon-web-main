import { NextResponse } from "next/server";
import { z } from "zod";
import { getV0PrototypeStatus } from "@/lib/api-ia";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import {
  getStudioSession,
  createStudioVersion,
  getLatestStudioVersion,
  updateStudioSessionStatus,
  appendStudioMessage,
} from "@/lib/maxwell/repositories";
import { log } from "@/lib/server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      if (confirmationToken !== completionSignature) {
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

      // Generation successful. Commit to Database.
      const version = await createStudioVersion({
        studioSessionId: session.id,
        previewUrl: statusResult.demoUrl, // Guardamos la URL completa con el token para el iframe
        v0ChatId: chatId,
        changeSummary: action === "update" && prompt ? prompt : undefined,
        source: action === "update" ? "correction" : "initial",
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
