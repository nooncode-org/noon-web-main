# Real Assets Inventory — Pending Integration

Tracks which real assets are still needed to replace placeholder/built
mockups across the marketing site, plus their current status. Updated as
the owner provides each one, 1 by 1.

**Status legend:** `PENDING` (not yet asked) · `POSTPONED` (asked, not
available yet) · `RECEIVED` (in repo) · `INTEGRATED` (in production)

**Rule:** items marked POSTPONED keep their current placeholder/built-mockup
in code. The page does NOT regress while waiting.

---

## Group A — Product captures

- [POSTPONED] **A1** Maxwell studio · "Prototype ready" two-pane → `public/product/maxwell-studio.png`
- [RECEIVED] **A2** Maxwell studio · Intake / empty state → `public/product/maxwell-intake.png` (captured by Claude via localhost auth bypass, 2880×1800, dark)
- [PENDING] **A3** Maxwell studio · Generating prototype (polling) → `public/product/maxwell-generating.png`
- [PENDING] **A4** Upgrade · Audit logged-in (real score + findings) → `public/product/upgrade-audit.png`
- [PENDING] **A5** Upgrade · Generated version → `public/product/upgrade-version.png`
- [PENDING] **A6** Delivered software · AI & Automation → `public/product/built-ai.png`
- [PENDING] **A7** Delivered software · Web → `public/product/built-web.png`
- [PENDING] **A8** Delivered software · Mobile → `public/product/built-mobile.png`
- [PENDING] **A9** Delivered software · Custom / Workflow → `public/product/built-custom.png`
- [PENDING] **A10–A17** Templates (8 categories) → `public/templates/<slug>.jpg`
- [PENDING] **A18** Delivery timeline (real project phases) → `public/product/delivery-timeline.png`
- [PENDING] **A19** System architecture (real Noon system diagram) → `public/product/system-architecture.svg`
- [PENDING] **A20** Pipeline (real 4 steps) → `public/product/pipeline-*.png`

## Group B — Photos

- [PENDING] **B1** Team / founders → `public/photos/team.jpg`
- [PENDING] **B2** Process / workspace → `public/photos/work-*.jpg`
- [PENDING] **B3** Individual founder portraits → `public/photos/founder-*.jpg`

## Group C — Client / partner logos

- [PENDING] **C1** Client logos (with permission) → `public/figma/logos/clients/<brand>.svg`
- [PENDING] **C2** Partner logos (with permission) → `public/figma/logos/partners/<brand>.svg`

## Group D — Real metrics (data only, no images)

- [PENDING] **D1** Projects delivered count
- [PENDING] **D2** Typical response time
- [PENDING] **D3** Uptime/reliability
- [PENDING] **D4** Years operating / team size
- [PENDING] **D5** Case study with numbers (with permission)

## Group E — Official stack logos (currently using simple-icons)

- [PENDING] **E1** Anthropic / Claude · official press kit
- [PENDING] **E2** OpenAI / GPT · official press kit
- [PENDING] **E3** Stripe · official
- [PENDING] **E4** Vercel · official
- [PENDING] **E5** Supabase · official
- [PENDING] **E6** Next.js, React, TS, Python, Postgres, Tailwind, Node, Flutter · official

## Group F — Noon brand

- [PENDING] **F1** Noon wordmark SVG (vector, hi-res)
- [PENDING] **F2** Noon icon-only SVG
- [RECEIVED] **F2b** Maxwell character icon (pixel-art crop of head + moustache, from talknew.gif first frame) → `public/maxwell-icon.png` (256×256, head centered on transparent square)
- [PENDING] **F3** Favicon HD set (audit if current is enough)
- [PENDING] **F4** Decorative illustrations (4 service-block SVGs — audit if current Figma ones are official)

## Group G — Typography

- [PENDING] **G3** Additional brand-custom typeface (if any beyond Instrument Sans / Serif / JetBrains Mono)

## Group H — Video (optional)

- [PENDING] **H1** Maxwell screen-recording 10–20s · loop, muted
