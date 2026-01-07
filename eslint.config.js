import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser, // For TextEncoder/Decoder
        Bun: 'readonly',
        Deno: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        globalThis: 'readonly'
      }
    },
    rules: {
      'curly': ['error', 'all'],
      'no-unused-vars': ['error', { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }],
      'max-params': ['error', 7], // GitCommit needs 6
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off',
      'no-undef': 'error'
    }
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.jest, // vitest uses similar globals
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly'
      }
    }
  }
];
