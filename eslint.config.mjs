import baseConfig from '@repo/eslint-config/base';

/**
 * Корневой flat-конфиг: покрывает каталог `scripts/`, который не входит
 * ни в один workspace-пакет и потому не попадает в `turbo run lint`.
 */
/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
];
