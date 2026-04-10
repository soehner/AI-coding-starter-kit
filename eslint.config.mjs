import coreWebVitals from "eslint-config-next/core-web-vitals"

export default [
  ...coreWebVitals,
  {
    ignores: ["node_modules/", ".next/", "src/components/ui/"],
  },
]
