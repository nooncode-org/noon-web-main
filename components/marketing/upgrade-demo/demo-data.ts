/**
 * Static, marketing-safe data for the embedded Upgrade audit demo.
 * Shapes a realistic UpgradeAudit so the REAL <UpgradeAuditPanel> renders
 * exactly as it does inside the product — no network, no auth.
 */
import type { UpgradeAudit } from "@/lib/upgrade/types";

export const DEMO_AUDIT: UpgradeAudit = {
  id: "demo-audit",
  websiteUpgradeSessionId: "demo-session",
  pagesAnalyzed: 6,
  summary:
    "A solid foundation with a clear offer, held back by a weak hero, thin trust signals, and a conversion path that asks too much too early.",
  createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
  updatedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
  auditJson: {
    overallScore: 6,
    strengths: [
      "Clear product category — a visitor understands what you sell within seconds.",
      "Consistent visual identity and a readable type system across pages.",
      "Fast initial load and a mobile layout that doesn't break.",
    ],
    criticalIssues: [
      "The hero leads with a feature, not an outcome — the value proposition is buried below the fold.",
      "No social proof above the fold: no logos, testimonials, or numbers a buyer can trust.",
      "The primary CTA competes with three secondary links, diluting the conversion path.",
    ],
    sections: [
      {
        title: "Messaging & positioning",
        score: 5,
        priority: "high",
        findings: [
          "Headline describes the tool, not the result the customer gets.",
          "No clear differentiation from the two obvious competitors.",
          "Jargon in the sub-headline raises the reading level unnecessarily.",
        ],
      },
      {
        title: "Trust & credibility",
        score: 4,
        priority: "high",
        findings: [
          "No customer logos, case studies, or quantified results anywhere on the home page.",
          "The about page reads as generic — no team, no story, no proof of expertise.",
        ],
      },
      {
        title: "Conversion (CRO)",
        score: 6,
        priority: "medium",
        findings: [
          "Primary CTA and secondary links share the same visual weight.",
          "The contact form asks for 7 fields before any value is shown.",
        ],
      },
      {
        title: "Visual design",
        score: 8,
        priority: "low",
        findings: [
          "Strong, consistent type and spacing system.",
          "Color use is restrained and on-brand — minor contrast issues on muted text.",
        ],
      },
      {
        title: "Content clarity",
        score: 7,
        priority: "medium",
        findings: [
          "Services are well described but buried two clicks deep.",
          "No single page that answers \"is this for me?\" for the primary segment.",
        ],
      },
    ],
    topRecommendations: [
      "Rewrite the hero around the customer's outcome, with the value proposition above the fold.",
      "Add a trust strip (logos + one quantified result) directly under the hero.",
      "Make the primary CTA visually dominant; demote secondary links.",
      "Cut the contact form to 3 fields and show value before asking.",
      "Add one credible case study with a real before/after number.",
    ],
  },
};
