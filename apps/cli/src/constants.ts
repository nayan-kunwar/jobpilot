import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_DELAY_MS, DEFAULT_DAILY_LIMIT, DEFAULT_FROM, DEFAULT_SUBJECT } from '@packages/email-core';

/** Absolute path of apps/cli/ no matter where the process is launched from. */
export const APP_ROOT = fileURLToPath(new URL('..', import.meta.url));

export interface AppConfig {
  from: string;
  subject: string;
  resume: string;
  delayMs: number;
  dailyLimit: number;
}

export interface CliOptions {
  listFile: string;
  dryRun: boolean;
  yes: boolean;
  interactive: boolean;
  quiet: boolean;
  json: boolean;
  limit: number | null;
  subject: string | null;
  from: string | null;
  resume: string | null;
  bodyFile: string | null;
  delayMs: number | null;
  dailyLimit: number | null;
  configPath: string;
}

export const DEFAULTS: AppConfig = {
  from: DEFAULT_FROM,
  subject: DEFAULT_SUBJECT,
  resume: path.join(APP_ROOT, 'assets', 'resume.pdf'),
  delayMs: DEFAULT_DELAY_MS,
  dailyLimit: DEFAULT_DAILY_LIMIT,
};

export const DEFAULT_LIST_FILE = path.join(APP_ROOT, 'data', 'emails.txt');
export const LEGACY_LIST_FILE = path.join(APP_ROOT, 'emails.txt');
export const DEFAULT_CONFIG_PATH = path.join(APP_ROOT, 'config.json');

// Canonical log location. Legacy root file is still counted for continuity.
export const LOG_PATH = path.join(APP_ROOT, 'logs', 'sent_log.csv');
export const LEGACY_LOG_PATH = path.join(APP_ROOT, 'sent_log.csv');
