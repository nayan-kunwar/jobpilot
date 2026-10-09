import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Monorepo: trace from the workspace root to silence Next's multi-lockfile warning
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
};

export default nextConfig;
