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
> Screenshots only stay useful for the template thumbnails (A10–A17).
>
> **RECONCILED 2026-06-05:** Every A item audited against live code. Delivered
> software (A6–A9), Upgrade generated version (A5), delivery timeline (A18), and
> pipeline (A20) are all rendered by LIVE components — no screenshots. A19
> (architecture) dropped for soft launch. Net: Group A needs NO owner-provided
> assets; only residual is template-thumbnail quality (A10–A17), tracked as
> post-launch debt.

- [SUPERSEDED] **A1** Maxwell studio · "Prototype ready" → replaced by live MaxwellDemo on /about (chat + live DemoPrototypePreview pane)
- [RECEIVED] **A2** Maxwell studio · Intake / empty state → `public/product/maxwell-intake.png` (captured by Claude via localhost auth bypass, 2880×1800, dark)
- [SUPERSEDED] **A3** Maxwell studio · prototype preview → live DemoPrototypePreview pane in MaxwellDemo shows the ready state (generating/polling loader is a transient state, not needed for marketing)
- [SUPERSEDED] **A4** Upgrade · Audit → replaced by live UpgradeDemo on /upgrade (real UpgradeAuditPanel + demo data)
- [SUPERSEDED] **A5** Upgrade · Generated version → live `UpgradeVersionPanel` (`components/upgrade/upgrade-version.tsx`), not an image. No asset needed.
- [SUPERSEDED] **A6** Delivered software · AI & Automation → live CSS mockups in `explore-builds-section` (no screenshot)
- [SUPERSEDED] **A7** Delivered software · Web → live CSS mockups in `explore-builds-section`
- [SUPERSEDED] **A8** Delivered software · Mobile → live CSS mockups in `explore-builds-section`
- [SUPERSEDED] **A9** Delivered software · Custom / Workflow → live CSS mockups in `explore-builds-section`
- [COVERED] **A10–A17** Templates (8 categories) → 8 thumbnails in `public/templates/`, wired via `data/templates.ts`. Reconciled 2026-06-05: AI-generated placeholder mockups (gibberish UI text at large size on `/templates/[slug]`). Acceptable for EN-only soft launch (no regression); POST-LAUNCH DEBT to replace with cleaner mockups / real demo screenshots. No real demo apps to capture yet → kept as-is.
- [SUPERSEDED] **A18** Delivery timeline → live `response-timeline.tsx` + `how-it-works-section.tsx` (no image)
- [DROPPED] **A19** System architecture diagram → owner decision 2026-06-05: drop for soft launch (niche for marketing + real-architecture over-disclosure risk). Reconsider in v3 only.
- [SUPERSEDED] **A20** Pipeline (4 steps) → live `components/sections/pipeline/` module (showcase + nodes + animated connection), no image

## Group B — Photos

> **POSTPONED 2026-06-05 (owner):** no team/photos section exists (no `/photos/` slot, no team component). Needs a section BUILT first — deferred to v3, not a soft-launch asset drop-in.

- [POSTPONED] **B1** Team / founders → `public/photos/team.jpg`
- [POSTPONED] **B2** Process / workspace → `public/photos/work-*.jpg`
- [POSTPONED] **B3** Individual founder portraits → `public/photos/founder-*.jpg`

## Group C — Client / partner logos

> **POSTPONED 2026-06-05 (owner):** no client/partner logo-wall exists (no `clients/`/`partners/` dirs, no "trusted by" component). Needs a section BUILT first + client permission — deferred to v3.

- [POSTPONED] **C1** Client logos (with permission) → `public/figma/logos/clients/<brand>.svg`
- [POSTPONED] **C2** Partner logos (with permission) → `public/figma/logos/partners/<brand>.svg`

## Group D — Real metrics (data only, no images)

> **NOTE (owner decision 2026-06-05):** Group D POSTPONED in full — no firm
> real numbers available yet; D5 case study also needs client permission.
> No invented metrics. Revisit when the owner provides real data.

- [POSTPONED] **D1** Projects delivered count
- [POSTPONED] **D2** Typical response time
- [POSTPONED] **D3** Uptime/reliability
- [POSTPONED] **D4** Years operating / team size
- [POSTPONED] **D5** Case study with numbers (with permission)

## Group E — Official stack logos

> **RECONCILED 2026-06-05:** Audited `components/sections/tech-ecosystem.tsx`. The
> logos are NOT generic placeholders — they are the official brand glyphs
> (simple-icons, sourced from official marks, CC0), rendered in each brand's
> official color via a Vercel-style CSS mask (`MaskLogo`), fully theme-aware.
> Refinement done: corrected two off-shade values to exact official hex
> (React `#58C4DC`→`#61DAFB`, Supabase `#3FCF8E`→`#3ECF8E`). Limit: a single-color
> mask cannot render multi-color/gradient artwork; for true full-color press-kit
> logos, drop official multi-color SVGs into `public/figma/logos/` and swap
> `MaskLogo`→`<img>` per logo (optional, post-launch).

- [RESOLVED] **E1–E6** Official brand glyphs in official colors via mask (Anthropic, OpenAI, Stripe, Vercel, Supabase, Next.js, TypeScript, React, Tailwind, Node.js, Python, PostgreSQL, Flutter). Colors corrected to official hex 2026-06-05. Full-color artwork = optional post-launch swap.

## Group F — Noon brand

- [INTEGRATED] **F1** Noon wordmark SVG → inlined in `components/ui/noon-logo.tsx` (LogoWordmark) with `fill=currentColor`, theme-adaptive (black/light, white/dark), used in header + footer + lockup. Replaced the old light/dark PNG pair (deleted `public/logo-wordmark*.png`). Source: `Recurso 29.svg` (RGB/SVG).
- [RESOLVED] **F2** Noon icon → owner decision (2026-06-05): KEEP the current `public/logo-icon.png` (2500×2500, flat-blue "no" monogram on white — correct raster for favicon/apple-touch/social cards, which can't be SVG). The available `alterno2.svg` is a DIFFERENT/alternate mark ("noon" + gradients), so adopting it would change the brand icon, not just vectorize it — not done. No vector swap.
- [RECEIVED] **F2b** Maxwell character icon (pixel-art crop of head + moustache, from talknew.gif first frame) → `public/maxwell-icon.png` (256×256, head centered on transparent square)
- [COVERED] **F3** Favicon → current `public/logo-icon.png` is 2500×2500 (HD), wired as `icon` + `apple` in `app/layout.tsx`. Sufficient; no new asset needed.
- [RESOLVED] **F4** Decorative illustrations → audit 2026-06-05 (provenance confirmed OFFICIAL): the 4 service-block SVGs (`card-custom-dev`, `card-upgrade`, `card-engineering-support`, `card-audit`) were ported from the Figma design system in commit `f966dd5` ("Port Figma design system"), governed by `specs/2026-05-28-figma-restyle-port.md`, and match the design reference `figma-screenshots/services-full.png`. Rendered as transparent line-art, recolored per theme (`invert dark:invert-0`, `opacity-70`). Kept as-is. Minor optional follow-up: `card-audit.svg` is 129 KB — could be SVGO-optimized.

## Group G — Typography

- [POSTPONED] **G3** Additional brand-custom typeface (if any beyond Instrument Sans / Serif / JetBrains Mono) — owner has none at hand 2026-06-05; current fonts stand.

## Group H — Video (optional)

- [POSTPONED] **H1** Maxwell screen-recording 10–20s · loop, muted — optional, deferred post-launch (owner 2026-06-05).
