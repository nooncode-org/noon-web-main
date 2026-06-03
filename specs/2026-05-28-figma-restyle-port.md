# spec: Figma restyle port → noon-web-main

## 1. Metadata
- **Iteration:** figma-restyle-port
- **Date:** 2026-05-28
- **Author:** Mel (owner) via Claude
- **Status:** Draft → Approved pending pilot review
- **Router mode:** Refactor (restyle existing pages) — NOT New Build

### Direction correction — 2026-05-28 (post first pilot)
> The initial "conservative nudge" pilot (color-split only on web-main's existing card hero) was **rejected** by Mel: "esa sección no es la del diseño de figma." Corrected direction:
> - **Reconstruct the sections with the actual Figma/sandbox design** — open grid hero, floating accent pills, dark dramatic aesthetic, service-card illustrations — rebuilt as responsive + light/dark + i18n components inside web-main.
> - **Adapt to web-main SCALE**: bring the Figma LAYOUT and look, but use web-main's typography sizes (`site-*` scale, NOT the sandbox's fixed 48px) and spacing rhythm, so the pages stay proportional to the rest of the site (nav, footer, home, upgrade).
> This supersedes the "nudge conservador" framing in §4/§13 below. The work is now a medium/strong re-skin at web-main scale.
- **Depth:** Full (touches shipped pages; 491 tests must stay green)
- **Source of truth:** Figma `qMnSMoWlSQyEyBVV7p4LIg` + sandbox `Noon-project` (already aligned to Figma)
- **Target:** `noon-web-main` pages `/services`, `/about`, `/opportunities`, `/contact`

## 2. Business objective
Bring the Figma visual direction into the four existing web-main marketing pages WITHOUT breaking the site's design-system scale, responsiveness, light/dark support, or i18n. The new look must feel native to the rest of the site (home, upgrade, maxwell), never oversized or out of proportion.

## 3. Key finding driving this spec
The four pages **already exist and are fully implemented** in web-main, with the SAME content as the sandbox but a DIFFERENT (and intentionally smaller) design system:
- Container `site-shell` (max 1400px, responsive padding)
- Typography via `site-hero-title` / `site-section-title` / `site-card-title` (responsive, clamped)
- `siteTones` accent system, lucide-react icons, light+dark, next-intl i18n, `useRevealOnView`
- **Hero title max ≈ 34px** vs sandbox/Figma **48px** → a naive copy would be ~40% oversized.

## 4. Scope — IN
- Restyle the **existing sections** of the 4 pages toward the Figma look, expressed entirely through web-main's tokens:
  - Use `site-*` typography classes (never hardcoded px from the sandbox)
  - Use `siteTones` for accents (map Figma's Bright Indigo/Mint Leaf/Accent Orange/Ultrasonic Blue to the nearest existing tone)
  - Keep responsive breakpoints, light+dark, i18n, `useRevealOnView`
- Bring in Figma's distinctive, scale-safe visual decisions:
  - Hero treatment (e.g., subtle technical grid backdrop) where it fits the scale
  - Service/area card illustration style (adapt sandbox SVG/PNG assets, sized to web-main cards)
  - Accent-color mapping per service/area
  - Spacing rhythm nudged toward Figma but capped by `site-section` scale

## 5. Scope — OUT (excluded)
- **5.1.** The Home page (`/`) and any of its sections. Untouched.
- **5.2.** Any **section that exists in the Figma but NOT in the current web-main page** (e.g., the "We don't develop generic software…" Statement block on Figma /services has no web-main equivalent → do NOT add it). Only restyle sections present in both.
- **5.3.** Any page/route not in the four listed.
- **5.4.** Replacing web-main's components wholesale with sandbox components.
- **5.5.** Introducing GSAP. web-main uses `useRevealOnView` — keep it.
- **5.6.** Hardcoded fixed-px font sizes / 1440px fixed layouts from the sandbox.
- **5.7.** Forcing dark-only. Light + dark both stay (Figma defines dark; light derived from tokens).
- **5.8.** Backend, i18n message restructuring beyond adding strings a restyle needs, auth, Maxwell, payments.

## 6. Acceptance criteria
- **AC1.** Each restyled page renders in BOTH light and dark without broken layout.
- **AC2.** Hero/section/card typography uses `site-*` classes — no sandbox fixed px leaks in.
- **AC3.** Side-by-side, the page reads as "the Figma design, at this site's scale" — not visibly larger/smaller than home/upgrade/maxwell.
- **AC4.** `npm test` (Vitest, 491) stays green; `test:a11y` Playwright passes; visual baseline diffs are intentional only.
- **AC5.** No new top-level sections added beyond those already present per §5.2.
- **AC6.** i18n preserved: pages already using `useTranslations` keep doing so; new copy goes through messages where the page is i18n-wired.

## 7. Affected files (best-effort)
```
app/[locale]/services/page.tsx        # restyle hero + service cards + decision guide
app/[locale]/about/page.tsx           # restyle bento/criteria/operating/stack (i18n-wired)
app/[locale]/opportunities/page.tsx   # restyle hero + areas + how-it-works
app/[locale]/contact/page.tsx         # restyle aside + form + pipeline stats
app/_components/site/*                # PageCard, PageSection, SiteCtaBlock, SitePageFrame — shared, change with care
app/globals.css                       # only if a scale-safe utility must be added
lib/site-tones.ts                     # read-only reference for accent mapping
messages/*.json                       # add strings only where a restyle introduces new copy on i18n pages
public/                               # port adapted illustration assets (cube, etc.) sized for web-main
```

## 8. Dependencies
| Type | Item | Status | Impact |
|---|---|---|---|
| internal | web-main design tokens (`site-*`, `siteTones`) | OK | Must be the styling vocabulary |
| internal | `useRevealOnView` hook | OK | Reveal animations |
| contract | 491 Vitest tests + a11y + visual baseline | OK | Must stay green |
| infra | web-main dev boots on :3100 with dummy `.env.local` | OK | Enables screenshot verification |
| external | lucide-react (icons), next-intl (i18n) | OK | Keep using |

## 9. Risks
| ID | Risk | Prob | Impact | Sev | Mitigation |
|---|---|---|---|---|---|
| R1 | Restyle drifts off web-main scale → oversized vs rest of site | Med | High | High | Only `site-*` classes for type; cap spacing at `site-section`; verify side-by-side vs home |
| R2 | Breaking 491 tests / a11y | Med | High | High | Run `npm test` + a11y after each page; restyle markup minimally |
| R3 | Light mode looks wrong (Figma is dark-only) | Med | Med | Med | Use semantic tokens (bg-card, text-muted-foreground) that flip automatically; spot-check light |
| R4 | Touching shared `_components/site/*` breaks home/upgrade/maxwell | Med | High | High | Prefer page-local changes; only edit shared components when safe + test all consumers |
| R5 | Adding Figma sections not in web-main (scope creep) | Med | Med | Med | Strict §5.2 — restyle only common sections |
| R6 | i18n: hardcoding English on i18n-wired pages | Low | Med | Med | Route new copy through messages on pages already using `useTranslations` |

## 10. Open questions
- **Q1.** How aggressive should the restyle be? (faithful Figma re-skin vs light nudge). → resolved by PILOT: do /services hero first, user calibrates.
- **Q2.** `/services` page is NOT i18n-wired (hardcoded EN) while `/about` IS. Keep that inconsistency or wire /services too? → defer; out of scope unless trivial.
- **Q3.** Accent mapping: Figma uses 4 distinct accents; web-main `siteTones` has brand/services/gateway/data/client/brandDeep. Confirm mapping during pilot.

## 11. Testing methodology
- **Visual:** Playwright screenshots of each page (light + dark) via `scripts/screenshot-webmain.mjs`, compared to Figma + sandbox.
- **Regression:** `npm test` (Vitest 491) + `npm run test:a11y` after each page.
- **Scale check:** capture home/upgrade alongside to confirm the restyled pages match the site's visual scale.

## 12. Definition of Done (per page)
- [ ] Hero restyled, `site-*` type, light+dark OK
- [ ] Body sections restyled, accents mapped to siteTones
- [ ] No new sections vs current page
- [ ] `npm test` green, a11y green
- [ ] Side-by-side scale parity with rest of site confirmed
- [ ] Screenshots archived in `specs/web-main-snapshots/`

## 13. Chunking decision
Pilot-first, then per-page:
| # | Chunk | Gate |
|---|---|---|
| P | **PILOT: /services hero only** | User approves direction before continuing |
| 1 | /services full | tests green + scale parity |
| 2 | /opportunities full | tests green |
| 3 | /contact full | tests green |
| 4 | /about full (most complex, i18n + bento) | tests green |

## 14. Success criterion
> The four marketing pages visibly carry the Figma design direction while remaining indistinguishable in scale, rhythm, and system from the rest of noon-web-main, with light/dark and i18n intact and the 491-test suite green.

## 15. Outcome
**Ready for PILOT.** Next: restyle `/services` hero at web-main scale, screenshot light+dark, user calibrates "how aggressive" before the full pass.
