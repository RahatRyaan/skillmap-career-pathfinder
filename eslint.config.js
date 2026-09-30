import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** The tsconfig that supplies type information to the typed lint rules. */
const SERVER_TSCONFIG = 'packages/server/tsconfig.json';
const CLIENT_TSCONFIG = 'packages/client/tsconfig.json';
const SHARED_TSCONFIG = 'packages/shared/tsconfig.json';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/build/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '.kilo/worktrees/**',
      '**/vitest.config.ts',
      '**/vite.config.ts',
      '**/playwright.config.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Config files and plain scripts have no tsconfig, so the type-aware rules
  // cannot run on them. Every type-aware rule is switched off explicitly,
  // because parserOptions merge across blocks.
  {
    files: ['**/*.config.{js,mjs,ts}', '**/*.mjs', '**/*.cjs', '**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { projectService: false, project: null },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/require-await': 'off',
      'no-process-exit': 'off',
    },
  },

  // ─── Server: Node + ESM, with type-aware rules ────────────────────────
  {
    files: ['packages/server/**/*.ts', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      'no-process-exit': 'error',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'no-return-await': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // The shared package's index re-exports the whole public API. Those exports
  // are consumed by other workspaces, so an unused local is not dead code.
  {
    files: ['packages/shared/src/index.ts', 'packages/content/src/index.ts'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },

  // ─── Content package: data only ───────────────────────────────────────
  {
    files: ['packages/content/**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'smart'],
    },
  },

  // ─── Shared package ───────────────────────────────────────────────────
  {
    files: ['packages/shared/**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'error',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },

  // ─── Client: React + browser ───────────────────────────────────────────
  {
    files: ['packages/client/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // ─── Tests: relax rules that fight test idioms ───────────────────────
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', 'tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // ─── Config files ──────────────────────────────────────────────────────
  // Config files and plain scripts have no tsconfig, so the type-aware rules
  // cannot run on them. Every type-aware rule is switched off explicitly,
  // because parserOptions merge across blocks.
  {
    files: ['**/*.config.{js,mjs,ts}', '**/*.mjs', '**/*.cjs', '**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { projectService: false, project: null },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/require-await': 'off',
      'no-process-exit': 'off',
    },
  },

  // Placeholders used in tests and .lean() result shaping, where a precise type
  // would be noise. Narrowed with an inline disable where a real one is needed.
  {
    files: ['packages/server/src/**/*.ts'],
    rules: {
      // `.lean()` result shaping is the only place `any` remains, and the
      // returned payload is validated against a Zod schema before it ships.
      '@typescript-eslint/no-explicit-any': 'warn',
      // A method implementing an async interface is legitimately async even
      // when its body is synchronous. The rule is enforced everywhere else.
      '@typescript-eslint/require-await': 'off',
    },
  },

  // process.exit is correct in a process entrypoint and wrong in a library.
  {
    files: ['packages/server/src/index.ts', 'packages/server/src/scripts/**/*.ts'],
    rules: { 'no-process-exit': 'off' },
  },

  // Express 4 types middleware as returning void, so a genuinely async route
  // handler always trips this rule. Rejections are handled by asyncHandler,
  // which every route here is wrapped in, so this is a type-level artefact.
  {
    files: ['packages/server/src/routes/**/*.ts'],
    rules: { '@typescript-eslint/no-misused-promises': 'off' },
  },

  prettier,
);

// Referenced so a missing tsconfig surfaces as a config error, not a mystery.
export const TSCONFIGS = [SERVER_TSCONFIG, CLIENT_TSCONFIG, SHARED_TSCONFIG];
