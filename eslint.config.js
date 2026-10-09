// Flat config for ESLint v9+ with TypeScript. Run: npm run lint
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/', '**/dist/', '**/coverage/', '**/.next/', '**/.nx/', '**/next-env.d.ts'] },
  {
    files: ['**/*.js', '**/*.ts', '**/*.tsx'],
    extends: [...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
);
