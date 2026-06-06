# Premium Site Audit — Reference Foundation

> Reference bible for the section-by-section premium audit (owner directive 2026-06-05).
> Primary reference: **Vercel** · secondary: **Linear** · direct cohort: AI-builders.
> Captured live June 2026 by research agents. Recommendations in the per-section audits cite this.

---

## A. Strategic wedge — from the AI-builder cohort (Lovable, Base44, Emergent, Webuild, v0, Bolt, Replit)

**The whole cohort looks identical:** interrogative/pun hero ("What will you build?"), **in-hero prompt box as the demo**, "in minutes / no coding" speed promise, self-serve **credit-metered** funnel, gradient-glow minimalism. They all compete on the same axis: **speed + autonomy + scale.**

**Noon's white space is the inverse axis: trust, seniority, human review, ownership of real code.** It is the ONE thing no cohort member can credibly claim. Every borrowed best-practice must be bent toward proving *human rigor*.

**Borrow (bent toward rigor):**
- Replit's **named-executive testimonials** (name + title + company) — the most credible signal in the cohort; natural for Noon.
- Replit's **risk-free first step** ("first prompt free") → Noon = *free, scoped discovery / architecture teardown*.
- Bolt's **"professional, trusted by" + capability metrics** → Noon leads with **rigor metrics** (defect/escape rate, coverage, on-time), not volume.
- Emergent's **compliance/security signals high** (not buried).
- Webuild (closest analog: AI + engineers + source ownership) → Noon out-positions on seniority.

**Avoid (reads "toy"):** riddle hero · "in minutes/no coding" · in-hero prompt box · vanity counters ("2M apps") · credits-only self-serve funnel · burying the differentiator · interchangeable pastel-gradient look.

> **Direct hit on Noon today:** the current Home ("Tell us what you want to build" + prompt box, single screen) is wearing the cohort's exact uniform → it makes a senior services firm read as another prompt-to-app toy.

---

## B. Vercel playbook (primary reference) — with Noon do / adapt / avoid

### B1. IA / nav
- 5-slot nav (logo + Products / Resources / Solutions / Enterprise / Pricing) + right cluster (Ask AI / Log In / Sign Up). Left items = mega-dropdowns grouped by sub-headers (by product / by problem / by persona). Enterprise + Pricing are flat top-level = primary conversion paths. Footer = ~12 verb-grouped columns mirroring the customer journey (Build / Scale / Secure).
- **→ Noon:** 5-slot nav re-cast: **Services / Work / Industries / Enterprise / Company**. Services dropdown by offering (Custom Software / AI Builds / Modernization); Work by outcome/industry. Flat "Talk to us".
- **⛔ Avoid:** Pricing / Sign Up / Log In / Dashboard / Templates-marketplace / SDK columns (self-serve PaaS artifacts). Replace `Pricing`→`Approach/Engagement`; replace auth →`Start a project`.

### B2. Section arc (every page follows it)
`Hero → 3-up social-proof bar (customer + 1 metric) → capability/value grid (3-col) → technical/diagram proof → alternating image+text deep-dives (4–6) → logo wall → use-case grid by persona → closing CTA band → footer.` Home's 2nd act = **tabbed use-case switcher** (one hero, five audiences).
- **→ Noon:** same arc recast for services: Hero → 3-up outcome bar (client + result) → "what we do" service grid → **how-we-work diagram (discovery → build → human review → ship)** → alternating **case-study deep-dives with real delivered-work screenshots** → client logo wall → industries grid → closing "Start a project / Book a discovery call" band. Tabbed switcher → **by industry / by engagement type**.
- **⛔ Avoid:** code snippet (`npm i`) as a hero element; keep code/diagram to ONE subordinate "how we build" beat.

### B3. Visual system (Geist)
- **Type:** role-named token families, not arbitrary px — `heading-14…72` (≥32 gets a low-contrast "Subtle" modifier), `label-12…20` (mono variants 12/13/14), `copy-13…24` (higher line-height than label), `button-12/14/16`. Envelope ~12 → 64–72px. Line-heights 1.15 / 1.5 / 1.625. Letter-spacing tightens with size: −0.04em (display) → −0.01em (body).
- **Color = "accent as punctuation":** pure #000/#FFF + neutral gray ramp; color used rarely/intentionally (status dots, ONE accent on CTA, syntax). Light/dark first-class (every logo ships light/dark pair; footer has system/light/dark selector).
- **Borders > shadows; low radii; high whitespace.** Elevation from 1px hairline borders + bg contrast, not drop-shadow. Deliberately low density.
- **→ Noon:** steal the **role-named type scale** (enforces consistency); near-monochrome + ONE disciplined brand accent (#1200c5) used like punctuation; hairline borders + low radii + whitespace = premium/serious; mono only on the single "how we build" beat. Bias body to sans `copy` (business audience), not mono.

### B4. Motion rulebook (exact numbers — Vercel-Labs published)
- **Durations (all UI <300ms):** micro 100–150ms · standard UI (tooltip/dropdown/hover) 150–250ms · modals/drawers 200–300ms. *Larger element → slower.*
- **Easings (exact):** enter/exit → `cubic-bezier(0.215,0.61,0.355,1)` (ease-out); on-screen move → `cubic-bezier(0.645,0.045,0.355,1)` (ease-in-out); hover → plain `ease`. **Avoid `linear` (except marquee/progress) and `ease-in`.**
- **Scroll reveals:** IntersectionObserver / `whileInView`, fire-once, easing (not springs), ~0.5s with small stagger.
- **Springs only for "alive"/interruptible** (drag/momentum): `{type:"spring",duration:0.5,bounce:0.2}` (bounce 0.1–0.3).
- **Animate only `transform`+`opacity`** (GPU); `will-change:transform`. Don't animate 100×/day controls or keyboard actions.
- **Reduced motion mandatory:** `@media (prefers-reduced-motion:reduce){animation:none}` — no exceptions for opacity/color.
- **→ Noon:** adopt verbatim. Highest-value piece = animated **discovery→build→human-review→ship** flow diagram (mirrors Vercel system diagrams; Noon already has the shared ease curve + scroll-reveal gate + reduced-motion foundation — pin curves/durations to these).
- **⛔ Avoid:** "pulsing globe / live infra activity" footer (PaaS edge-network flex).

### B5. Trust / credibility (Vercel's most copyable layer)
- **Segmented logo walls** placed per page (enterprise page → enterprise logos; security page → security-team logos). Repeated, not once.
- **One quantified metric per customer, always** (7m→40s, 95% reduction, 24x; "22% Black Friday revenue", "76% conversion").
- **ROI band in money + 3rd-party-study cadence** ("$10M+ incremental profit", "264% ROI").
- **Named, titled, attributable quotes** — short, emotional-but-specific ("smoothest election night anyone could remember").
- **Compliance as a badge grid** (SOC2 Type 2, ISO 27001, PCI v4, HIPAA, GDPR, DPF) + detailed FAQ (encryption AES-256, pen-testing, bug bounty).
- **Case studies = the conversion asset** — clickable cards (logo + 1-line result + "Read story" + arrow), filterable by category.
- **→ Noon:** segmented logo walls; every case study leads with ONE hard metric; ROI band in $; named titled client quotes; compliance badge grid + FAQ (genuine enterprise de-risker if Noon touches client data/code); **"Senior engineers review every build" as a trust badge** (Noon's analog to Vercel's "we built Next.js" authority).
- **⛔ Avoid:** fabricated SLA / PoP counts / "we built Next.js"-style platform-authority. Services credibility = delivered work + named team + client testimony. (Ties to brand rule: no invented metrics.)

### B6. CTA system
- **Two-CTA hero** (`Start Deploying` self-serve + `Get a Demo` sales). **Three-tier closing band** (self-serve / Talk to an Expert / Explore Enterprise) — one band serves all intents. Section CTAs = quiet `Learn more →`. Sales verbs consultative. Pricing page = a **qualify-and-route** tool (Hobby/Pro/Enterprise-Custom), not a transaction. Sales page = tiny form + flanking proof logos/metrics.
- **→ Noon:** hero = **`Start a project` + `Book a discovery call`**; closing band = 2 tiers (call / enterprise); consultative verbs verbatim; quiet section CTAs (`See the case study →`); the `/contact/sales` template (short form + flanking proof) = Noon's primary conversion page.
- **⛔ Avoid:** self-serve primary CTA; public 3-tier $/user pricing table; "Free" tier. Collapse pricing to a single "How we engage" / "Custom — let's scope it".

### B7. Mockups / imagery
- **Realistic UI mockups with plausible-but-curated, non-round data** (634,200 visitors; 217ms; google.com 1.1M) — product-truthful. **Abstract system diagrams** for infra concepts with no UI (multi-tenant domains, Fluid Compute). Clean browser/device chrome, hairline borders, light/dark variants, no skeuomorphism.
- **→ Noon:** show **delivered client work** as realistic browser/device-framed screenshots (non-round metrics for verisimilitude); build **process diagrams** for what has no UI (discovery→build→review→ship).
- **⛔ Avoid:** faking a "Noon SaaS console" hero; dominant deploy-log/build-chip developer-console aesthetic.

### B8. Content / voice
- **Headlines:** 3–7 words, declarative, present-tense, light metaphor ("A self-driving delivery network", "Security that scales with you"). **Subhead = one sentence that operationalizes it.** **Altitude flexes by page** (technical on product pages; business/ROI on enterprise/contact). Customer voice emotional + specific. Feature cards lead with **outcome verbs** ("Proactively defend / Prevent regressions"). Light wordplay = premium signal ("Our team, on your team").
- **→ Noon:** 3–7-word metaphor headlines + substance subhead; flex altitude by audience; outcome-verb cards ("Ship faster", "De-risk the build", "Modernize without rewrites"); "human review" is a ready voice hook.
- **⛔ Avoid:** PaaS vocabulary as core message ("AI Cloud", "zero-config", "git push to infra", "PoPs", "deploy"). Noon's nouns = build / review / ship / modernize / team / engagement / outcome.

---

## C. Linear playbook (secondary reference) — with Noon do / adapt / avoid

**Thesis:** Linear sells a *feeling of quality* before features. Dark-first, near-monochrome, Inter, editorial pacing; credibility = *who uses it* (33,000+ orgs, OpenAI, Cursor, Ramp), not feature lists; closes on culture ("It's a feeling"), not transaction. Transferable core for Noon: **dark premium restraint + craft narrative + elite-client proof.** Non-transferable: product-UI mechanics (changelog, command-menu demos, per-seat pricing).

### C1. IA
- Short top nav (Product/Resources/Customers/Pricing/Now/Contact) + right cluster (Docs/Open app/Log in/Sign up); deep 6-column footer is the real sitemap. **Separates product-depth pages (`/plan`,`/build`) from brand-philosophy pages (`/method`,`/quality`)**; `/now` exists purely to broadcast velocity.
- **→ Noon:** ~5-item nav; capability pillars (AI Build / Custom Software / Human Review); **port `/method` + `/quality` as "Approach" + an editorial "On Craft" page — the single most copyable, most differentiating move**; a "Latest/Selected work" page instead of a changelog.
- **⛔ Avoid:** Open app / Download / Docs / Status nav; Product→Intake/Plan/Build decomposition (presume a logged-in product).

### C2. Section rhythm — the signature
- **A→B→A pacing:** never two loud sections back-to-back. A wide full-bleed product mockup (loud) is followed by a **quiet centered statement that names the benefit in plain language** (soft), then the next visual. **Numbered pillars** (`2.0 Plan`, `3.0 Build`) make the page feel like a spec/manual → reinforces craft. Archetypes: A wide-hero · B centered-statement · C 3-up triad · D split text/image · E bento grid · F inline state-chips · G card-grid index · H dated feed · I closing band.
- **→ Noon:** A→B→A = delivered-work screenshot → quiet principle line ("Every line of AI output reviewed by a human") → next project. Numbered pillars `01 Scope · 02 Build · 03 Human Review · 04 Ship`. Bento for capabilities; card-grid for "Selected work".
- **⛔ Avoid:** the home changelog beat; the 5-module product decomposition (Noon has 3–4 capabilities).

### C3. Visual tokens (verified, dark theme) — directly portable as a starting spec
| Role | Hex | | Role | Hex |
|---|---|---|---|---|
| Canvas bg | `#08090a` | | Muted text | `#62666d` |
| Nav surface | `#0f1011` | | Secondary text | `#8a8f98` |
| Card surface | `#161718` | | Tertiary text | `#d0d6e0` |
| Input surface | `#383b3f` | | Primary text | `#f7f8f8` |
| Border (Graphite) | `#23252a` | | **Primary accent** | Acid Lime `#e4f222` |
| | | | Link/icon accent | Indigo `#5e6ad2` |

- **Type:** Inter Variable (+ Berkeley Mono for code). Scale px: `12,13,14,15,16,17,20,24,32,48,64,72`. **Only 4 weights: 300/400/510/590** (custom 510 = signature "precise not bold"; 300 on display so headlines "whisper authority"). Tracking tightens with size: `-0.022em@72 → -0.010em@20`.
- **Spacing:** 8px system w/ 4px half-steps (`4,8,12,16,20,24,28,32,36,40,48,56,64,80,96,128`). **Radii:** badge 2 · control 6 · card 12 · pill full. Hairline 1px borders `#23252a` on `#08090a` — "structure felt not seen."
- **→ Noon:** dark-first near-monochrome ramp + **ONE distinct hot accent (NOT lime/indigo)** rationed to CTAs + one icon accent; a single grotesque with ≤4 weights, light display weight, negative tracking scaling with size; 8px spacing; small radii (6 control / 12 card). **⛔ Avoid copying the exact hexes — copy the system, not the colors.**

### C4. Motion
- Signature **scroll-linked word-by-word illumination** (reveal tied to scroll position, not a one-shot fade); mockups assemble on viewport entry; subtle hover (cards lift, hairline border brightens). Explicit current principle: **"Don't compete for attention you haven't earned"** — Linear *reduced* motion over time. `opacity/transform/filter` only; `prefers-reduced-motion` → static/fade fallback. (Exact curves unpublished.)
- **→ Noon:** 1–2 signature scroll-linked reveals (hero word-illumination; case-study assemble-on-entry), else near-still; ~200–300ms ease-out hover; brighten hairline on card hover; adopt the restraint principle verbatim.
- **⛔ Avoid:** looping product-UI demos (command-menu runs, app-state branch diagrams) — spotlight outcomes, not a fictional app.

### C5. Trust
- One recurring stat repeated on home + customers + pricing (*"powers 33,000+ product teams"*). Sector-tagged **logo wall at scale** (OpenAI/Cursor/Coinbase/Ramp/Vercel…) — recognizability IS the message. **Named, titled pull-quotes** (Gabriel Peal, OpenAI). Outcome-titled long-form case studies (*"Why OpenAI chose Linear and scaled to 3,000 users"*) arc: challenge → solution → implementation → **"It's a feeling"** (closes on emotion). Lets the *customer* articulate quality.
- **→ Noon:** one recurring proof stat (**flex caliber of clients, not raw count**, until volume exists); sector-tagged client logos; 3–5 named/titled testimonials; outcome-titled case studies with a human-quality closer; let clients voice the craft.

### C6. CTA
- **Two CTAs carry ~90%:** `Get started` (self-serve) + `Contact sales`; `→` arrow links for exploration; **closing band on every page** ("Built for the future. Available today."). Provocative **editorial hero-secondary** ("Issue tracking is dead") instead of "Learn more".
- **→ Noon:** standardize `Start a project` + `Book a call`; arrow links ("See the case study →"); repeated closing band with a confident line; one provocative POV hook.
- **⛔ Avoid:** Open app/Download/Log in; primary = **contact, not signup** (Linear is product-led self-serve; Noon is sales-led — the single biggest CTA difference).

### C7. Mockups
- **Real product UI screenshots** (not illustration), plausible specific fake data (`ENG-2108`), **stacked/layered compositions + subtle shadow**, bento abstraction only for conceptual things. **Linear has RETIRED the isometric line-art "Linear style"** the design world copied — current site is calm, realistic, screenshot-led.
- **→ Noon:** real delivered-work screenshots, layered + subtle shadow, masked data; restrained bento for process ("human review loop"). **⛔ Avoid fabricating app UI; avoid the dated isometric line-art.**

### C8. Voice — the craft spine (maps onto Noon's human-review wedge)
- Declarative, opinionated, craft-obsessed. **Paired-clause antithesis headlines:** *"Artificial colleagues. Natural collaboration." / "Built for the future. Available today." / "Delegate issues, but not accountability."* `/method` opens on *"the lost art of building true quality software"* (manifesto, numbered outline); `/quality` = *"you know it when you experience it"* interview series. Quality = **felt**, opinions = a feature.
- **→ Noon:** paired-clause antithesis (*"AI speed. Human judgment." / "Generated fast. Reviewed by people."*); an **Approach manifesto** ("AI can write code in seconds. Quality still takes a human."); an **editorial craft / responsible-AI series** (Linear's most ownable move — *especially* credible for a human-review firm); opinionated copy over feature-laundry. **Anchor every craft claim to demonstrable human review + client outcomes, or it reads hollow.**

---

## D. The north star (synthesis of all three)

Noon should **borrow Vercel's structure + rigor and Linear's craft narrative + restraint, while deliberately rejecting the AI-builder cohort's "type-a-prompt, app-in-minutes" tropes.** The positioning axis is the inverse of the cohort: **trust · seniority · human review · real-code ownership.** Concretely, across every section: monochrome + one rationed accent, role-named type scale, hairline borders, ≤300ms reduced-motion-safe motion with one signature system/flow diagram (discovery→build→human-review→ship), credibility via named clients + one hard metric each + compliance + a "human-reviewed" trust badge, a consultative two-CTA funnel (Start a project / Book a call — never self-serve signup), real delivered-work screenshots (never a fake console), and a paired-clause craft voice anchored to the human-review reality.
