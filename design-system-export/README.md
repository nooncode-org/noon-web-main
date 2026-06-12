# Noon design system — Claude Design export

Self-contained preview cards of the Noon marketing site's design system, built
for syncing into a **claude.ai/design design-system project** via the
`DesignSync` tool. Once synced, anything generated in Claude Design starts from
Noon's real tokens, type, components, patterns, and brand/mockup rules.

Every value here is extracted from the live site (`app/globals.css`,
`lib/site-tones.ts`, the shipped components) — this folder documents reality,
it does not invent it. Each card's first line carries the
`<!-- @dsCard group="…" -->` marker the Design System pane indexes.

| File | Group | Contents |
|---|---|---|
| `01-colors.html` | Colors | Core light/dark, primary #1200c5, site tones, chrome dots |
| `02-type.html` | Type | Instrument Sans scale (hero/section/card), body, JetBrains mono labels, voice |
| `03-layout.html` | Spacing | Shell/rhythm, radius scale, hairlines, the signature gap-px grid |
| `04-actions.html` | Actions | Primary pill/rect, outline, text links, utility pills, inline chip-links |
| `05-eyebrow-meta.html` | Components | Eyebrow variants, wedge badge, state tags, timestamps |
| `06-cards-chips.html` | Components | Hairline grid cards, status chips, metric pills, stat band |
| `07-patterns.html` | Patterns | Review gate, numbered principles, proof line, build receipt, mockup frame |
| `08-brand-rules.html` | Brand | The always/never table + the skeptical-CTO test |
| `09-mockup-spec.html` | Brand | The mockup generation spec (the distilled GLOBAL BLOCK) |

## How to sync (run from a Claude Code session with claude.ai login)

Paste this instruction into a CLI session whose auth can carry design scopes
(interactive `/login` — NOT a CLAUDE_CODE_OAUTH_TOKEN session):

> Sync the folder `design-system-export/` to my Claude Design account with the
> DesignSync tool: list my design-system projects; if none fits, create one
> named **"Noon Design System"**. Then finalize a plan with writes
> `*.html` + `README.md` and localDir `./design-system-export`, and write all
> ten files with `localPath`. Don't delete anything. The cards self-register
> via their `@dsCard` markers.

Updates: edit the HTML here, re-run the same sync (incremental, never a
wholesale replace).
