---
name: apps-cli-typescript
description: >-
  TypeScript compiler options, ESLint, and naming conventions for the Apps CLI
  plugin. Use when editing packages/contentstack-apps-cli sources or fixing lint.
---

# TypeScript style – Apps CLI plugin

## When to use

- Changing `packages/contentstack-apps-cli/tsconfig.json` or understanding strictness
- Fixing ESLint issues in `src/` (tests are not linted by default)
- Naming new files, classes, or exports

## Instructions

### Compiler

- Config: **`packages/contentstack-apps-cli/tsconfig.json`** — `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `composite: true`, `rootDir` `src/`, `outDir` `lib/`, `target` ES2017, `module` commonjs.
- Prefer explicit return types on exported and public functions where it helps clarity.
- Avoid `any`; use narrow types, generics, or `unknown` with guards.

### ESLint

- Entry: **`packages/contentstack-apps-cli/.eslintrc`** — `@typescript-eslint/parser` with `project: "tsconfig.json"`, extends `@typescript-eslint/recommended`.
- **Ignored paths:** `lib/**/*`, `test/**/*` — lint focuses on production `src/` TypeScript.
- Notable rules: `eqeqeq` smart, `no-var`, `prefer-const`, `@typescript-eslint/no-unused-vars` (args: none).

### Naming and layout

- **Files:** kebab-case (e.g. `app-cli-base-command.ts`)
- **Classes:** PascalCase
- **Functions and methods:** camelCase
- **Constants:** `SCREAMING_SNAKE_CASE` for truly immutable module-level constants

Oclif command bases and flags: [apps-cli-framework](../apps-cli-framework/SKILL.md).
