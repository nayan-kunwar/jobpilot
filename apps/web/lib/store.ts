import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_BODY,
  DEFAULT_DELAY_MS,
  DEFAULT_DAILY_LIMIT,
  DEFAULT_FROM,
  DEFAULT_RESUME_REL,
  DEFAULT_SUBJECT,
  countSentToday,
  parseEmails,
} from '@packages/email-core';
import {
  assetsDir,
  bodyPath,
  cliRoot,
  configPath,
  legacyListPath,
  legacyLogPath,
  listPath,
  logPath,
  tokenPath,
} from './cli-paths';
import type { CliConfig, LogRow, ResumeFile, Status } from './types';

export const DEFAULT_CONFIG: CliConfig = {
  from: DEFAULT_FROM,
  subject: DEFAULT_SUBJECT,
  resume: DEFAULT_RESUME_REL,
  delayMs: DEFAULT_DELAY_MS,
  dailyLimit: DEFAULT_DAILY_LIMIT,
};

/** Resolve p against baseDir unless already absolute (same rule as the CLI). */
export function resolveFrom(baseDir: string, p: string): string {
  return path.isAbsolute(p) ? p : path.join(baseDir, p);
}

export async function readConfig(): Promise<CliConfig> {
  try {
    const raw = await fs.readFile(configPath(), 'utf8');
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<CliConfig>) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function readBody(): Promise<string> {
  try {
    const raw = (await fs.readFile(bodyPath(), 'utf8')).trim();
    return raw || DEFAULT_BODY;
  } catch {
    return DEFAULT_BODY;
  }
}

export async function readListText(): Promise<string> {
  try {
    return await fs.readFile(listPath(), 'utf8');
  } catch {
    try {
      return await fs.readFile(legacyListPath(), 'utf8');
    } catch {
      return '';
    }
  }
}

export async function listResumes(): Promise<ResumeFile[]> {
  try {
    const names = (await fs.readdir(assetsDir())).filter((n) => n.toLowerCase().endsWith('.pdf'));
    const files: ResumeFile[] = [];
    for (const name of names) {
      const stat = await fs.stat(path.join(assetsDir(), name));
      files.push({ name, size: stat.size });
    }
    return files.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/** Minimal CSV field splitter (the log's detail column is csvEscape'd). */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

/** Recent log rows, newest first. */
export async function readLog(limit = 50): Promise<LogRow[]> {
  try {
    const content = await fs.readFile(logPath(), 'utf8');
    const rows: LogRow[] = [];
    for (const line of content.split('\n').slice(1)) {
      if (!line.trim()) continue;
      const [timestamp, to, status, detail] = parseCsvLine(line);
      if (timestamp) rows.push({ timestamp, to, status, detail: detail ?? '' });
    }
    return rows.slice(-limit).reverse();
  } catch {
    return [];
  }
}

async function tokenStatus(): Promise<{ exists: boolean; expiry: number | null }> {
  try {
    const parsed = JSON.parse(await fs.readFile(tokenPath(), 'utf8')) as { expiry_date?: number };
    return { exists: true, expiry: parsed.expiry_date ?? null };
  } catch {
    return { exists: false, expiry: null };
  }
}

export async function getStatus(): Promise<Status> {
  const [config, listText, sentToday, token] = await Promise.all([
    readConfig(),
    readListText(),
    countSentToday(logPath(), legacyLogPath()),
    tokenStatus(),
  ]);
  const parsed = parseEmails(listText);
  const rawCount = (listText.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || []).length; // for the duplicates counter

  const resumeAbs = resolveFrom(cliRoot(), config.resume);
  let resumeSize: number | null = null;
  let resumeExists = false;
  try {
    const stat = await fs.stat(resumeAbs);
    resumeSize = stat.size;
    resumeExists = true;
  } catch {
    // missing resume: surfaced in the UI
  }

  return {
    sentToday,
    dailyLimit: config.dailyLimit,
    remaining: Math.max(config.dailyLimit - sentToday, 0),
    recipients: parsed.length,
    dupesRemoved: Math.max(rawCount - parsed.length, 0),
    subject: config.subject,
    from: config.from,
    resumeName: path.basename(resumeAbs),
    resumeSize,
    resumeExists,
    tokenExists: token.exists,
    tokenExpiry: token.expiry,
  };
}
