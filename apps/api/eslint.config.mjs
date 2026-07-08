import nestjsConfig from '@repo/eslint-config/nestjs';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...nestjsConfig,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
);
