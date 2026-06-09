# Handoff: Noon — `/work` Product Mockups (6 case studies)

> **Local rename (2026-06-06):** the original handoff's fictional product names
> collided with real software companies (Pallet → hiring platform, Vantage →
> booking software + cloud-cost tool, Strata/Quillon-class audit AIs, Cura →
> Ultimaker's slicer, Ember → ember.js, Tandem → several). All six were renamed
> to web-search-verified, collision-free inventions and the HTMLs/filenames
> updated accordingly: **Pallet→Ordwell · Tandem→Crewfield · Vantage→Lotvane ·
> Strata→Stackbrief · Cura→Visitra · Ember→Embertide.** Everything else is the
> original handoff as received from Claude Design.

## Overview
Six high-fidelity UI mockups for the **`/work` page of Noon's portfolio** (US-market tech dev studio). Each mockup represents a **different product Noon built for a client**, in a different sector, with its **own visual identity** (it is NOT Noon's brand — it's the delivered product's brand). The goal: each looks like a real screenshot of a shipping product, so a viewer thinks "that product exists and works."

These are **presentation/portfolio assets**, not an app to wire up. The most common use is to display them on the `/work` page (as embedded live frames or as exported screenshots).

## About the Design Files
The files in this bundle are **design references built as self-contained HTML** — each is a complete, styled, static mockup (realistic simulated data, functional-looking UI states). They are not production app code.

Two valid implementation paths:
1. **Use as-is** — embed each HTML in the portfolio (iframe / live frame) or export a screenshot and place it in the `/work` gallery. They are already polished and responsive-scaling.
2. **Recreate** — if the portfolio has a component system, rebuild each mockup as a component using the codebase's patterns, following the per-mockup specs below.

Each file scales to fit its viewport (a fixed-width canvas centered + `transform: scale()`), so it renders cleanly at any size.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, iconography and layout. If recreating, match pixel-for-pixel.

---

## External Dependencies (important for export)
All six load resources from CDNs at runtime:
- **Google Fonts** — one type family per mockup (see each below).
- **Iconify SVG framework** (`https://code.iconify.design/3/3.1.1/iconify.min.js`) — renders icons as inline SVG. Each mockup uses a **different icon set** (this is intentional, to differentiate identities).
- **CS3 only:** **Leaflet** (`unpkg.com/leaflet@1.9.4`) + **Carto dark basemap tiles** (`basemaps.cartocdn.com`) for a real map of Travis Heights, Austin TX.

⚠️ **Export note:** because icons (and CS3's map) load from external servers, automated HTML‑to‑image exporters can capture them blank. To get pixel-perfect PNGs, take a **real browser screenshot** once the page has fully loaded, OR inline the icon SVGs and map tile first. In-browser everything renders correctly.

---

## The Six Mockups

Shared frame for all: a **browser-window chrome** (traffic lights + URL bar) wrapping the product. Design canvas is **1440px wide** (CS5 is a desktop **+** phone composition, ~1640px wide). Body background is a soft tinted neutral so the framed window reads as a product shot.

### CS1 — Ordwell · E-commerce internal ops
- **Sector / ref:** Internal operations platform (Shopify Admin / Linear vibe).
- **Palette:** neutral light. bg `#e9e9e6`, app `#fff`, panel `#fbfbfa`, border `#ececea`, ink `#181815`, ink-2 `#5f5f59`, ink-3 `#9b9b93`. Accent **green** `#1f8a5b` (bg `#e7f3ec`), amber `#a96e12`, blue `#3a63b0`, rose `#b23b46`.
- **Type:** `Hanken Grotesk` (UI) + `JetBrains Mono` (IDs, SKUs, money — tabular figures).
- **Icons:** **Tabler** (`tabler:*`) — thin geometric line.
- **Layout:** left sidebar (236px) + topbar (60px) + content. Content = 4 metric cards (with corner sparklines) → 2-col grid: **live orders data table** (left, `table-layout:fixed` w/ colgroup) + **auto-classified returns queue** panel (right, 376px) with category tags + AI confidence bars.
- **URL:** `app.ordwell.io/operations`. Radius 12–14px. Shadow: layered soft.

### CS2 — Crewfield · B2B SaaS team management
- **Sector / ref:** People/HR platform post-redesign (Notion / Rippling vibe).
- **Palette:** cool light + **corporate blue** `#2563c9` (bg `#eaf0fc`, line `#d2e0f8`). Neutrals: bg `#eceef2`, ink `#191c24`, ink-2 `#586074`, ink-3 `#99a0b1`. Supporting: green `#1f8a5b`, violet `#6b4fc4`, teal `#0f8a8a`, rose `#c4476a`, amber `#a96e12`.
- **Type:** `Plus Jakarta Sans`.
- **Icons:** **Phosphor bold** (`ph:*-bold`) — rounded, friendly.
- **Layout (distinct from CS1):** top bar + left sidebar (222px) + context tabs. Content = a **blue gradient HERO band** with embedded KPIs + an 80% setup ring + "Connect payroll" CTA, then an **asymmetric BENTO grid** (`grid-template-areas`): big **Teams** tile (2-col team cards), narrow column with **Who's out today** + **Team pulse** (eNPS +42 with a promoters/passive/detractors bar), wide **Hiring pipeline** (vertical funnel bars), **Recent activity** feed.
- **URL:** `app.crewfield.com/home`. Hero gradient `linear-gradient(115deg,#1d4fa8,#2f6fd6 52%,#5b73e6)`.

### CS3 — Lotvane · Real estate analytics (DARK)
- **Sector / ref:** Property intelligence tool (Mapbox dashboard / Redfin Pro vibe).
- **Palette:** dark premium. bg `#070a0d`, map `#0d141b`, panel `#11171f`, border `#222c38`, ink `#eef3f8`, ink-2 `#9aa7b6`. Accents **teal** `#27c5b4` + **amber** `#e7a948` (selected pin), green `#46c489`, rose `#e26d7a`.
- **Type:** `Manrope` (UI) + `Space Grotesk` (prices, headings — tabular).
- **Icons:** **Solar bold-duotone** (`solar:*-bold-duotone`) — premium two-tone fill.
- **Layout:** browser chrome + topbar (logo, address search, filter pills, Saved) + 60px icon **rail** + **real Leaflet map** (Carto dark, centered `[30.2437, -97.7428]` zoom 16, 13 price-pin markers, selected in amber) + **side panel** (404px): listing header, photo placeholder, bed/bath/sqft stats, **Lotvane estimate** range bar, **Comparables** list (Δ vs subject $/sqft), "Generate buyer report" CTA.
- **URL:** `lotvane.re/map/austin-tx`. Map is static (interactions disabled).

### CS4 — Stackbrief · Tech-stack audit report
- **Sector / ref:** Professional-services deliverable (McKinsey deck / Linear roadmap vibe).
- **Palette:** clean white + strong type, minimal accent **navy** `#1d3f6e`. bg `#e7e5e0`, paper `#fff`, ink `#16160f`, ink-2 `#5a584f`. Verdict colors: keep `#1f7a4d`, consolidate `#9a6a12`, cut `#b23b46`.
- **Type:** `Archivo` (strong grotesque; H1 weight 900, tabular numerals).
- **Icons:** **Material Symbols** (`material-symbols:*` filled rounded) — corporate.
- **Layout:** browser chrome + TOC sidebar (248px, numbered sections, active w/ navy inset bar) + report viewer (toolbar: breadcrumb, page x/y, Share, Export PDF). Report body: eyebrow + big H1 + meta row (2px rule) → **4 summary metrics** separated by thin rules (no boxes) → **Stack & cost table** (tool, seats, annual cost, utilization bar, Keep/Consolidate/Cut verdict pill) → **3-phase roadmap** (navy→light gradient headers, initiative checklist + savings).
- **URL:** `stackbrief.audit/reports/northwind-q2-tech-audit`.

### CS5 — Visitra · Healthcare scheduling (DESKTOP + MOBILE)
- **Sector / ref:** Clinical scheduling (Calendly Pro / Epic MyChart vibe).
- **Palette:** clinical white + **soft blue** `#3b7fd4` + **green confirmed** `#2f9e6f`. amber pending `#c0892e`, rose cancelled `#d0576a`, violet `#7d5fc4`. bg `#e8ecf1`, ink `#1a2333`.
- **Type:** `DM Sans`.
- **Icons:** **Lucide** (`data-lucide`, rendered via lucide UMD) — clean clinical line. *(This is the one mockup that keeps Lucide.)*
- **Layout:** a **scene** holding a desktop window (1240px) **+** an iPhone mock (300×622, dynamic island) side by side, scaled together.
  - Desktop: sidebar (Schedule active, providers list) + **weekly calendar** (5 day columns, hourly grid via repeating-linear-gradient, absolutely-positioned appointment blocks colored by status: confirmed/reminder-sent/pending/done; selected appt has blue ring) + **patient panel** (316px): patient header, appointment card, **reminder status timeline** (SMS/Email/Confirmed with timestamps), **AI "Clinical summary"** card (auto-generated bullets), Start visit / Reschedule.
  - Mobile: "Today" agenda — status counts, time-grouped appointment list with reminder status, bottom tab bar.
- **URL:** `app.visitra.health/schedule`.

### CS6 — Embertide · Retail loyalty & marketing (DARK WARM)
- **Sector / ref:** Loyalty program dashboard (Klaviyo / Yotpo vibe).
- **Palette:** **warm** dark. bg `#120e0c`, app `#1a1512`, panel `#211a16`, border `#352a22`, ink `#f5ede4`, ink-2 `#b6a899`. Accents **gold** `#e0a83e` + **coral** `#e4795f`, green `#5cbf8a`. Tier colors: platinum `#d7dde4`, gold `#e0a83e`, silver `#aab2bc`, bronze `#c08457`.
- **Type:** `Outfit`.
- **Icons:** **Mingcute fill** (`mingcute:*-fill`) — chunky consumer fill.
- **Layout:** browser chrome + topbar (flame logo, store switcher, range) + sidebar (212px) + content. Content = a **continuous KPI ribbon** (one panel, 4 KPIs split by dividers — NOT separate cards) → 2-col: left = **Active campaigns table** (icon, type badge, audience, revenue, conversion bar) + **Loyalty revenue bar chart** (8 weeks, gold gradient bars); right = **Membership tiers** (Platinum→Bronze with tier-colored proportion bars + avg spend) + **Points activity** live feed (earn/redeem/tier-up).
- **URL:** `app.embertide.io/loyalty/overview`.

---

## Cross-cutting Design Tokens
- **Radius:** 8px (controls), 11–14px (cards/tiles), 14px (window).
- **Window shadow (light):** `0 1px 2px rgba(20,20,18,.04), 0 12px 40px rgba(20,20,18,.10), 0 40px 100px rgba(20,20,18,.10)` (dark variants use black at higher opacity).
- **Spacing:** content padding 22–34px; card padding 14–18px; grid gaps 14–16px.
- **Numbers:** always `font-variant-numeric: tabular-nums` for figures, money, IDs.
- **Status pills:** dot + label, low-saturation tints over a matching border.
- **Scaling:** each file has a `fit()` function — fixed canvas, `transform: scale(min(viewportW/canvasW, viewportH/canvasH))`, transform-origin center.

## Interactions & Behavior
These are **static** hi-fi mockups (no click handlers). Implied states are shown statically: one selected appointment (CS5), one active filter (CS3), one selected listing (CS3), live/"synced" indicators, hover affordances via CSS. If turning into real components, the layouts and status-color systems above define the state vocabulary.

## Assets
- **No bitmap assets** — all imagery is **placeholders** (diagonal-striped panels labeled e.g. "Property photo") for the user to drop real images into. Avatars are initials on colored circles.
- **Icons:** Iconify (per-mockup set above) + Lucide (CS5). **Fonts:** Google Fonts. **Map:** Carto dark tiles (© OpenStreetMap, © CARTO).
- All client names, brands, data are **fictional/simulated**.

## Files
- `CS1 - Ordwell (E-commerce Ops).html`
- `CS2 - Crewfield (SaaS Team Management).html`
- `CS3 - Lotvane (Real Estate Analytics).html`
- `CS4 - Stackbrief (Audit Report).html`
- `CS5 - Visitra (Healthcare Scheduling).html`
- `CS6 - Embertide (Retail Loyalty).html`

Each is fully self-contained (single HTML file, all CSS inline, dependencies via CDN). Open directly in a browser to view.
