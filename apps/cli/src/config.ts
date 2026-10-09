import fs from 'node:fs/promises';
import type { AppConfig } from './constants.js';
import { DEFAULTS } from './constants.js';

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function errCode(err: unknown): string | undefined {
  return err instanceof Error && 'code' in err ? String((err as NodeJS.ErrnoException).code) : undefined;
}

export async function loadConfig(configPath: string): Promise<AppConfig> {
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppConfig>) };
  } catch (err) {
    if (errCode(err) === 'ENOENT') return { ...DEFAULTS }; // no config file -> defaults
    console.error(`Failed to load config "${configPath}": ${errMessage(err)}`);
    process.exit(1);
  }
}
