/**
 * ESLint flat config for SillyTavern Atlas.
 *
 * Uses the TypeScript ESLint parser and recommended rules, tuned for
 * strict TypeScript with no `any`. Prettier owns formatting, so the
 * stylistic rules are disabled via eslint-config-prettier.
 */
const tseslint = require('typescript-eslint');
const prettierConfig = require('eslint-config-prettier');

module.exports = tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', '*.json'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        SillyTavern: 'readonly',
        jQuery: 'readonly',
        toastr: 'readonly',
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': 'off',
      'no-undef': 'off',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['webpack.config.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      // These are CommonJS config files; require() is the intended loader.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  prettierConfig,
);
