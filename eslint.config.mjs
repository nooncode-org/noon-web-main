import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypeScript from "eslint-config-next/typescript"

const eslintConfig = [
  // Operator scripts: ad-hoc smoke tests, kept in CommonJS/require style on purpose.
  // They run with `node --env-file=.env scripts/manual/...` and have their own README.
  { ignores: ["scripts/manual/**"] },
  ...nextCoreWebVitals,
  ...nextTypeScript,
]

export default eslintConfig
