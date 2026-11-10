import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    "dist/**",
    ".vinext/**",
    ".wrangler/**",
    ".sites-runtime/**",
    "outputs/**",
    "work/**",
  ]),
  {
    files: ["app/**/*.{ts,tsx}", "components/dashboard/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/sample-adapter",
                "**/sample-adapter.*",
                "**/sample-tuning",
                "**/sample-tuning.*",
              ],
              message:
                "Read data through lib/data/index.ts; sample implementations belong behind the adapter boundary.",
            },
          ],
          paths: [
            {
              name: "@/lib/data",
              importNames: ["createSampleAdapter"],
              message:
                "Use dataAdapter; selecting a source belongs in lib/data/index.ts.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["lib/data/**/*.{ts,tsx}", "lib/algorithms/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react",
                "react/**",
                "react-dom",
                "react-dom/**",
                "**/components/**",
                "**/app/**",
              ],
              message:
                "Keep data and algorithm logic independent of rendering; shared UI belongs in components/dashboard.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
