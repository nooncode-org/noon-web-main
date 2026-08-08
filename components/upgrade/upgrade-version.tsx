"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ArrowRight, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import type { UpgradeVersion } from "@/lib/upgrade/types";
import { Button } from "@/components/ui/button";

type Props = {
  version: UpgradeVersion;
  onContinueWithMaxwell: () => void;
  onRequestProposal: () => void;
  onRequestCorrection: (note: string) => void;
  isTransferring: boolean;
  isRequestingProposal: boolean;
  isCorrectingDisabled: boolean;
};

function SectionComparison({
  name,
  current,
  upgraded,
  rationale,
}: {
  name: string;
  current: string;
  upgraded: string;
  rationale: string;
}) {
  const t = useTranslations("upgradeTool");
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
      >
        <span className="text-sm font-medium text-foreground">{name}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-border divide-y divide-border">
          <div className="px-4 py-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("current")}</p>
            <p className="text-sm text-muted-foreground">{current}</p>
          </div>
          <div className="px-4 py-3 space-y-1">
            <p className="text-xs font-medium text-foreground/80 uppercase tracking-wide">{t("upgraded")}</p>
            <p className="text-sm text-foreground">{upgraded}</p>
          </div>
          <div className="px-4 py-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("why")}</p>
            <p className="text-sm text-muted-foreground italic">{rationale}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function UpgradeVersionPanel({
  version,
  onContinueWithMaxwell,
  onRequestProposal,
  onRequestCorrection,
  isTransferring,
  isRequestingProposal,
  isCorrectingDisabled,
}: Props) {
  const t = useTranslations("upgradeTool");
  const { versionJson } = version;
  const [showCorrectionBox, setShowCorrectionBox] = useState(false);
  const [correctionNote, setCorrectionNote] = useState("");

  function submitCorrection() {
    if (!correctionNote.trim()) return;
    onRequestCorrection(correctionNote.trim());
    setCorrectionNote("");
    setShowCorrectionBox(false);
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{t("upgradedVersion")}</h2>
        {version.isCorrection && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Revised version · v{version.versionNumber}
          </p>
        )}
      </div>

      {/* Key messaging */}
      <div className="rounded-lg border border-border p-5 space-y-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          New messaging direction
        </h3>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t("headline")}</p>
            <p className="text-lg font-semibold text-foreground">{versionJson.headline}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t("subheadline")}</p>
            <p className="text-sm text-foreground">{versionJson.subheadline}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t("valueProposition")}</p>
            <p className="text-sm text-muted-foreground">{versionJson.valueProposition}</p>
          </div>
          <div className="pt-1">
            <span className="inline-flex items-center rounded-full border border-foreground/20 px-4 py-1.5 text-sm font-medium text-foreground">
              {versionJson.ctaText}
            </span>
          </div>
        </div>
      </div>

      {/* Page sections */}
      {versionJson.pageSections.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">{t("sectionChanges")}</h3>
          {versionJson.pageSections.map((section, i) => (
            <SectionComparison
              key={i}
              name={section.name}
              current={section.current}
              upgraded={section.upgraded}
              rationale={section.changeRationale}
            />
          ))}
        </div>
      )}

      {/* Key changes */}
      {versionJson.keyChanges.length > 0 && (
        <div className="rounded-lg border border-border p-4 space-y-2">
          <h3 className="text-sm font-medium text-foreground">{t("whatChanged")}</h3>
          <ul className="space-y-1">
            {versionJson.keyChanges.map((change, i) => (
              <li key={i} className="text-sm text-muted-foreground flex gap-2">
                <span className="mt-0.5 text-foreground/30">·</span>
                {change}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tone guidance */}
      {versionJson.toneGuidance && (
        <div className="rounded-lg border border-border p-4 space-y-1">
          <h3 className="text-sm font-medium text-foreground">{t("toneVoice")}</h3>
          <p className="text-sm text-muted-foreground">{versionJson.toneGuidance}</p>
        </div>
      )}

      {/* Correction box */}
      {showCorrectionBox && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">{t("whatToChange")}</p>
          <textarea
            value={correctionNote}
            onChange={(e) => setCorrectionNote(e.target.value)}
            placeholder="e.g. The headline feels too generic. Can you make it more specific to our niche?"
            rows={3}
            maxLength={2000}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={submitCorrection}
              disabled={!correctionNote.trim() || isCorrectingDisabled}
              size="sm"
            >
              Apply correction
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCorrectionBox(false);
                setCorrectionNote("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button
          type="button"
          onClick={onContinueWithMaxwell}
          disabled={isTransferring}
          className="gap-2"
          size="lg"
        >
          {isTransferring ? "Transferring…" : "Continue with Maxwell"}
          <ArrowRight className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={onRequestProposal}
          disabled={isRequestingProposal}
          size="lg"
        >
          {isRequestingProposal ? "Sending…" : "Request proposal"}
        </Button>

        {!showCorrectionBox && !isCorrectingDisabled && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="gap-2 text-muted-foreground"
            onClick={() => setShowCorrectionBox(true)}
          >
            <RotateCcw className="h-4 w-4" />
            Request a change
          </Button>
        )}
      </div>

      {isCorrectingDisabled && !showCorrectionBox && (
        <p className="text-xs text-muted-foreground">
          Correction limit reached for this session.
        </p>
      )}
    </div>
  );
}
