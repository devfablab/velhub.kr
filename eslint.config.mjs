import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import perfectionist from "eslint-plugin-perfectionist";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".vercel/**",
    "out/**",
    "build/**",
    "dist/**",
    "next-env.d.ts",
  ]),
  {
    plugins: {
      perfectionist,
    },
    rules: {
      "perfectionist/sort-imports": [
        "error",
        {
          type: "natural",
          order: "asc",
          newlinesBetween: 0,
          sortSideEffects: true,
          groups: [
            "react",
            "next",
            "external",
            "lib",
            "components",
            "parent",
            "sibling",
            "index",
            "app",
            "style",
            "side-effect-style",
          ],
          customGroups: [
            { groupName: "style", elementNamePattern: "\\.(?:css|scss|sass)$" },
            { groupName: "react", elementNamePattern: "^react(?:/.*)?$" },
            { groupName: "next", elementNamePattern: "^next(?:/.*)?$" },
            { groupName: "lib", elementNamePattern: "^@/lib(?:/.*)?$" },
            { groupName: "components", elementNamePattern: "^@/components(?:/.*)?$" },
            { groupName: "app", elementNamePattern: "^@/app(?:/.*)?$" },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
