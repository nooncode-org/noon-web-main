/**
 * tests/i18n/no-untranslated-ui.test.ts
 *
 * The ratchet. It does not demand a translated site — it forbids an
 * increasingly untranslated one.
 *
 * Rules, and only these three:
 *   1. A file may not carry MORE inline copy than the baseline records.
 *   2. A file the baseline has never seen may not arrive carrying any.
 *   3. A file the baseline lists must still exist (renames get noticed).
 *
 * Counts going DOWN is the point and never fails. Refresh the baseline after a
 * translation batch with:
 *
 *     UPDATE_I18N_BASELINE=1 npx vitest run tests/i18n/no-untranslated-ui.test.ts
 *
 * Written on 2026-08-07, the day it was measured that 43 components held ~329
 * inline phrases, after a redesign had silently un-internationalised pages that
 * had once read from the message files. Nothing caught it for months. This is
 * the thing that would have.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT, scanUntranslated } from "./untranslated-scan";

const BASELINE_PATH = join(REPO_ROOT, "tests", "i18n", "untranslated-baseline.json");

type Baseline = Record<string, number>;

const current = scanUntranslated();
const currentMap: Baseline = Object.fromEntries(
  current.map(({ file, count }) => [file, count]),
);

if (process.env.UPDATE_I18N_BASELINE === "1") {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(currentMap, null, 2)}\n`, "utf8");
}

const baseline: Baseline = existsSync(BASELINE_PATH)
  ? (JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Baseline)
  : {};

describe("untranslated UI copy never grows", () => {
  it("has a baseline to measure against", () => {
    // An empty baseline would make every other assertion vacuously pass, which
    // is the one way this guard could quietly stop guarding.
    expect(Object.keys(baseline).length).toBeGreaterThan(0);
  });

  it("adds no inline copy to a file that already had some", () => {
    const grown = current
      .filter(({ file, count }) => file in baseline && count > baseline[file])
      .map(({ file, count }) => `${file}: ${baseline[file]} → ${count}`);

    expect(
      grown,
      "These files gained hardcoded user-facing text. Read it from messages/*.json " +
        "instead — see app/[locale]/maxwell/workspace/[sessionId]/page.tsx for the pattern.",
    ).toEqual([]);
  });

  it("introduces no new component that writes its own copy", () => {
    const fresh = current
      .filter(({ file }) => !(file in baseline))
      .map(({ file, count }) => `${file} (${count} strings)`);

    expect(
      fresh,
      "New components must read their copy from messages/*.json. If this file is a " +
        "dev-only bench, add it to IGNORED in untranslated-scan.ts and say why.",
    ).toEqual([]);
  });

  it("still finds every file the baseline lists", () => {
    // A renamed or deleted file is fine — it just has to be re-recorded, or the
    // baseline slowly fills with entries that can never fail.
    const missing = Object.keys(baseline).filter(
      (file) => !(file in currentMap) && !existsSync(join(REPO_ROOT, file)),
    );

    expect(
      missing,
      "Baseline entries whose files are gone. Refresh with UPDATE_I18N_BASELINE=1.",
    ).toEqual([]);
  });
});
