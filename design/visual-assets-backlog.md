# Noon Redesign — Visual Assets Backlog

Proactive list of visual assets that would **elevate** the redesign beyond what already exists — mockups, illustrations, graphics, support elements. Each: **what** to create · **where** it's used · **value** · **who makes it** (🟦 Claude Design mockup · ✏️ code/SVG illustration · 📷 owner photo · ⚙️ real product screenshot).

Reference bar: [design/references/atlas.md](references/atlas.md) — all 10 refs lean on **product UI + signature illustration**; that's exactly what Noon's pages mostly lack today.

---

## Tier 1 — Product proof (highest leverage)
The site SELLS "AI builds it, humans review it, you own it" but mostly *tells* it. The refs *show* product UI everywhere. Closing this gap is the single biggest quality lift.

### A1 · The human-review workspace ⚙️/🟦
- **What:** a polished view of an engineer reviewing AI-generated code — the diff, inline comments, and a sign-off / approval. Real screenshot of the existing Maxwell review workspace (`app/[locale]/maxwell/review`) if it's presentable, else a Claude Design mockup.
- **Where:** Work (a "how every build ships" band), Services, About, Approach.
- **Value:** THE differentiator made visible. "Human-reviewed" is currently an invisible claim — this is the highest-trust asset on the whole site.

### A2 · Maxwell product flow 🟦/⚙️
- **What:** 3–4 clean screens of the Maxwell flow — brief → generation → BuildReceipt → review. A short visual narrative of the product.
- **Where:** Services, Approach/how-it-works, Maxwell pages, About.
- **Value:** turns the process into something you can see; matches how Paradigm/Pathly/rekord all front their product.

### A3 · BuildReceipt artifact 🟦/⚙️
- **What:** the "receipt" of a build — what was generated, what a human reviewed, what shipped, ownership transfer.
- **Where:** Work, Services, the close of case studies.
- **Value:** a tangible, unique-to-Noon proof object; reinforces "you own the code."

---

## Tier 2 — Illustration signature (code/SVG)
The refs' atmosphere comes largely from a consistent thin-line illustration family. We have the system defined (gallery) but pages have none yet.

### B1 · Abstract-systemic hero graphics ✏️
- **What:** wireframe globe / node-graph / dot-field (rekord, CeSIA, Pathly), monochrome + sparse blue, one family.
- **Where:** Work hero (the empty right side), Services/About/Contact heros, section textures.
- **Value:** fills editorial whitespace with brand-signature atmosphere — the difference between "clean" and "premium."

### B2 · Isometric "how it works" scene ✏️
- **What:** a crafted blueprint-style isometric of the Noon process — brief → AI generates → human reviews → ship (Acme/Timeglass quality, far beyond a few boxes: wireframe devices, measurement grids).
- **Where:** Approach / how-it-works / Services process section.
- **Value:** explains the unique process visually; the isometric is a ref signature we haven't deployed. Highest-craft illustration item.

### B3 · Data-viz accents ✏️
- **What:** concentric-radar / small metric donuts / sparklines (EchelonAI), thin-line, for stats and outcomes.
- **Where:** Work stat band & case metrics, Services outcomes.
- **Value:** makes numbers feel designed, not typed.

---

## Tier 3 — Supporting
### C1 · Per-service mockups 🟦 — one representative product UI per service (Custom Dev, Upgrade, Engineering Support, Audit) on **Services**. Some case-study mockups already map. *Value:* makes Services concrete.
### C2 · Team / founder / code-review photos 📷 — real humans behind "human-reviewed," on **About** (and a small trust band). Owner-provided. *Value:* the most human proof; pairs with A1.
### C3 · Honest "built with" tech strip ✏️ — Next.js / Stripe / Vercel / Anthropic / Postgres (real tech, NOT fake clients). Replaces the "trusted by clients" strip the refs use (we have no client logos). *Value:* credibility without dishonesty.
### C4 · Refreshed OG / social cards ✏️ — per-page branded link-preview images in the new system (`opengraph-image.tsx`). *Value:* premium presence when shared.

---

## Per-page quick map
- **Work** (in progress): + B1 hero graphic · + A1 review band (optional) · + B3 metric accents.
- **Services:** A2 Maxwell flow · C1 per-service mockups · B2 process iso · A3 BuildReceipt.
- **Approach / how-it-works:** B2 isometric process (lead asset) · A1 · A2.
- **About:** C2 photos · A1 review workspace · B1.
- **Contact:** B1 light accent only (keep focused).
- **Home** (frozen — hero only): no new assets; inherits font/nav/color only.

## Recommended first commissions (Claude Design)
1. **A1 — human-review workspace** (biggest trust lift).
2. **A2 — Maxwell flow** (3–4 screens).
3. **C1 — per-service mockups** (when we rebuild Services).
B-items (illustrations) I build in code as each page needs them.
