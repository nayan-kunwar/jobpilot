import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Subpaths first: Vite aliases match by prefix, so the bare specifier must come last.
    alias: [
      {
        find: '@packages/email-core/body',
        replacement: path.resolve(import.meta.dirname, '../../packages/email-core/src/body.ts'),
      },
      {
        find: '@packages/email-core/emails',
        replacement: path.resolve(import.meta.dirname, '../../packages/email-core/src/emails.ts'),
      },
      {
        find: '@packages/email-core/defaults',
        replacement: path.resolve(import.meta.dirname, '../../packages/email-core/src/defaults.ts'),
      },
      {
        find: '@packages/email-core',
        replacement: path.resolve(import.meta.dirname, '../../packages/email-core/src/index.ts'),
      },
    ],
  },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['./test/setup.ts'],
  },
});
