# Maxwell process explainer — spec + architecture

> **Date:** 2026-06-10 · **Scope:** one new About section (design-only, no backend).
> **Source:** completeness audit §4/§6 P0.2 (`specs/2026-06-06-noon-premium-completeness-audit.md`) + the six §7.A framing decisions, answered by the owner 2026-06-10.

## Framing decisions (owner, 2026-06-10 — these gate the content)

1. **Review gate: explicit.** The human review renders as a visible GATE the flow stops at — two lanes (AI draft / human review) converge before "your proposal". P7 is the protagonist.
2. **Tools: abstract.** "AI" + "human review" — no vendor names in the explainer (stack names stay only where they already exist: /work, About tech section).
3. **Iterations: "2 rounds of feedback included."** The bounded loop is a benefit; the meter renders 2 segments and terminates (the audit's only allowed loop).
4. **Reviewers: per stage, no invented names.** Proposal → **a PM** reads/corrects/approves. Code → **a senior engineer** signs off. Matches the real flow in code (`proposal_pending_review` is PM review) and the site's existing "signed off by a senior engineer".
5. **Turnaround: qualitative, zero numbers.** No clock promises ("minutes/24h") — the owner previously rejected "in minutes" as toy phrasing (commit 3d118f2). Internal 5/10/15-min timers are NOT client-facing numbers.
6. **Pre/post-pay: full journey, line marked.** All 6 stages render; an explicit "project activation" divider sits before the build/delivery stage, which carries an "after activation" badge. Pre-pay visuals never imply delivery.

## What ships

`components/sections/maxwell-process.tsx` — **"What happens after you hit send."**
A single-column stage rail (max-w-3xl) of the CLIENT journey through Maxwell:

1. **Share your idea** — plain-language intake; Maxwell asks until the goal is clear.
2. **Get a working direction** — the AI shapes a scoped direction + clickable prototype (no time claims).
3. **Refine it** — meter artifact: `2 rounds of feedback included` (segmented, static, terminates).
4. **THE REVIEW GATE (P7, protagonist)** — wide distinct card: lane A "Maxwell drafts — scope, timeline, investment" + lane B "a PM reads it — corrects, challenges" converge (hairline elbows) into a gate node ("Human sign-off", primary) → output chip "Your proposal · Approved" (success token).
5. **Approve & activate** — scope/deliverables/timeline/investment; activates on payment.
   — `project activation` divider (mono label on a hairline) —
6. **Build, review, deliver** — `after activation` badge; senior engineers build; **every change signed off by a senior engineer**.

Placement: `about-content.tsx`, new section directly after "THE PRODUCT / MaxwellDemo" (line ~630), before `IndustryShift`. Narrative: the demo shows the product → the explainer narrates the journey → IndustryShift sets industry context → HumanReviewProof shows the code-review artifact (PM gate here = proposal; that one = code; distinct).
"From idea to launch" (LAUNCH_STEPS) stays — it narrates Noon's internal build pipeline, not the client journey.

## Brand & engineering rules

- Tokens only (works in light+dark): hairline `border-foreground/10..15`, accent `--color-primary`, success via `siteStatusTones.success.accent`, mono micro-labels, `rounded-[10..12px]`. NO hardcoded dark theme (the orphaned `how-it-works-section.tsx` is the counter-example: off-brand blooms, infinite setInterval loops — mined for copy only).
- Motion: `useRevealMotion` (the only sanctioned reveal primitive — see design-workflow 3d) + `EASE`; per-row stagger; the gate lanes draw once (scaleX) then stop. NO infinite loops; reduced-motion = everything visible immediately, static final frame.
- Connectors: pure CSS (flex/grid + absolutely-positioned hairline divs) — NOT measured-DOM SVG (decision-map's ResizeObserver engine is overkill here; altitude lesson).
- Shared pieces: `Eyebrow`, `siteStatusTones`. Server-safe copy, `"use client"` only for the motion.
- A11y: list semantics (`ol/li`) for stages; the gate diagram is `aria-hidden` decoration next to real text; axe must stay 0-violation on /about.

## Verification (owner-mandated)

Playwright on :3000 — light+dark × motion+reduced-motion × 1440+390: section renders, gate visible, reduced-motion shows content with no scroll (opacity probe = 1), no horizontal overflow, axe 0 violations on /about. Evidence screenshots.
