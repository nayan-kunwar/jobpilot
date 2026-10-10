import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  from: 'Your Name <you@gmail.com>',
  subject: 'Job Application',
  resume: path.join(APP_ROOT, 'assets', 'resume.pdf'),
  delayMs: 5000, // pause between emails so Gmail doesn't flag you
  dailyLimit: 450, // Gmail ~500/day for normal accounts; stay under it
};

export const DEFAULT_LIST_FILE = path.join(APP_ROOT, 'data', 'emails.txt');
export const LEGACY_LIST_FILE = path.join(APP_ROOT, 'emails.txt');
export const DEFAULT_CONFIG_PATH = path.join(APP_ROOT, 'config.json');

// Canonical log location. Legacy root file is still counted for continuity.
export const LOG_PATH = path.join(APP_ROOT, 'logs', 'sent_log.csv');
export const LEGACY_LOG_PATH = path.join(APP_ROOT, 'sent_log.csv');
export const LOG_HEADER = 'timestamp,to,status,detail';
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // Gmail attachment limit
export const RETRY_DELAYS = [2000, 8000, 30000];

export const DEFAULT_BODY = `Dear Hiring Team,

I am writing to apply for the Backend Developer position at your organization.

I have over 2+ years of hands-on experience building secure and scalable backend systems using Node.js, TypeScript, PostgreSQL/MongoDB, Redis, Kafka, and Docker. I also have experience working with event-driven architecture (EDA) and designing asynchronous, scalable backend services.

I've attached my resume for your review. I would appreciate the opportunity to discuss the Backend Developer role.

Thank you for your time and consideration. I look forward to hearing from you.

Best regards,

Your Name
+91-XXXXXXXXXX
LinkedIn: https://www.linkedin.com/in/your-handle/
GitHub: https://github.com/your-handle`;
