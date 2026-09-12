import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktrees are separate git checkouts living under this repo's
    // disk path; they must never be linted (or committed) from the main tree.
    ".claude/**",
  ]),
  {
    rules: {
      // Allow intentionally-discarded destructured values/args prefixed
      // with `_` (e.g. `const { valor_total: _ignorado, ...rest } = data`)
      // instead of scattering eslint-disable comments.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
