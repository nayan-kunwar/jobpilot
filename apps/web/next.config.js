import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Monorepo: trace from the workspace root to silence Next's multi-lockfile warning
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  // Workspace package consumed as TypeScript source (tsconfig paths alias)
  transpilePackages: ['@packages/email-core'],
  // ESLint runs via `nx run @apps/web:lint` (root flat config); Next's own lint
  // pass has no Next plugin configured and would only duplicate that.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
