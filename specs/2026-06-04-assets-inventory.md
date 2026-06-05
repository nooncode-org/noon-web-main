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

> **NOTE (approach change 2026-06-04):** Instead of screenshots we now embed
> the REAL product components live on marketing pages
> (`components/marketing/maxwell-demo/`). The /about Maxwell demo uses the real
> StudioHeader + StudioChatPane, AND the right preview pane is now a live,
> theme-aware DemoPrototypePreview ("Client order portal"), so A1 + the
> Maxwell preview content are superseded there. Same plan applied to Upgrade.
> Screenshots only stay useful for the delivered-software / template
> thumbnails (can't render those live).

- [SUPERSEDED] **A1** Maxwell studio · "Prototype ready" → replaced by live MaxwellDemo on /about (chat + live DemoPrototypePreview pane)
- [RECEIVED] **A2** Maxwell studio · Intake / empty state → `public/product/maxwell-intake.png` (captured by Claude via localhost auth bypass, 2880×1800, dark)
- [SUPERSEDED] **A3** Maxwell studio · prototype preview → live DemoPrototypePreview pane in MaxwellDemo shows the ready state (generating/polling loader is a transient state, not needed for marketing)
- [SUPERSEDED] **A4** Upgrade · Audit → replaced by live UpgradeDemo on /upgrade (real UpgradeAuditPanel + demo data)
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

- [INTEGRATED] **F1** Noon wordmark SVG → inlined in `components/ui/noon-logo.tsx` (LogoWordmark) with `fill=currentColor`, theme-adaptive (black/light, white/dark), used in header + footer + lockup. Replaced the old light/dark PNG pair (deleted `public/logo-wordmark*.png`). Source: `Recurso 29.svg` (RGB/SVG).
- [RESOLVED] **F2** Noon icon → owner decision (2026-06-05): KEEP the current `public/logo-icon.png` (2500×2500, flat-blue "no" monogram on white — correct raster for favicon/apple-touch/social cards, which can't be SVG). The available `alterno2.svg` is a DIFFERENT/alternate mark ("noon" + gradients), so adopting it would change the brand icon, not just vectorize it — not done. No vector swap.
- [RECEIVED] **F2b** Maxwell character icon (pixel-art crop of head + moustache, from talknew.gif first frame) → `public/maxwell-icon.png` (256×256, head centered on transparent square)
- [COVERED] **F3** Favicon → current `public/logo-icon.png` is 2500×2500 (HD), wired as `icon` + `apple` in `app/layout.tsx`. Sufficient; no new asset needed.
- [PENDING] **F4** Decorative illustrations (4 service-block SVGs — audit if current Figma ones are official)

## Group G — Typography

- [PENDING] **G3** Additional brand-custom typeface (if any beyond Instrument Sans / Serif / JetBrains Mono)

## Group H — Video (optional)

- [PENDING] **H1** Maxwell screen-recording 10–20s · loop, muted
