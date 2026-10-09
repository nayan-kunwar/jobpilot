import { Command, InvalidArgumentError } from 'commander';
import fs from 'node:fs/promises';
import type { CliOptions } from './constants.js';
import { DEFAULT_CONFIG_PATH, DEFAULT_LIST_FILE, LEGACY_LIST_FILE } from './constants.js';

export function parsePositiveInt(value: string, name: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new InvalidArgumentError(`${name} must be a positive integer (got "${value}")`);
  }
  return n;
}

const positiveIntParser = (name: string) => (value: string) => parsePositiveInt(value, name);

export function buildProgram(): Command {
  return (
    new Command()
      .name('gmail-bulk-sender')
      .description('Send personalized job-application emails with PDF resume via the Gmail API')
      .argument('[listFile]', 'address list file', DEFAULT_LIST_FILE)
      .option('--dry-run', 'list what would be sent without sending')
      .option('--limit <n>', 'cap this run to N addresses', positiveIntParser('--limit'))
      .option('--subject <text>', 'override email subject')
      .option('--from <text>', 'override From header')
      .option('--resume <path>', 'override resume PDF path')
      .option('--body-file <path>', 'override body from a text file')
      .option('--delay-ms <n>', 'override delay between emails', positiveIntParser('--delay-ms'))
      .option('--daily-limit <n>', 'override daily send cap', positiveIntParser('--daily-limit'))
      .option('--config <path>', 'config file path', DEFAULT_CONFIG_PATH)
  );
}

/** Parse argv (default: process.argv) into CliOptions. Falls back to legacy emails.txt. */
export async function parseArgs(argv: string[] = process.argv): Promise<CliOptions> {
  const program = buildProgram();
  program.parse(argv);
  const opts = program.opts<{
    dryRun?: boolean;
    limit?: number;
    subject?: string;
    from?: string;
    resume?: string;
    bodyFile?: string;
    delayMs?: number;
    dailyLimit?: number;
    config?: string;
  }>();
  let listFile: string = program.args[0] ?? DEFAULT_LIST_FILE;
  try {
    await fs.access(listFile);
  } catch {
    if (listFile === DEFAULT_LIST_FILE) {
      try {
        await fs.access(LEGACY_LIST_FILE);
        listFile = LEGACY_LIST_FILE;
      } catch {
        // keep default; sender reports a clean "cannot read" error
      }
    }
  }
  return {
    listFile,
    dryRun: opts.dryRun ?? false,
    limit: opts.limit ?? null,
    subject: opts.subject ?? null,
    from: opts.from ?? null,
    resume: opts.resume ?? null,
    bodyFile: opts.bodyFile ?? null,
    delayMs: opts.delayMs ?? null,
    dailyLimit: opts.dailyLimit ?? null,
    configPath: opts.config ?? DEFAULT_CONFIG_PATH,
  };
}

/** Extract + dedupe email addresses from free-form text. */
export function parseEmails(text: string): string[] {
  const seen = new Set<string>();
  return (text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || []).filter(
    (e) => !seen.has(e.toLowerCase()) && (seen.add(e.toLowerCase()), true),
  );
}
