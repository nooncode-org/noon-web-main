import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypeScript from "eslint-config-next/typescript"

const eslintConfig = [
  // Operator scripts: ad-hoc smoke tests, kept in CommonJS/require style on purpose.
  // They run with `node --env-file=.env scripts/manual/...` and have their own README.
  //
  // Build/tool output: never source, so never worth linting.
  //
  // The `.next*` glob is load-bearing, and the reason is worth keeping. This
  // comment used to say the local `eslint .` anomaly — 458,324 problems, 35,063
  // errors, ~30 minutes — was UNIDENTIFIED, and noted the counts were identical
  // before and after ignoring `.next/**`. That last observation was the answer
  // and was read as a dead end: the errors were never in `.next`.
  //
  // Measured 2026-08-08: this working copy holds TWENTY-FOUR sibling build
  // directories — `.next-old`, `.next-bak`, `.next-corrupt-121635`,
  // `.next-trash-1280749998` and so on. They pile up because the way to recover
  // from a corrupted Turbopack manifest is to move `.next` aside rather than
  // delete it. Together they hold 11,627 lintable files, and only the 1,175 in
  // `.next` were ignored. Linting the SMALLEST of them (69 files) on its own
  // reports 696 errors — twenty-four of those is the missing 35k exactly.
  //
  // So one character (`.next/**` -> `.next*/**`) takes the local run from thirty
  // minutes of noise to the source tree. CI never saw any of it: a fresh
  // checkout has no build output to trip over.
  { ignores: ["scripts/manual/**", ".next*/**", "out/**", "coverage/**", "playwright-report/**"] },
  ...nextCoreWebVitals,
  ...nextTypeScript,
]

export default eslintConfig
