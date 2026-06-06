# project.context.core.md - Noon Website / Maxwell Studio

> Last updated: 2026-06-06
> Active session: D-slice ADR-023/024 cross-repo prototype decision contract is live end-to-end; soft launch hardening from `NoonWeb Roadmap.md` and `NoonWeb_Roadmap_Gaps_v3.md` continues
>
> **2026-06-05 session — branch `feat/motion-foundation` (pushed, PR pending):** Assets inventory reconciled to implemented reality (`specs/2026-06-04-assets-inventory.md`: A covered/superseded, A19 dropped; E logos resolved official + colors fixed; F4 verified Figma-official; B/C/D/G/H postponed). Reduced-motion foundation shipped — `MotionConfig reducedMotion="user"` + new `usePrefersReducedMotion` (reads the initial `matchMedia` value, fixing framer's missed pre-set state) wired through `useRevealOnView`/`useRevealMotion`, plus a global CSS reduced-motion baseline; Playwright-verified (/about hidden-under-reduce 54→7, at parity with normal motion). Dark/light mode verified HEALTHY — the audit's "`dark:` dead / light broken" claim is STALE (`.dark` toggles via the layout inline script, `@custom-variant dark` makes `dark:` class-based, both themes render correctly). Services decision-map (Tier 1) now SHIPPED — see the note immediately below.
>
> **2026-06-05 session B — branch `feat/motion-foundation`:** Services decision-map (Tier 1, audit's most-differentiating item) SHIPPED. Rebuilt `components/sections/decision-map.tsx` from a radial fan into an on-brand **two-path flow** (Build: Custom Dev→Eng Support · Improvement: Audit→Upgrade): a "You" source fans into two sequential lanes. Geometry via **measured node anchors + SVG overlay** (the rendered DOM is the single coordinate source — kills the old CSS-%/viewBox drift); connectors path-draw (`pathLength`) + a traveling token (`offsetPath`); hover/focus **path-highlight** (lights one lane, dims the other 0.22) with keyboard + focus-ring; explicit reduced-motion gate via `usePrefersReducedMotion` (paths full-drawn, NO token/loops — framer doesn't neutralize pathLength/offsetPath). Reference-driven (Linear milestones branch diagram + Vercel Fluid-Compute lanes / crop-mark framing). Public API unchanged → `services-content.tsx` wiring untouched. Also **removed the off-brand `PipelineShowcase`** from /services (Chunk 2, owner-delegated): its source confirmed the audit P0 (hardcoded `text-white` invisible in light mode, fabricated metrics "3x/24h/100%", forbidden "in record time", public GPT-4/V0/Opus names, terminal motifs); it was the ONLY consumer and not on Home; the process message is preserved on-brand in the existing `ScrollLitStatement` above the map. `components/sections/pipeline/**` is now orphaned dead code (deletion = separate cleanup task). Verified Playwright across light/dark × normal/reduced × desktop(390/1440) (all green: desktop 4 connectors/4 tokens, reduce 0 tokens/0 undrawn, mobile 2/2, 4 correct links, 0 stuck-invisible) + hover/keyboard highlight; `eslint` + `tsc --noEmit` + `next build` all pass. Specs: `specs/2026-06-05-services-decision-map.md` (+ `.arch.md`). HOME UNTOUCHED (owner constraint). **Resume next:** open backlog in `specs/2026-06-01-noon-vs-vercel-audit.md` (Tier-1 CTA system #13, or delete the orphaned pipeline module).
>
> **2026-06-06 session C — branch `feat/motion-foundation` (frontend/visual/UX only; HOME FROZEN throughout — all improvements distributed to OTHER pages/new pages):** Premium design overhaul + deep reference audit + new sections/pages. **Foundation:** unified all headings to Instrument Sans (was serif-default vs sans-figma-canon) + negative tracking + bigger hero scale (~34→46px) + opened section spacing (~64/96px). `--font-display` now points at sans (serif retired, unused). **Off-brand cleanup:** ResponseTimeline (/contact) rewritten to flat system + fabricated "<2hrs/24-7/100%" stats removed; About "Our approach" eyebrow fixed + "in minutes" dropped; Templates glass eyebrows flattened; `floating-tech-elements` removed from Upgrade (still on Home — frozen). **New on-brand sections:** `components/sections/how-we-work.tsx` (Services — Linear numbered-pillars, human-review emphasized); `components/sections/stack-authority.tsx` (Services — honest "built-on Anthropic/OpenAI/Vercel/Stripe/Supabase" authority + human-review wedge, via new shared `components/ui/mask-logo.tsx`); `components/sections/human-review-proof.tsx` (About, after MaxwellDemo — the wedge as a believable review artifact: AI drafts → senior engineer approves). **New page:** `app/[locale]/security/page.tsx` (Security & ownership — honest claims only: human review, code/IP ownership, certified infra; specifics route to contact, NO fabricated certs; linked in footer "More"). **Audit (persisted):** `specs/2026-06-06-noon-premium-completeness-audit.md` + `specs/2026-06-05-premium-audit-references.md` (Vercel/Linear/Cursor/Bubble/Base44/Emergent/webuild + Stripe/Ramp/Vanta/Resend/etc.). Finding: foundation solid; remaining gap = 4 layers (demonstration, credibility, process-narrative, editorial rhythm), MOST GATED on owner assets. **Owner framing decisions (2026-06-06):** human-review = show it visibly; tools = name them but not the internal "how" / no model names; turnaround = qualitative ("days, not months") until a real number; iterations = "2 rounds of feedback included"; reviewers = abstract role ("senior engineer"); respect the pre/post-pay wall. **Honest authority rule:** "built on" (capability) ✅, never "trusted by/partners" (endorsement) ❌. **Orphaned (do not activate — redundant):** `components/landing/how-it-works-section.tsx` (heavy 6-stage Maxwell explainer) — About's "From idea to launch" already covers the journey. All builds Playwright-verified light/dark(+mobile) + eslint + next build. **Resume next:** owner to provide a first asset slice (1 case study + ≥2 client logos + 1 metric) + real data/IP practices + per-service step definitions → then build `/work` (case studies), a real stat band, per-service process visuals, named testimonials, and a segmented logo wall.
> Operating mode: Website-only implementation, with App coordination through the existing payment + proposal-review contracts plus the new prototype-decision contract (ADR-023) and prototype signed-read contract (ADR-024)

## Active Roadmap Inputs

- `C:\Users\white\Downloads\NoonWeb Roadmap.md` is the primary decision source for the current launch.
- `C:\Users\white\Downloads\NoonWeb_Roadmap_Gaps_v3.md` is supporting context for gaps and future v3 work.
- Launch payment is Stripe Checkout (primary) with manual evidence as a fallback (owner decision 2026-06-04). Treat this as truth over older manual-only notes elsewhere in this doc's history.
- Do not modify `App-nooncode` unless a verified cross-project contract requires it.

## Product Boundary

- Noon Website and Noon App are separate products in the same ecosystem.
- Website owns the public client experience: marketing pages, Maxwell, public proposal viewing, client payment evidence, and client workspace entry.
- Noon App owns collaborator operations: PM review, developer board, post-payment operations, and internal execution.
- Integration between products happens through signed webhooks and documented contracts, not shared UI or shared database assumptions.

## Current Launch Decision

- Launch the current English website before the future v3 redesign.
- Initial launch is EN-only; `/es`, `/fr`, and `/de` redirect to `/en`.
- Fase 1 payment is Stripe Checkout as the primary path; manual `submit_payment_evidence` remains as a fallback channel.
- Both paths render in the public proposal UI (`components/maxwell/public-proposal-payment.tsx`): "Pay with card" (Stripe) is the primary CTA, "paid through another channel" (manual evidence) is the secondary fallback.
- Public launch should happen after the current scope passes local gates and production env/runtime checks.

## Payment Contract

- PM review lives in Noon App.
- Noon App sends review decisions to `POST /api/integrations/noon-app/proposal-review-decision`.
- A public proposal can be paid (Stripe Checkout) or receive payment evidence (manual fallback) only after it is sent or payment-pending.
- Primary path: the client starts Stripe Checkout via `POST /api/maxwell/checkout`; the `checkout.session.completed` webhook (`POST /api/stripe/webhook`) confirms payment via `confirmProposalPayment`.
- Fallback path: client evidence is submitted through `POST /api/maxwell/payment` with `action: "submit_payment_evidence"` and either `public_token` or `proposal_request_id`.
- The proposal owner must be authenticated, or an authorized reviewer session must be present.
- Submitted evidence moves the proposal to `payment_under_verification`.
- A reviewer still verifies payment through the internal payment actions before workspace activation.
- `client_workspace` must not become active before verified payment.

## Prototype Decision Contract (ADR-023 + ADR-024, cross-repo)

- The Maxwell chat lead-creation flow issues a single-use `share_token` that the client opens at `/maxwell/prototipo/[token]`.
- The render route GETs the prototype payload from Noon App via signed-read (ADR-024): `GET {NOON_APP_BASE_URL}/api/integrations/website/prototype-signed-read/[token]`, HMAC-signed with empty body (`${timestamp}.`).
- The client posts an accept/reject decision to Noon App via `POST {NOON_APP_BASE_URL}/api/integrations/website/prototype-decision` (ADR-023). Noon App authoritatively persists into `prototype_decisions`, applies Cap-FIRST/Credits dual-gate, and fires the post-accept Maxwell draft as a fire-and-forget background task.
- Web is the render + capture surface; Noon App is the system of record for decisions, iterations, and credit accounting. Web never invents idempotency at the payload level — the transport ledger is the single idempotency layer.
- Route gated by `MAXWELL_PROTOTIPO_DECISION_ROUTE=1`. OFF by default — when unset/empty the route renders `notFound()` so accidental discovery is indistinguishable from a non-existent path.

## Current Stack

- Frontend: Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, next-intl.
- Backend: Next.js API routes with `runtime = "nodejs"` and `dynamic = "force-dynamic"` where needed.
- Database: PostgreSQL/Supabase via `postgres.js`; no ORM.
- Auth: NextAuth v5 JWT, Google OAuth with verified email.
- AI/prototypes: OpenAI SDK and v0 SDK.
- Tests: Vitest unit/integration plus Playwright specs where present.

## Stable Modules

- Public site: `app/[locale]/page.tsx`, `components/landing/**`, `lib/site-config.ts`, `lib/site-tones.ts`.
- Maxwell client flow: `app/[locale]/maxwell/**`, `components/maxwell/**`, `lib/maxwell/**`.
- Public proposal: `app/[locale]/maxwell/proposal/[token]/page.tsx`.
- Public prototype decision (D-slice ADR-023/024): `app/[locale]/maxwell/prototipo/[token]/page.tsx` + `_components/{decision-panel, error-states, prior-decision-summary, prototipo-frame}.tsx` + `_actions/submit-decision.ts`, helpers in `lib/maxwell/prototipo-{decision,decision-types,render-fetch,render-types,route-flag}.ts`.
- Review/webhook bridge: `app/api/integrations/noon-app/proposal-review-decision/route.ts`.
- Cross-repo signed-read loopback (dev-only, 404 in prod): `app/api/integrations/website/prototype-signed-read/[token]/route.ts`.
- Payment boundary: `app/api/maxwell/payment/route.ts`, `lib/maxwell/payment-activation.ts`.
- Launch infra: `proxy.ts`, `next.config.mjs`, `vercel.json`, `app/sitemap.ts`, `app/robots.ts`.

## Critical Rules

1. Do not expose source code, repository access, or technical deliverables before payment.
2. Every public proposal must pass PM review before payment evidence is useful.
3. Do not activate a workspace before verified payment.
4. Preserve Website/App separation.
5. Return stable `data.code`/`code` values for client-handled errors.
6. Keep public launch EN-only until the roadmap explicitly enables other locales.
7. Do not introduce new infrastructure without a concrete launch requirement and validation path.
8. Docs must reflect implemented reality, not intention.

## Current Verified Reality

- CI exists in `.github/workflows`.
- Noon App review decision webhook tests exist in `tests/maxwell/noon-app-webhook.test.ts`.
- Private/local URL blocking exists in upgrade URL normalization.
- Contact notification email HTML is escaped.
- Prototype iframe is sandboxed and uses `referrerPolicy`.
- `review-sla` accepts `REVIEW_API_SECRET` or `CRON_SECRET`.
- The primary soft-launch payment path is Stripe Checkout; manual evidence submission remains as a fallback.
- Sentry instrumentation is live (`SENTRY_DSN` + `SENTRY_TRACES_SAMPLE_RATE=0.1` set in Vercel Production since 2026-05-18). Coexists with Vercel Analytics.
- UptimeRobot monitors `https://noon-main.vercel.app/api/health` every 5 minutes since 2026-05-18.
- Legacy `NOON_APP_WEBHOOK_SECRET` fallback removed from code 2026-05-25 (PR #15); canonical `NOON_WEBSITE_WEBHOOK_SECRET` is the only one read by `lib/runtime-env.ts`. Vercel-side env-var deletion is a separate operator step.
- `MAXWELL_LIFECYCLE_EMAILS=1` set in Vercel Production 2026-05-25; B8 lifecycle emails active.
- D-slice ADR-023/024 implementation is on `main` (PRs #17 + #18) but the public route stays gated behind `MAXWELL_PROTOTIPO_DECISION_ROUTE` until bilateral smoke against Noon App passes. App-side handlers (`POST prototype-decision`, `GET prototype-signed-read`) are live in `develop` on the App repo per ADR-023 B/C/Pull-B.2.

## Open Risks

- The live Supabase/Vercel runtime must be checked before public launch.
- Stripe env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) are launch-critical: card checkout is the primary payment path, and the boot guard (`lib/server/runtime-env.ts`) now fails fast in production if either is missing.
- `npm audit` has reported high-severity dependency advisories before; upgrade must be a controlled dependency slice.
- v3 remains deferred until after the current EN-only launch unless the roadmap is replaced.
- D-slice flag flip (`MAXWELL_PROTOTIPO_DECISION_ROUTE=1`) requires a bilateral Web↔App smoke test before being turned on in Vercel Production. Preview can be flipped earlier for staging tests.
- `NOON_APP_WEBHOOK_SECRET` legacy env var still present in Vercel dashboard; needs operator deletion (safe in any order — canonical already wins).

## Next Recommended Steps

1. Run `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd test`, and `npm.cmd run build` before any deploy.
2. Validate the smoke path: sign in → Maxwell chat → prototype → proposal → payment evidence → internal verification → workspace.
3. Run bilateral D-slice smoke test against the App `develop` deploy (POST `/api/integrations/website/prototype-decision` + GET `/api/integrations/website/prototype-signed-read/[token]`) before flipping `MAXWELL_PROTOTIPO_DECISION_ROUTE=1` in Vercel Production.
4. Operator cleanup in Vercel dashboard: delete legacy `NOON_APP_WEBHOOK_SECRET` env, set `MAXWELL_PROTOTIPO_DECISION_ROUTE=1` in Preview first, then Production.
5. Push/merge only from the Website repo; keep App changes separate if ever needed.
