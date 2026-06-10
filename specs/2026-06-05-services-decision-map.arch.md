# Architecture — Services Decision-Map (two-path flow)

> Design for `specs/2026-06-05-services-decision-map.md`. Outcome: **Ready for Frontend.**
> Proportional to one frontend component. No backend/data/schema changes.

## ADR-DM1 — Geometry via measured node anchors + SVG overlay (eliminates drift)

**Context.** The first-pass renders nodes with CSS `%` while drawing curves in an SVG `viewBox 0–100` with `preserveAspectRatio="none"`. Two coordinate systems that only align by hand-tuned constants → curves distort and miss nodes on any layout change (spec risk #1, criterion #9).

**Decision.** Make the **rendered DOM the single source of truth.** Nodes are laid out in normal CSS flow (responsive flex). An absolutely-positioned `<svg>` overlay fills the diagram container; its `viewBox` is set to the container's **measured pixel size** (SVG user units = CSS px, 1:1). Connector `d` strings are computed from each node's **measured anchor point** (`getBoundingClientRect` of node − container rect), recomputed on mount + resize (`useLayoutEffect` + `ResizeObserver`).

**Consequences.**
- Zero drift: paths derive from actual node positions; impossible to misalign.
- One code path serves desktop lanes AND mobile stack — connectors follow whatever CSS lays out; no per-breakpoint coordinate tables.
- Control points are chosen by the **dominant axis** of the anchor delta (mostly-horizontal → horizontal handles; mostly-vertical → vertical handles), so curves stay clean in both layouts.
- Rejected: (b) fixed normalized constants + aspect-lock (constrains layout, needs a mobile table); (c) SVG `<foreignObject>` nodes (font/scaling/focus-style quirks). Both reintroduce coupling we are removing.

## ADR-DM2 — Motion + reduced-motion contract

**Reveal gate.** `useInView(once, margin -100px)` → `play`. SSR-safe: paths render only after mount (`useHasMounted`) — server and first client render both have **zero `<path>` children** (no hydration mismatch); paths are `aria-hidden` decoration, so no SSR content loss.

**Normal motion.** Per lane, sequentially: connector `motion.path` animates `pathLength 0→1` (`EASE` from `lib/motion`, ~0.55s) → after the draw, one **single-pass token** (`motion.circle`, `offsetPath: path(<d>)`, `offsetDistance 0%→100%`, ~1.0s linear) traverses the path. Nodes settle (opacity + 4px rise) with stagger ≤80ms. A gentle token **repeat** runs only on the **hovered/active** lane.

**Reduced motion (manual gate — framer does NOT neutralize `pathLength`/`offsetPath`).** `usePrefersReducedMotion()` true ⇒ render connectors as plain `<path>` (no `motion`, no `pathLength`), **no token at all**, nodes at final opacity/position. Everything legible with zero motion. (Complements the global CSS baseline, which only covers CSS animation/transition.)

## ADR-DM3 — Path-highlight interaction + a11y

- State `activeKey: string | null`. `onMouseEnter`/`Leave` on a lane group and `onFocus`/`Blur` on its nodes set it. Active lane → accent emphasized; other lane → `opacity ~0.4`. Pure color/opacity (instant, reduced-motion-safe).
- SVG overlay `aria-hidden="true"`. All meaning in HTML: each lane is a labeled region; its steps are an `<ol>`/`<li>` (semantic sequence); each step is a `<Link>` with `aria-label="{name} — {line}"`.
- Keyboard: native Link focus, DOM order = source → build(step1→step2) → improve(step1→step2); `focus-visible` ring on chips; focus drives the same highlight.

## Component contract (public API unchanged)

```
DecisionMap({ paths: DecisionPath[], eyebrow?, title?, subtitle? })
DecisionPath = { key, label, situation, prompt, steps: DecisionStep[] }
DecisionStep = { name, line, tagline?, href, icon: keyof ICONS, meta }
```
- Same signature as today → `services-content.tsx` wiring is unchanged except the `decisionPaths` data (kept/refined).
- Internal-only structure (one file): `DecisionMap` (layout + state + measurement) · `LaneNode` (chip + ref + focus handlers) · `Connectors` (SVG overlay: measured segments → motion paths + tokens). Side-effect-free except the measure effect.

## Module boundaries

- `components/sections/decision-map.tsx` owns: rendering, geometry measurement, motion, interaction state, a11y. Owns NOT: data, copy, routing targets (all via props).
- `app/[locale]/services/services-content.tsx` owns: `decisionPaths` data, section copy, placement. No logic change.
- `lib/motion.ts`: may add `DUR`/`STAGGER` tokens beside `EASE` (additive only).

## Responsive model

- **≥ md:** source node on the left; two lanes stacked vertically to its right; each lane horizontal: `[situation chip] → node → node`.
- **< md:** single column — source/decision prompt on top, then the two lane cards stacked; each lane's steps in a vertical mini-sequence. Connectors auto-follow via measured anchors (vertical handles).

## Shortcuts

**Allowed:** EN copy hardcoded via props (launch decision); geometry recomputed on resize via ResizeObserver (tiny element count); mobile may fall back to near-straight connectors if beziers crowd.
**Forbidden:** `preserveAspectRatio="none"` / dual coordinate tables; infinite decorative token loop (only active-lane gentle repeat, paused under reduced motion); glow/particles/drop-shadows; new deps; touching Home.

## Readiness: **Ready** — contracts explicit, boundaries clear, a11y + motion contract testable against spec §4.
