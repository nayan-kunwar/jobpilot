import path from 'node:path';

/**
 * Root of the CLI app whose files this dashboard reads and writes.
 * Nx (and npm -w) run scripts with cwd = apps/web, so '../cli' resolves inside
 * the repo. Override with CLI_DATA_DIR (absolute path) when running elsewhere.
 */
export function cliRoot(): string {
  return process.env.CLI_DATA_DIR ?? path.resolve(process.cwd(), '..', 'cli');
}

export function configPath(): string {
  return path.join(cliRoot(), 'config.json');
}

export function bodyPath(): string {
  return path.join(cliRoot(), 'data', 'body.txt');
}

export function listPath(): string {
  return path.join(cliRoot(), 'data', 'emails.txt');
}

export function legacyListPath(): string {
  return path.join(cliRoot(), 'emails.txt');
}

export function logPath(): string {
  return path.join(cliRoot(), 'logs', 'sent_log.csv');
}

export function legacyLogPath(): string {
  return path.join(cliRoot(), 'sent_log.csv');
}

export function tokenPath(): string {
  return path.join(cliRoot(), 'token.json');
}

export function assetsDir(): string {
  return path.join(cliRoot(), 'assets');
}
