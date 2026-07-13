# Maxwell Studio — audit + redesign plan

**Date:** 2026-07-11 · **Status:** audit only, nothing changed yet.
**Scope:** the Maxwell app surfaces (`/maxwell/studio` and friends) — **~4,543 lines across 11 components** in `components/maxwell/`. These were **deliberately excluded** from the `-rd` marketing redesign, so the whole studio is still on the pre-redesign system.

**Guiding constraint:** this is a **functional app surface** (AI chat, live preview generation, proposals, Stripe payment) — NOT a marketing page. Redesign must be a **re-skin via tokens/CSS with logic untouched** (the proven pattern from the Upgrade functional components), done **1x1 with the owner**, phased by component. No logic rewrites.

---

## Component weights
| Component | Lines | Role |
|---|---|---|
| `studio-shell.tsx` | 1449 | orchestrator (state, layout, panes) |
| `studio-preview-pane.tsx` | 770 | live preview iframe + states |
| `studio-chat-pane.tsx` | 716 | the chat (what you see first) |
| `studio-header.tsx` | 491 | top bar + mobile drawer |
| `studio-proposal-cta.tsx` | 482 | proposal CTA / conversion |
| `public-proposal-payment.tsx` | 323 | Stripe payment surface |
| `proposal-document.tsx` | 127 | proposal render |
| others (correction-bar, quota-strip, thinking-block, reentry-banner) | ~185 | small pieces |

---

## Dimension 1 — Visual: entirely pre-`-rd`
- **Not scoped to `-rd`** — uses the global shadcn tokens (`bg-background`, `border-border`, `text-muted-foreground`) + **42 hardcoded hex colors** (preview-pane 20, proposal-cta 17, chat-pane 3, correction-bar 2).
- **Preview pane is hardcoded DARK-ONLY.** Near-black hex baked in: `bg-[#050505]`, `bg-[#070707]`, `bg-[#0c0c0c]`, `bg-[#131313]` (`studio-preview-pane.tsx:98,131,133,184,496,552…`). It **cannot do light mode** and won't theme. The `-rd` system is dual light/dark → biggest re-skin lift is here.
- **Mono font is wrong.** Header + others use Tailwind's default `font-mono` (= JetBrains Mono) instead of the `-rd` **Geist Mono** (`studio-header.tsx:66,230,271,430,434`).
- **Radii + type are arbitrary**, not on the `-rd` scale: `rounded-2xl`, `rounded-xl`, `rounded-[10px]/[8px]/[6px]`, `text-[17px]/[11px]/[10px]` — vs `-rd`'s `--radius-md/sm/pill` + Geist type scale.

## Dimension 2 — Copy / i18n: nonexistent, mixed-language
- **Zero `useTranslations` in ANY studio component** — every string is hardcoded. So all 4 locales (`/en /es /fr /de`) render the **same** hardcoded mix.
- **Spanish/English are mixed on screen.** The Maxwell greeting is Spanish while the rest is English:
  - `studio-chat-pane.tsx:527` — *"Soy Maxwell, arquitecto de soluciones en Noon."* (ES)
  - `studio-chat-pane.tsx:530` — *"Cuéntame qué quieres construir…"* (ES)
  - `studio-chat-pane.tsx:668` — *"Describe what you want to build…"* / *"Ask a follow-up…"* (EN)
  - Spanish also scattered in `studio-preview-pane.tsx` (6) and `studio-shell.tsx` (4) — even **code comments** are Spanish (`studio-shell.tsx:204`).

## Dimension 3 — Mobile: admitted degradation
- Explicit banner **"Studio works best on desktop"** shown only below `lg` (`studio-shell.tsx:1350`).
- Layout is **two panes** — chat (`lg:w-[440px] xl:w-[500px]`) + preview (`flex-1`). Below `lg` they **collapse to a single-pane toggle** (Chat ↔ Preview buttons in the header); you can't see both (`studio-shell.tsx:1365-1420`).
- Thin responsive coverage overall — **only 26 breakpoints across 4,543 lines**.

---

## Per-component severity (re-skin effort)
| Component | Visual | Copy/i18n | Mobile | Priority |
|---|---|---|---|---|
| chat-pane | med (3 hex) | **high** (ES greeting) | med | **P1** (most visible) |
| preview-pane | **high** (20 hex, dark-only) | med (6 ES) | high (10 bp) | **P2** (biggest lift) |
| header | med (mono, radii) | low | med (drawer) | P3 |
| shell (chrome) | med | med (4 ES) | **high** (pane toggle) | P3 |
| proposal-cta | **high** (17 hex) | low | low | P4 (conversion — careful) |
| payment/doc | med | low | low | P4 (payment — careful) |

---

## Proposed phased plan (risk-ordered, logic untouched)
- **Phase 0 — Foundation + copy (low risk).** Decide the language model (see open decisions). Fix the visible ES/EN mix now. Add an `-rd` token scope wrapper for the studio root (mirrors `.upg-rd`) so descendants can adopt `-rd` tokens.
- **Phase 1 — Chat pane.** Re-skin `studio-chat-pane.tsx` to `-rd` (Geist type scale, `-rd` radii, tokenized colors, empty-state polish). Most visible surface; contained & verifiable.
- **Phase 2 — Preview pane.** Replace the hardcoded near-black hex with `-rd` tokens so it does light **and** dark; align radii/type. Biggest lift.
- **Phase 3 — Header + shell chrome.** `font-mono` → Geist Mono, radii → `-rd`, drawer to match `-rd`, banner styling; improve the mobile chat/preview toggle UX.
- **Phase 4 — Proposal + payment surfaces.** Re-skin `proposal-cta` (17 hex), `public-proposal-payment`, `proposal-document`. Conversion/payment — extra care + verification.
- **Phase 5 — Proper i18n (optional, separate track).** Wire next-intl through all studio copy → `messages/*.json` in 4 locales.

## Open decisions (owner)
1. **Target language now:** English-only (site default is `/en`), Spanish-only, or full 4-locale i18n (Phase 5)? Determines Phase 0.
2. **Depth:** full re-skin to `-rd` (Phases 1–4) or just kill the worst offenders (copy mix + dark-only preview)?
3. **Order:** start P1 (chat, most visible) or P2 (preview, biggest lift)?
