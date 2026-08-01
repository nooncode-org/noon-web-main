import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypeScript from "eslint-config-next/typescript"

const eslintConfig = [
  // Operator scripts: ad-hoc smoke tests, kept in CommonJS/require style on purpose.
  // They run with `node --env-file=.env scripts/manual/...` and have their own README.
  //
  // Build/tool output: never source, so never worth linting. Cheap and correct
  // on its own merits.
  //
  // ⚠️ It does NOT explain the local `eslint .` anomaly, and an earlier version of
  // this comment wrongly claimed it did. The facts, measured:
  //   · the source tree is clean — `eslint app components lib hooks tests` and
  //     `scripts data *.mjs *.ts` give 0 errors (12 warnings, all pre-existing);
  //   · `npm run lint` locally reports 458,324 problems (35,063 errors) and takes
  //     ~30 minutes — with IDENTICAL counts before and after adding these ignores,
  //     even though a direct `npx eslint .next/<file>` confirms `.next` is now
  //     skipped;
  //   · `node_modules` is ignored by ESLint's own defaults (also confirmed).
  // So the source of those errors is still unidentified. CI is unaffected: it runs
  // `npm run lint` before any build exists and passes on the same clean file set.
  { ignores: ["scripts/manual/**", ".next/**", "out/**", "coverage/**", "playwright-report/**"] },
  ...nextCoreWebVitals,
  ...nextTypeScript,
]

export default eslintConfig
