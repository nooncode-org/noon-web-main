import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypeScript from "eslint-config-next/typescript"

const eslintConfig = [
  // Operator scripts: ad-hoc smoke tests, kept in CommonJS/require style on purpose.
  // They run with `node --env-file=.env scripts/manual/...` and have their own README.
  //
  // Build output: `eslint .` was walking `.next/`, so a local `npm run lint` took
  // ~45 minutes and reported 458k problems (35k of them errors) from compiler
  // output nobody writes. CI never noticed because there lint runs BEFORE the
  // build, so `.next` does not exist yet — which is exactly why this went unseen.
  // Measured after ignoring it: the source tree is 0 errors / 12 warnings.
  { ignores: ["scripts/manual/**", ".next/**", "out/**", "coverage/**", "playwright-report/**"] },
  ...nextCoreWebVitals,
  ...nextTypeScript,
]

export default eslintConfig
