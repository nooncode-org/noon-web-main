# Services Decision-Map — Two-Path Flow

**Date:** 2026-06-05
**Author:** Claude (pair with owner)
**Status:** Implemented
**Router mode:** New Build (replaces an existing first-pass component)
**Depth:** Full

---

## 1. Business objective

A business-owner buyer landing on `/services` must be able to self-locate into the right Noon engagement in seconds: *am I building something new, or improving something I already run?* This iteration turns that decision — and the two short service paths it implies — into a single on-brand animated decision map, replacing the current radial fan that lists services without showing the two paths or their sequence. Clearer decision → more qualified, correctly-routed leads.

## 2. Scope — in

- Rebuild [`components/sections/decision-map.tsx`](../components/sections/decision-map.tsx) as a **two-path flow diagram**: a single decision source that branches into two labeled, sequential lanes —
  - **Build path:** Custom Development → Engineering Support
  - **Improvement path:** Business Technology Audit → Upgrade
- **Geometry from a single coordinate source** (no dual CSS-%/viewBox drift): connectors and node anchors share one space; responsive without distortion (`preserveAspectRatio:none` removed).
- **On-brand motion:** connectors draw in (`pathLength`) on scroll-into-view; a subtle token traverses each path to imply sequence/flow; staggered node settle. Single accent `#1200c5`, hairline borders, ≤8px radius, near-zero shadow.
- **Path-highlight interaction:** hover/focus a lane (or a node) highlights that path (accent) and de-emphasizes the other; fully keyboard-accessible with visible focus.
- **Explicit reduced-motion contract** (manual gate via `usePrefersReducedMotion`, because framer does NOT neutralize `pathLength`/`offsetPath`): paths render fully drawn, no token travel, no loops; all content present without motion.
- **Theme-aware** (light + dark) via tokens/`currentColor`.
- **Responsive:** legible two-lane horizontal layout at ≥1024px; a dedicated stacked layout at ≤640px (no overflow, no label collisions).
- Each service node is a working link to its correct destination route.
- Refine the `decisionPaths` data + section copy in [`services-content.tsx`](../app/[locale]/services/services-content.tsx) as needed and wire the rebuilt component in place.

## 3. Scope — out

- **The Home page** (`app/[locale]/page.tsx`, `components/landing/**`) — FROZEN, not touched under any circumstance.
- All other routes/pages.
- The four **service blocks** ("The service architecture"), **ProblemAreas**, and **ScrollLitStatement** sections above the map — untouched (only the decision-map section changes).
- **i18n wiring** — launch is EN-only; copy stays hardcoded in the component props, consistent with the rest of the page.
- New dependencies, design-token files, or a global design-system doc.
- `PipelineShowcase` reconciliation — deferred to **Chunk 2** (conditional, evidence-driven; see §13), not part of the map build itself.

## 4. Acceptance criteria

1. The `/services` "Decision guide" section renders **two visually distinct, labeled paths** (Build, Improvement), each an **ordered 2-step sequence** with a directional connector between the steps.
2. All **four service nodes are working links** to the correct routes: Custom Development → `getContactHref(new-project, custom-development)`; Engineering Support → `getContactHref(general, engineering-support)`; Business Technology Audit → `getContactHref(general, business-technology-audit)`; Upgrade → `siteRoutes.upgrade`. Each carries an accessible name.
3. In **normal motion**, on scroll-into-view: connectors draw in (animated stroke) and a token traverses each path at least once; nodes settle with stagger ≤80ms.
4. **Hover or focus** on a path/node highlights that path in accent and de-emphasizes the other; keyboard `Tab` reaches every node with a visible `focus-visible` ring and triggers the same highlight.
5. Under **`prefers-reduced-motion: reduce`**: connectors are fully drawn immediately, **no token travel, no looping**; 100% of nodes/labels/connectors are present and legible without any scroll or motion. (Playwright-verified, parity with normal-motion content count.)
6. Renders correctly in **light AND dark** themes — no invisible text, no broken contrast, no theme-only element — verified via Playwright screenshots in both.
7. **Responsive:** at 375px width the diagram reflows to a stacked, legible layout with **no horizontal overflow and no overlapping labels**; at ≥1024px the two-lane horizontal layout renders as designed.
8. **SSR-safe:** no hydration mismatch and no console errors on load.
9. **Geometry integrity:** connectors visually meet the source and node anchors (and node→node) with no misalignment across the supported breakpoints.
10. `npm run lint`, `npm run typecheck`, and `npm run build` pass.

## 5. Affected files and modules

- `components/sections/decision-map.tsx` — full rebuild (primary).
- `app/[locale]/services/services-content.tsx` — `decisionPaths` data + section wiring (the `DecisionMap` usage block ~L444–457).
- `lib/motion.ts` — may add shared duration/stagger tokens alongside `EASE` (additive, no behavior change elsewhere).
- `hooks/use-prefers-reduced-motion.ts`, `hooks/use-reveal-motion.ts` — consumed, not modified.
- `app/globals.css` — only if a small scoped utility is genuinely needed (prefer none).
- `components/sections/pipeline/**` + its usage in `services-content.tsx` — **Chunk 2 only.**
- `project.context.core.md` + this spec — updated at close (docs).

## 6. Dependencies

| Dependency | Class | Status | Impact if missing |
|---|---|---|---|
| `framer-motion` (motion, useInView, pathLength, offsetPath) | internal/external | present | blocks motion impl |
| `lucide-react` icons | internal/external | present | node iconography |
| `usePrefersReducedMotion`, `useRevealMotion`, `useHasMounted` | internal | present (shipped) | a11y/SSR gating |
| `EASE` (`lib/motion`) | internal | present | motion consistency |
| `siteTones`, `getContactHref`, `siteRoutes` (`lib/site-config`, `lib/site-tones`) | internal | present | routing + accent |
| Dev server `:3100` + Playwright (`tmp-verify-*.mjs`) | infra (dev) | present | verification only |

No contract, data, or production-infra dependencies.

## 7. Assumptions

- EN-only hardcoded copy is acceptable (consistent with page + launch decision).
- The current 4 services, their 2-path grouping, and their destination routes are correct as-is.
- Single accent `#1200c5` (brand: color is an event); per-path differentiation is done with state/emphasis, not multiple hues.
- Motion is on by default (owner preference) with the reduced-motion gate as the accessible floor.
- `MotionConfig reducedMotion="user"` is active at the provider (neutralizes transform/opacity for framer) — but NOT `pathLength`/`offsetPath`, hence the manual gate.
- Home stays frozen.

## 8. Risks

| Risk | Probability | Impact | Severity | Mitigation |
|---|---|---|---|---|
| Dual-coordinate geometry drift (curves not meeting nodes) | Medium | High | High | Single coordinate source — SVG-native layout or measured anchors; verify alignment per breakpoint in Playwright. |
| Reduced-motion leaves `pathLength`/token animating | Medium | High (a11y/WCAG 2.3.3) | High | Manual `usePrefersReducedMotion` gate rendering final drawn state; Playwright reduced-motion check. |
| Mobile reflow illegible / overlapping labels | Medium | Medium | Medium | Dedicated ≤640px stacked layout, not a squished desktop SVG; verify at 375px. |
| Token reads as decoration (brand forbids decorative motion) | Low-Med | Medium | Medium | Subtle, single-pass-on-reveal, explanatory (encodes sequence/flow); no glow/particles. |
| Hydration mismatch from SSR'd motion initial state | Low | Medium | Low | `useRevealMotion` `show=true` during SSR + first paint (foundation pattern), `initial={false}`. |

## 9. Open questions (non-blocking)

- Source node treatment: keep a "You" node, or frame the source as the decision question ("Where are you?") — decide in Architecture.
- Token behavior on hover: single-pass only vs gentle repeat on the active lane (paused under reduced motion) — decide in Implementation.
- Optional crop-mark/blueprint corner framing — polish, include only if it reads on-brand without clutter.

## 10. Recommended testing methodology

**Integration-first / visual-behavioral verification via Playwright (component-driven build).** Justification: this is a presentation + interaction component with no business logic to unit-test; correctness is observable in rendered states across the theme × reduced-motion × viewport matrix — exactly what Playwright (already the project's motion-verification tool) checks. Evidence: screenshots + DOM/visibility assertions in all four theme×motion combinations plus 375px and ≥1024px.

## 11. Definition of Done

- [x] This spec Approved (Definition of Ready satisfied).
- [x] `decision-map.tsx` rebuilt to the two-path flow; wired into `/services`.
- [x] All acceptance criteria (§4) met.
- [x] Playwright evidence captured for light/dark × normal/reduced-motion × desktop/390px.
- [x] `lint` + `tsc --noEmit` + `build` green (no `typecheck` script in this repo).
- [x] `project.context.core.md` + spec status updated.
- [x] Clean, logical commits on `feat/motion-foundation`, pushed.

## 12. Chunking decision

Two chunks, gated:

- **Chunk 1 — Decision-map rebuild (this iteration's core).** Build + wire + verify the two-path flow component. **Gate to done:** acceptance criteria §4 + build green + Playwright matrix captured.
- **Chunk 2 — PipelineShowcase reconciliation (conditional, owner-delegated).** With the new map live, evaluate the adjacent off-brand `PipelineShowcase` *with visual evidence*; remove it (most likely — redundant flow diagram + P0 off-brand) or keep/replace. **Gated on Chunk 1 complete.** May be closed as a tiny follow-up commit. Does not block Chunk 1.

## Implementation notes (dated)

**2026-06-05 — divergence from §4.3 (recorded per Spec Update Rule):** Nodes and
the section header render **static** (no entrance animation), not "settling with
stagger." Reason: a transform on a node shifts its measured anchor, which would
desync the connectors (§4.9 geometry integrity), and an opacity reveal on the
header left it stuck near-invisible on mobile when its sibling-gated `inView`
didn't fire. The explanatory motion is carried entirely by the **connectors**
(path draw-in + traveling token) — the meaningful element — while all semantic
content (links, labels, header) stays visible with no JS. Net effect still
satisfies the spirit of §4.3 (motion on reveal) and strengthens §4.5/§4.7/§4.9.

**2026-06-05 — Chunk 2 resolved (PipelineShowcase):** Verified the adjacent
`PipelineShowcase` against its source — the audit was accurate, not stale:
hardcoded `text-white`/`text-gray-*` (invisible in light mode), fabricated
metrics ("3x Faster", "24h First Prototype", "100% Human QA"), forbidden phrase
("in record time"), public model names (GPT-4/V0/Opus), terminal/dev motifs,
infinite-loop glows. **Removed its usage from `/services`** (only consumer;
not on Home). The on-brand "process" message is preserved in the existing
`ScrollLitStatement` directly above the map, so no message is lost. The
`components/sections/pipeline/**` module is now orphaned — flagged for a separate
deletion cleanup (out of scope here).

## 13. Success criterion

A business owner on `/services` sees the two Noon service paths as one animated, accessible, theme-aware decision map that clearly distinguishes *“build something new”* (Custom Development → Engineering Support) from *“improve something that exists”* (Business Technology Audit → Upgrade), with every step linking to the correct next action — and the whole thing degrades to a fully legible static diagram under reduced motion and on mobile.
