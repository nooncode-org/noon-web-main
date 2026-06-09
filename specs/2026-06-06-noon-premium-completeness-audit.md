# Noon — Premium Completeness Audit & Build Plan

> **Date:** 2026-06-06 · **Scope:** frontend / visual / UX only (no backend/logic/architecture changes).
> **Method:** 6 parallel research streams (Cursor deep + visual, Vercel/Linear/cohort reuse, Bubble+builder cohort, Trust/social-proof playbook, Process-visualization toolkit, Maxwell process map from code) + first-hand Playwright visual study.
> **Companion docs:** `specs/2026-06-05-premium-audit-references.md` (Vercel/Linear/cohort playbooks). The session's shipped design work (typography, spacing, decision-map, HowWeWork, off-brand cleanup) is the *foundation* this builds on.
> **References studied:** Vercel, Linear, Cursor, Bubble, Base44, Emergent, webuild.io, + best-in-class (Stripe, Ramp, Scale, Vanta, Resend, Liveblocks, Browserbase, Val Town, Mintlify).

---

## 0. The one-paragraph thesis

After this session, Noon's **foundation** (typography, spacing, color discipline, motion baseline, the decision-map, the HowWeWork section) is solid and on-brand. What still makes Noon feel *less complete* than the references is **not** more systemic design — it's the absence of four whole LAYERS the best sites are built on: **(1) demonstration** (showing the product/work as believable artifacts/mockups), **(2) credibility** (named testimonials, client logos, metric-in-title case studies, trust/security depth), **(3) process narrative** (explaining Maxwell and each service visually, not in prose), and **(4) editorial rhythm** (rotating block types so a long page reads rich, not repetitive). Noon's single unfair advantage — **human review of AI-accelerated builds** — is the one thing none of the references can claim, and it must become the protagonist of every demo, diagram, and trust signal. Crucially: **~40% of this is shippable now with zero new assets** (honest "built-on" authority, the human-review process visuals Noon already half-owns, the build-card mockup); the other ~60% is gated on real assets/content + a handful of marketing-framing decisions, listed in §7.

---

## 1. North star — what "complete & premium" means for Noon (synthesized)

| Principle | From | Noon translation |
|---|---|---|
| **Show artifacts, not prose** | Cursor, Linear | Every claim gets a mockup of *what we deliver / how we review* — a build-card, an annotated PR, a before/after of the client's product. |
| **Rotate the surface** | Cursor (12-section home, never repeats a block) | Alternate block types down each page — mockup → diagram → stat band → quote → grid → timeline — same visual language, different artifact. This is how Vercel "shows a lot without saturating." |
| **Specificity is the trust mechanism** | Vercel, Stripe, Ramp | Named people + exact titles + odd-numbered metrics + before→after deltas + bounded scope. Never round marketing numbers, never anonymous quotes. |
| **Human review is the protagonist** | (Noon's wedge) | The one thing Cursor/Bubble/Base44 *cannot* show. Put a named reviewer in the demos; make "no proposal ships without human review" a visible gate. |
| **The native idiom per stage** | Linear (board/Gantt/diff/chart) | Don't force one diagram everywhere — use the right device per process stage (token pipeline for intake, gate for review, stepper for delivery). |
| **Borrowed authority, honestly** | Cursor (Huang/Collison say it), Evil Martians ("creators of…") | "Built on the stack trusted by Anthropic/OpenAI/Vercel/Stripe/Supabase" (capability claim, true) — never a fabricated endorsement. Superlatives go in a named client's mouth. |
| **Calm + one warm signature** | Cursor (cream + painterly wallpaper under floating UI) | A single ownable "artifact-over-backdrop" frame; near-monochrome shell; metrics as oversized display numbers. |
| **The senior tonal model** | **webuild.io** (a human studio, not a builder) | Logo wall + "results you can get behind" + "the team that becomes part of yours" + consultative CTA — NOT a prompt-box hero. |

---

## 2. Current Noon state (what exists today, per page)

| Page | Has now | Premium-completeness verdict |
|---|---|---|
| **Home** | 1 screen: prompt-box "Tell us what you want to build" + chips (FROZEN) | 🔴 The biggest structural gap — references' home is their *longest, most-narrated* page; Noon's is a single self-serve prompt-box (reads "AI-builder toy"). Frozen per owner. |
| **Services** | Hero · 4 service blocks · Problem areas · Statement · **HowWeWork (new)** · **Decision-map (new)** · CTA | 🟢 Strong after this session. Missing: proof, real outputs in the blocks, per-service process depth. |
| **About** | Hero · intro cards · **live Maxwell demo** · operating model · process/architecture mockups · ComparisonShowcase · tech ecosystem · FAQ | 🟢 Rich + on-brand. Missing: named testimonials, founder pedigree, case studies. |
| **Upgrade** | Hero · live intake · Scan/Diagnose/Generate · audit demo · before/after | 🟢 Best "proof-by-demo" page. Missing: real client before/after, proof. |
| **Templates** | Hero (file-tree) · "what templates are" · business-category tabs · cards | 🟢 Good. Missing: real template demos/screenshots, "View demo". |
| **Contact** | Hero · strong form · response timeline (reconciled) · FAQ | 🟢 Solid. Open: the real SLA story (business decision). |
| **Opportunities** | Tracks · CTA | 🟡 Thinner; more content/structure work (out of pure-design scope). |
| **— MISSING ENTIRELY —** | **/work (case studies)**, **/security**, **/approach (craft)**, a **changelog/recent-builds** feed, per-service deep pages | 🔴 These net-new pages are where most of the "completeness" gap lives. |

---

## 3. The gap map — everything missing / to add, by category

> 🟢 = shippable now (no assets) · 🟡 = needs owner content/decision · 🔴 = needs real assets (logos/screenshots/quotes/metrics)

### 3.1 Sections that are missing
- 🔴 **/work — case-study index** (the single highest-value page). Card grid, **metric-in-the-title**, segmented by industry. *Ref: Vercel/Stripe/Ramp/Bubble showcase.*
- 🟡 **/security (or Trust) page** — data handling, **IP ownership**, the human-review control, sub-processors, "request SOC2" placeholder. Can be drafted from real practices pre-certification. *Ref: Linear /security (works without leading on a badge).*
- 🟡 **/approach (On Craft) editorial page** — the human-review manifesto. *Ref: Linear /method + /quality.*
- 🟢 **"Built-on" authority strip** (homepage-adjacent, but Home is frozen → put on Services/About): Anthropic · OpenAI · Vercel · Stripe · Supabase, greyscale, under "Built on the stack that powers…".
- 🟢 **Giant-stat delivery band** — builds shipped · median review turnaround · defects caught pre-ship · on-time rate (honest numbers or qualitative until data exists).
- 🟡 **Persona-segmented solution cards** — Founders · Product teams · Ops · Agencies needing overflow. *Ref: Emergent enterprise.*
- 🟡 **Comparison section** — Noon vs traditional dev vs no-code vs in-house (honest, outcome-framed). *Ref: Emergent FAQ "how is this different from Cursor".*
- 🟢 **Changelog / "recent builds" feed** — dated velocity signal. *Ref: Cursor/Linear changelog.*

### 3.2 Credibility & trust (the #1 deficit)
- 🔴 **Named testimonials** — `"Quote with a number." — Name, Title, Company` + photo + logo. *Cursor's exact format.*
- 🔴 **Client logo wall** — segmented by industry; only ship once ≥8 nameable logos (a thin wall signals weakness).
- 🔴 **Metric-in-title case studies** — *"How [Client] launched X in 6 weeks with Noon"* + 3-metric at-a-glance + Challenge→Approach→**Human review**→Result.
- 🟢 **"Every build human-reviewed" badge/lockup** — the differentiator, welded to the authority strip (Cursor welds "securely and at scale" to its claim).
- 🟡 **Founder pedigree / "who's behind Noon"** — name prior shipped products. Compensates for a young firm's thin logo wall. *Ref: Evil Martians "creators of…".*
- 🟡 **Trust badges** (SOC2/GDPR/data) — three depths: badge → /security → trust center (sequence over months).

### 3.3 Mockups & demonstrations (show, don't tell)
- 🟢 **Maxwell "build card"** — activity receipt (*"2 senior passes · 9 files reviewed · 14 tests added · 3h 12m"*) → plain-English result (*"Implemented billing, migration verified — awaiting your sign-off"*). **The signature pattern.** *Cursor pattern C.*
- 🟢 **Annotated PR / human-review handoff** — Maxwell proposes a diff, a **named human reviewer approves** (*"Sofía, Senior Eng — verified edge cases, merging"*). **The wedge as UI.** *Cursor pattern G.*
- 🟢 **Slack/handoff thread** — client asks → Maxwell drafts → human signs off → link. One image = the whole engagement loop. *Cursor pattern D.*
- 🔴 **Real before/after of delivered client products** (in browser/device frames).
- 🔴 **Real product screenshots** — Maxwell studio, delivered work, per template.
- 🟢 **Artifact-over-backdrop frame** — one ownable premium treatment for all mockups.

### 3.4 Process explanations (Maxwell + per service) → see §4 for the full toolkit
- 🟢/🟡 **Maxwell process explainer** — Noon already owns ~half; needs the framing decisions in §7.
- 🟡 **Per-service process visuals** — Custom Dev / Audit / Eng Support / Upgrade, each as a flow. Needs per-service definitions.

### 3.5 Motion & microinteractions
- 🟢 Already have the foundation (shared EASE, scroll-reveal gate, reduced-motion, decision-map draw-in). **Add:** streaming text in the build-card; spring layout on status changes; surface-rotation reveals.
- 🟢 **Remove** the `floating-tech-elements` infinite-drift binary (decorative loop, violates brand). *(Cleanup.)*

### 3.6 Storytelling
- 🟡 **Paired-clause / antithesis headlines** site-wide ("AI speed. Human judgment.") — extend the voice we started on Services.
- 🟡 **A narrative/origin beat** — Cursor opens with an "Acme Labs 2022→2026" story; Noon could earn one once there's history.

### 3.7 FAQs · Comparisons · States · Assets
- 🟡 **FAQ depth** per page (and fix the locale-loss bug flagged in the original audit).
- 🟡 **Comparison block** (see 3.1).
- 🟢 **Visual states** — ensure loading/empty/error states on the live demos read on-brand (mostly handled).
- 🔴 **Graphic assets** — real screenshots, logos, photos (team/founders), an optional Maxwell screen-recording loop.

---

## 4. Process-visualization toolkit (the core ask) — Maxwell, mapped

**Maxwell's real flow (from code), 8 stages:** Chat intake → interpret/extract brief → tools (OpenAI + v0 + Stripe, internal) → prototype generation (+ polling, 2 free corrections) → **proposal + human PM review** → public proposal + payment → workspace activation → (optional prototipo-share). Automations: brief extraction, review SLA, signed webhooks, lifecycle emails.

**12-pattern toolkit, each on-brand (flat, hairline, single accent, reduced-motion-safe) and mapped to a stage. Noon already ships P1/P4/P6/P8/P9/P10 (`how-it-works-section.tsx`) + P3 base (`studio-thinking-block.tsx`); only P2/P5/P7/P11 are net-new.**

| Pattern | Device | Maxwell stage | Status |
|---|---|---|---|
| **P1 Stage Rail** | scroll-linked vertical rail, numbered nodes | the whole public "how Maxwell works" spine | ✅ have |
| **P2 Traveling Token Pipeline** | short horizontal rail, accent dot travels node→node | Input → Intake → Clarify → Brief | 🆕 build |
| **P3 Thinking Trace** | collapsible mono reasoning lines → summary | interpretation / `[BRIEF_EXTRACTED]` | ✅ base exists |
| **P4 System Map** | node-and-edge graph, edges draw in | tools involved + scope decomposition (no vendor names) | ✅ have |
| **P5 Correction Loop Meter** | segmented `X/2 adjustments` + return arrow | iteration (the ONE allowed loop — bounded) | 🆕 build |
| **P6 Annotated Preview** | browser frame + hairline callouts | deliverable: prototype (label "direction, not final") | ✅ have |
| **P7 Review Gate** | two lanes (auto-draft vs human) converge + PM chips | `proposal_pending_review` — **the trust moment** | 🆕 build |
| **P8 Proposal Breakdown Bars** | scope/deliverables/timeline/investment meters | deliverable: proposal | ✅ have |
| **P9 Activation Checkpoints** | Terms→Deposit→Kickoff, Pending→Confirmed | payment + activation (payment guard) | ✅ have |
| **P10 Delivery Stepper** | Build→Test→Stage→Deploy→Live + terminal echo | execution (POST-pay / homepage only) | ✅ have |
| **P11 Automations Web** | trigger→action mini-graph, one path lights at a time | automations (SLA cron, email, persistence) | 🆕 build |
| **P12 Code→Result Twin** | spec pane ↔ rendered preview | bridges interpret→deliverable (optional, tech buyers) | optional |

**Brand rules for all:** one accent (#1200c5) + semantic pair (success #2cc49a / warning #f0a127); hairlines not boxes; **motion encodes a stage then stops** (no decorative loops — P5 is the only allowed loop, it terminates); reduced-motion ships a static final frame; mono micro-labels; **never name third-party tools to the client**; **respect the pre/post-pay wall** (pre-pay visuals must not imply real delivery).

---

## 5. The trust/credibility layer — sequenced (honest)

**The bright line:** Noon *uses / builds-on* the ecosystem; the ecosystem never *endorses/partners-with/trusts* Noon (until contractually true). Test: "would the vendor's lawyer object?" — "Noon builds on Stripe" ✅; "Stripe trusts Noon" ❌.

**Build sequence:**
1. **Now (no assets):** "Built on the stack that powers Anthropic/OpenAI/Vercel/Stripe/Supabase" greyscale strip + "Every build human-reviewed" badge.
2. **Weeks 2–4 (needs content):** first 2–3 case studies (metric-in-title) + one named testimonial each.
3. **Month 2 (draftable now):** /security page — describe the controls (data handling, IP ownership, human review, sub-processors) even pre-SOC2.
4. **Month 3+ (needs assets):** segmented logo wall (≥8 logos) + pursue SOC2 → surface three-deep.

---

## 6. Prioritized roadmap

**P0 — Ship now, no assets, highest signal-per-effort (all 🟢):**
1. "Built-on" authority strip + "human-reviewed" badge (on Services/About; Home frozen).
2. The **Maxwell process explainer** extended from the existing `how-it-works-section.tsx` (P1+P3+P4+P7), once §7 framing is decided.
3. The **build-card** + **annotated-PR (human review)** mockups — the signature demonstration of the wedge.
4. Remove `floating-tech-elements` decorative loop.
5. Giant-stat delivery band (qualitative until numbers land).

**P1 — Needs owner content/decisions (🟡):**
6. **/work case-study page** scaffold (+ first studies when data arrives).
7. **/security page** (draft from real practices).
8. Per-service process visuals (needs per-service definitions).
9. Persona-segmented solution cards + a comparison block.
10. Paired-clause headline pass + FAQ depth.

**P2 — Needs real assets (🔴):**
11. Named testimonials, client logo wall, real before/after + product screenshots, real metrics.
12. /approach editorial page, changelog feed, founder-pedigree block.

**P3 — Strategic (owner decision):**
13. The **Home** question — it's the references' most-worked page and Noon's is a frozen single screen. Recommend revisiting the freeze; it caps the ceiling.

---

## 7. What I need from you (to complete each section at max level)

### A. Marketing-framing decisions (gate the process visuals — answer first)
1. **Human-review transparency** — show "every proposal is human-reviewed by a PM before you see it" as a visible gate? (Strongly recommend yes — it's the wedge.)
2. **Tool naming** — name OpenAI/v0 internally (authority) or abstract to "AI + senior human review"? (Brand previously said don't name models — confirm.)
3. **Realistic turnaround** to promise client-facing (code has 5/10/15-min internal timers — not the real number).
4. **Iterations** framing — communicate the "2 corrections" as "2 rounds of feedback included"?
5. **Reviewer roles** — name who reviews (PM / senior engineer / team) or keep abstract?
6. **Pre/post-pay line** — what's safe to show before payment vs after?

### B. Real assets (gate the credibility + demonstration layers)
7. **2–3 case studies**: client (or sector if anonymized) + the challenge + what we built + **a real metric** + ideally a quote.
8. **3–5 named testimonials**: exact `Name, Title, Company` + headshot + permission.
9. **Client logos** (with permission) — need ≥8 before a wall.
10. **Real screenshots** of delivered work + the Maxwell studio (high-res), per service/template.
11. **Real metrics** (builds delivered, turnaround, defect/on-time rates) — even rough, with permission to state.
12. **Team/founder photos** + a short "who's behind Noon" (prior shipped products).

### C. Service & process definitions (gate the per-service + Maxwell narrative)
13. **Per-service step-by-step** for Custom Dev / Audit / Eng Support / Upgrade (what happens at each stage, what the client gets).
14. Confirm the **Maxwell client-facing narrative** (the honest story of input → interpret → build → human review → deliver → automate).

### D. Strategic decisions
15. **Home freeze** — keep frozen, or open it (it's the biggest ceiling on "premium completeness")?
16. **/security & compliance** — current real data-handling/IP practices to describe (and SOC2 intent/timeline).
17. **The real /contact SLA** (still open from earlier).

---

*Once §7.A (the 6 framing decisions) and even a first slice of §7.B (one case study + a couple logos) land, the P0 + the first P1 items are buildable immediately — that alone closes most of the "feels incomplete" gap.*
