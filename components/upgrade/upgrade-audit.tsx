"use client";

import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import { useState } from "react";
import type { UpgradeAudit, AuditSection } from "@/lib/upgrade/types";

type Props = {
  audit: UpgradeAudit;
  onCreateVersion: () => void;
  isGenerating: boolean;
};

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 7
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      : score >= 5
      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {score}/10
    </span>
  );
}

function SectionCard({ section }: { section: AuditSection }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <ScoreBadge score={section.score} />
          <span className="text-sm font-medium text-foreground">{section.title}</span>
          {section.priority === "high" && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3" />
              High priority
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 space-y-1">
          {section.findings.map((f, i) => (
            <p key={i} className="text-sm text-muted-foreground flex gap-2">
              <span className="mt-0.5 text-foreground/30">·</span>
              {f}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function UpgradeAuditPanel({ audit, onCreateVersion, isGenerating }: Props) {
  const { auditJson } = audit;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Website Audit</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {audit.pagesAnalyzed} page{audit.pagesAnalyzed !== 1 ? "s" : ""} analyzed
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Overall score</span>
          <span className="text-3xl font-bold text-foreground tabular-nums">
            {auditJson.overallScore}
            <span className="text-base font-normal text-muted-foreground">/10</span>
          </span>
        </div>
      </div>

      {/* Strengths */}
      {auditJson.strengths.length > 0 && (
        <div className="rounded-lg border border-border p-4 space-y-2">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            What&apos;s working
          </h3>
          <ul className="space-y-1">
            {auditJson.strengths.map((s, i) => (
              <li key={i} className="text-sm text-muted-foreground flex gap-2">
                <span className="mt-0.5 text-foreground/30">·</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Critical issues */}
      {auditJson.criticalIssues.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Critical issues
          </h3>
          <ul className="space-y-1">
            {auditJson.criticalIssues.map((issue, i) => (
              <li key={i} className="text-sm text-muted-foreground flex gap-2">
                <span className="mt-0.5 text-foreground/30">·</span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Detailed analysis</h3>
        {auditJson.sections.map((section, i) => (
          <SectionCard key={i} section={section} />
        ))}
      </div>

      {/* Top recommendations */}
      {auditJson.topRecommendations.length > 0 && (
        <div className="rounded-lg border border-border p-4 space-y-2">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            Top recommendations
          </h3>
          <ol className="space-y-1 list-decimal list-inside">
            {auditJson.topRecommendations.map((rec, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                {rec}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* CTA */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onCreateVersion}
          disabled={isGenerating}
          className="w-full sm:w-auto rounded-lg bg-foreground px-6 py-3 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <span className="h-2 w-2 rounded-full bg-background/60 animate-pulse" />
              Creating upgraded version…
            </>
          ) : (
            "Create upgraded version →"
          )}
        </button>
      </div>
    </div>
  );
}
