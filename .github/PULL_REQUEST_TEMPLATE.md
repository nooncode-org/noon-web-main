<!--
Replace this entire file with your PR description before opening.
The sections below are the pattern that worked well in the 2026-05-19
sprint (17 PRs, zero confusion in review). Keep what's relevant for
your change; delete sections that don't apply.

Tips:
- The "Why" goes first. A reviewer should understand the motivation
  before reading the diff.
- "What changes" is file-by-file or section-by-section, not a git diff
  paraphrase — explain INTENT.
- "Gates" proves you actually ran them locally. CI will re-run on push,
  but reviewers shouldn't have to wait for CI to know the basics pass.
- "Out of scope" prevents scope-creep questions in review.
-->

## Why

<!--
1-3 sentences. What problem does this solve, or what motivates the
change? Link to the issue / spec doc / ADR if there is one.
-->

## What changes

<!--
Section-by-section or file-by-file. Explain intent, not just diff:

- `path/to/file.ts` — what changed and why (one sentence each)
- New endpoint / function / type → behavior contract
- Schema / migration → forward + rollback implications

If the change has multiple logical chunks, group them under sub-headings.
-->

## Tests

<!--
Required if you touched any .ts/.tsx outside docs/.

- `npm test` → N/N passing (baseline X → X + delta)
- New cases (list them briefly)
- Any test you DELIBERATELY chose not to write (with rationale)
-->

## Gates

<!--
Confirm the 4 gates pass LOCALLY before requesting review. CI will
re-run, but reviewer time is too expensive to wait on basics.

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx eslint <files>` — 0 errors/warnings new
- [ ] `npm test` — all green
- [ ] `npm run build` — Next build succeeds
-->

## Out of scope

<!--
Optional. Anything explicitly NOT included that a reviewer might
otherwise ask about. Prevents scope creep + repeated "should this also
do X?" comments.
-->

## Operational notes

<!--
Optional. Required if the PR introduces:
- A new env var (document default + how to override)
- A new migration (document apply order + dependency on other PRs)
- A new external dependency (provider account, API key, dashboard
  setup)
- A new dashboard endpoint / cron / scheduled job

Include rollback steps if non-trivial.
-->

## Risks + mitigations

<!--
Optional but recommended for changes touching:
- Payment / activation flows
- Auth / authorization
- Cross-repo contracts
- Production data shape (migrations, indexes)
- Performance-sensitive paths

Table format:
| Risk | Probability | Mitigation |
|---|---|---|
| ... | Low / Med / High | ... |
-->
