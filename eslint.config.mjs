import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const typescriptNoUnusedVarsRule = [
  "error",
  {
    argsIgnorePattern: "^_",
    varsIgnorePattern: "^_",
    caughtErrorsIgnorePattern: "^_",
  },
];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "test-results/**",
      ".pm2/**",
      "server/uploads/**",
      "client-legacy/**",
      "client-legacy/**/*",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      curly: ["error", "all"],
      eqeqeq: ["error", "always"],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
    },
  },
  {
    files: ["client/src/**/*.{ts,tsx}", "client/vite.config.ts"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: ["./client/tsconfig.json"],
      },
    },
    rules: {
      "no-undef": "off",
      "no-console": ["error", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-unused-vars": typescriptNoUnusedVarsRule,
    },
  },
  {
    files: [
      "server/src/**/*.ts",
      "server/src/**/*.tsx",
      "client/tests/**/*.{ts,tsx}",
      "playwright.config.ts",
      "playwright.fullstack.config.ts",
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: ["./server/tsconfig.json", "./tsconfig.base.json"],
      },
    },
    rules: {
      "no-undef": "off",
      "no-console": ["error", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-unused-vars": typescriptNoUnusedVarsRule,
    },
  },
  {
    files: ["server/src/scripts/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      "no-undef": "off",
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": typescriptNoUnusedVarsRule,
    },
  }
);
