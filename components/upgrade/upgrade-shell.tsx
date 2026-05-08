"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, RefreshCcw } from "lucide-react";
import type { SessionWithDetails } from "@/lib/upgrade/types";
import { UpgradeStatusPoller } from "./upgrade-status-poller";
import { UpgradeAuditPanel } from "./upgrade-audit";
import { UpgradeVersionPanel } from "./upgrade-version";
import { UpgradeQuestions } from "./upgrade-questions";
import { Button } from "@/components/ui/button";

type Props = {
  initialSession: SessionWithDetails;
};

function StatusIndicator({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending: "Getting ready…",
    crawling: "Scanning your website…",
    crawl_done: "Website scanned — answering questions",
    analyzing: "Analyzing content with AI…",
    audit_ready: "Audit complete",
    generating: "Creating upgraded version…",
    version_ready: "Upgraded version ready",
    transferred: "Transferred to Maxwell",
    proposal_sent: "Proposal requested",
    archived: "Session archived",
    error: "Something went wrong",
  };

  const isActive = ["crawling", "analyzing", "generating"].includes(status);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {isActive && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      <span>{labels[status] ?? status}</span>
    </div>
  );
}

export function UpgradeShell({ initialSession }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isStartingAudit, setIsStartingAudit] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isRequestingProposal, setIsRequestingProposal] = useState(false);
  const [isStartingAnalysis, setIsStartingAnalysis] = useState(false);

  const sessionId = initialSession.id;

  // ── Start audit ─────────────────────────────────────────────────────────
  async function handleStartAudit() {
    setActionError(null);
    setIsStartingAudit(true);
    try {
      const res = await fetch(`/api/upgrade/${sessionId}/audit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) setActionError(data.message ?? "Failed to start audit.");
      // Status change handled by poller
    } catch {
      setActionError("Connection error. Please try again.");
    } finally {
      setIsStartingAudit(false);
    }
  }

  // ── Start analysis (after questions answered) ────────────────────────────
  async function handleAnalyze() {
    setActionError(null);
    setIsStartingAnalysis(true);
    try {
      const res = await fetch(`/api/upgrade/${sessionId}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.message ?? "Failed to start analysis.");
        return;
      }
      // Refresh server data so poller picks up the new "analyzing" status
      startTransition(() => router.refresh());
    } catch {
      setActionError("Connection error. Please try again.");
    } finally {
      setIsStartingAnalysis(false);
    }
  }

  // ── Generate version ─────────────────────────────────────────────────────
  async function handleGenerateVersion(correctionNote?: string) {
    setActionError(null);
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/upgrade/${sessionId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correctionNote: correctionNote ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) setActionError(data.message ?? "Failed to generate version.");
    } catch {
      setActionError("Connection error. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  // ── Continue with Maxwell ────────────────────────────────────────────────
  async function handleContinueWithMaxwell() {
    setActionError(null);
    setIsTransferring(true);
    try {
      const res = await fetch(`/api/upgrade/${sessionId}/handoff`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.message ?? "Failed to transfer to Maxwell.");
        return;
      }
      startTransition(() => {
        router.push(data.redirectTo ?? "/maxwell/studio");
      });
    } catch {
      setActionError("Connection error. Please try again.");
    } finally {
      setIsTransferring(false);
    }
  }

  // ── Request proposal ─────────────────────────────────────────────────────
  async function handleRequestProposal() {
    setActionError(null);
    setIsRequestingProposal(true);
    try {
      const res = await fetch(`/api/upgrade/${sessionId}/proposal`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.message ?? "Failed to create proposal.");
        return;
      }

      startTransition(() => {
        router.push("/upgrade");
      });
    } catch {
      setActionError("Connection error. Please try again.");
    } finally {
      setIsRequestingProposal(false);
    }
  }

  return (
    <UpgradeStatusPoller sessionId={sessionId} initialSession={initialSession}>
      {(session, isPolling) => (
        <div className="space-y-6">
          {/* Status bar */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground truncate max-w-xs">
                {session.websiteUrlRaw}
              </p>
              <StatusIndicator status={session.status} />
            </div>
            {isPolling && (
              <span className="text-xs text-muted-foreground animate-pulse">Updating…</span>
            )}
          </div>

          {/* Error */}
          {actionError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
            >
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">{actionError}</p>
            </div>
          )}

          {/* ── pending: prompt to start ─────────────────────────────────── */}
          {session.status === "pending" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ready to scan <strong className="text-foreground">{session.websiteUrlRaw}</strong>.
              </p>
              <Button
                type="button"
                onClick={handleStartAudit}
                disabled={isStartingAudit}
                className="gap-2"
              >
                {isStartingAudit ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting…
                  </>
                ) : (
                  "Start audit"
                )}
              </Button>
            </div>
          )}

          {/* ── crawl_done: Q&A phase ────────────────────────────────────── */}
          {session.status === "crawl_done" && (
            <>
              <UpgradeQuestions
                sessionId={sessionId}
                alreadyAnswered={session.questionsAnswers}
                onComplete={handleAnalyze}
              />
              {isStartingAnalysis && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting analysis…
                </div>
              )}
            </>
          )}

          {/* ── crawling / analyzing: progress indicator ─────────────────── */}
          {["crawling", "analyzing"].includes(session.status) && (
            <div className="rounded-lg border border-border p-8 flex flex-col items-center gap-4 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {session.status === "crawling"
                    ? "Scanning your website…"
                    : "Running AI analysis…"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  This takes about 30–60 seconds. Hang tight.
                </p>
              </div>
            </div>
          )}

          {/* ── audit_ready: show audit ───────────────────────────────────── */}
          {(session.status === "audit_ready" || session.status === "generating") &&
            session.audit && (
              <UpgradeAuditPanel
                audit={session.audit}
                onCreateVersion={() => handleGenerateVersion()}
                isGenerating={session.status === "generating" || isGenerating}
              />
            )}

          {/* ── generating: spinner overlay on version section ───────────── */}
          {session.status === "generating" && !session.audit && (
            <div className="rounded-lg border border-border p-8 flex flex-col items-center gap-4 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Creating upgraded version…</p>
            </div>
          )}

          {/* ── version_ready: show version + CTAs ───────────────────────── */}
          {session.status === "version_ready" && session.latestVersion && (
            <div className="space-y-8">
              {/* Show audit collapsed above */}
              {session.audit && (
                <details className="rounded-lg border border-border">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors select-none">
                    View audit ↓
                  </summary>
                  <div className="border-t border-border p-4">
                    <UpgradeAuditPanel
                      audit={session.audit}
                      onCreateVersion={() => handleGenerateVersion()}
                      isGenerating={false}
                    />
                  </div>
                </details>
              )}

              <UpgradeVersionPanel
                version={session.latestVersion}
                onContinueWithMaxwell={handleContinueWithMaxwell}
                onRequestProposal={handleRequestProposal}
                onRequestCorrection={(note) => handleGenerateVersion(note)}
                isTransferring={isTransferring}
                isRequestingProposal={isRequestingProposal}
                isCorrectingDisabled={session.correctionsUsed >= 2}
              />
            </div>
          )}

          {/* ── error: retry ─────────────────────────────────────────────── */}
          {session.status === "error" && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 space-y-4">
              <p className="text-sm text-foreground font-medium">The process ran into a problem.</p>
              <p className="text-sm text-muted-foreground">
                This can happen if the website blocks automated scans or if the AI service is
                temporarily unavailable. You can retry without spending a new session slot.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={handleStartAudit}
                disabled={isStartingAudit}
                className="gap-2"
              >
                <RefreshCcw className="h-4 w-4" />
                {isStartingAudit ? "Retrying…" : "Try again"}
              </Button>
            </div>
          )}

          {/* ── transferred / archived ───────────────────────────────────── */}
          {session.status === "transferred" && (
            <div className="rounded-lg border border-border p-6 space-y-3">
              <p className="text-sm font-medium text-foreground">
                Context transferred to Maxwell Studio.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/maxwell/studio")}
              >
                Go to Maxwell Studio →
              </Button>
            </div>
          )}

          {session.status === "proposal_sent" && (
            <div className="rounded-lg border border-border p-6 space-y-3">
              <p className="text-sm font-medium text-foreground">Proposal submitted.</p>
              <p className="text-sm text-muted-foreground">
                Noon&apos;s team will review it and get back to you with a formal proposal.
              </p>
            </div>
          )}

          {session.status === "archived" && (
            <div className="rounded-lg border border-border p-6">
              <p className="text-sm text-muted-foreground">
                This session was archived after 30 days of inactivity.{" "}
                <Link href="/upgrade" className="text-foreground underline underline-offset-4">
                  Start a new analysis
                </Link>{" "}
                for this website.
              </p>
            </div>
          )}
        </div>
      )}
    </UpgradeStatusPoller>
  );
}
