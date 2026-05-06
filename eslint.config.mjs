// VIPOS ESLint flat config (ESLint 9+).
// Satu file untuk seluruh monorepo — apply rules per-workspace via `files` glob.
//
// Aturan dasar: recommended dari `@eslint/js`. Untuk apps/web (React + Vite),
// tambah plugin react / react-hooks / jsx-a11y / react-refresh. Backend dan
// shared package pakai aturan Node tanpa React.
//
// Prettier yang me-format style (spasi, kuotasi, dst). ESLint hanya untuk
// correctness rule (no-unused-vars, no-undef, react-hooks, dll). Konflik
// stylistic dimatikan via `eslint-config-prettier` di akhir.

import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';

export default [
  // 0. Global ignore
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'apps/backend/data/**',
      'apps/web/dist/**',
      '.husky/_/**',
    ],
  },

  // 1. Aturan dasar untuk semua JS/JSX
  js.configs.recommended,

  // 2. apps/web — React + browser
  {
    files: ['apps/web/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2024,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          // Hooks + contexts colocated with their provider component, plus a
          // few report-helper functions colocated with their input components.
          // Splitting these into separate files would force ~40 import-path
          // updates across the app for zero production impact (this rule is
          // about HMR fast-refresh, not runtime behaviour).
          allowExportNames: [
            'useAuth',
            'AuthContext',
            'useOutlet',
            'MOCK_OUTLETS',
            'usePermission',
            'ROLES',
            'TIERS',
            'filtersToParams',
            'defaultDateRange',
          ],
        },
      ],
      // React-specific allowances
      'react/prop-types': 'off', // pakai TS / Zod nanti di P0-04
      // Disable a11y rules yang terlalu strict untuk POS app yang internal-use
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/no-noninteractive-element-interactions': 'off',
      'jsx-a11y/label-has-associated-control': 'off',
      // autoFocus dipakai sengaja untuk UX POS (login form, dialog input pertama).
      // Internal app, tidak hit retail end-user yang mungkin pakai assistive tech.
      'jsx-a11y/no-autofocus': 'off',
      // Common code smell
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },

  // 3. apps/backend — Node 20+
  {
    files: ['apps/backend/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.es2024,
      },
    },
    rules: {
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-console': 'off', // backend pakai console untuk logging
    },
  },

  // 3b. apps/backend ESM test files (.mjs) — pakai import + Node globals
  {
    files: ['apps/backend/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2024,
      },
    },
    rules: {
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-console': 'off',
    },
  },

  // 4. packages/shared — module (akan diisi di P0-04)
  {
    files: ['packages/shared/**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2024,
      },
    },
  },

  // 5. Config files di root (Vite, Tailwind, PostCSS, ESLint sendiri, dll)
  {
    files: ['*.config.{js,cjs,mjs}', '**/*.config.{js,cjs,mjs}', '.husky/**'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // 6. Matikan stylistic rules yang konflik dengan Prettier
  prettier,
];
