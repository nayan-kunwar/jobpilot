'use server';

import fs from 'node:fs/promises';
import path from 'node:path';
import { assetsDir, bodyPath, configPath, listPath } from '../lib/cli-paths';
import type { SaveInput, SaveResult } from '../lib/types';

/**
 * Persist the compose form to the same files the CLI uses:
 * config.json (from/subject/resume merged in), data/body.txt, data/emails.txt.
 */
export async function saveCompose(input: SaveInput): Promise<SaveResult> {
  try {
    const subject = input.subject.trim();
    const from = input.from.trim();
    if (!subject) return { ok: false, error: 'Subject cannot be empty.' };
    if (!from) return { ok: false, error: 'From cannot be empty.' };

    const resume = path.basename(input.resume.trim());
    if (!resume.toLowerCase().endsWith('.pdf')) {
      return { ok: false, error: 'Pick a resume PDF from apps/cli/assets/.' };
    }
    const resumes = await fs.readdir(assetsDir());
    if (!resumes.includes(resume)) {
      return { ok: false, error: `Resume "${resume}" was not found in apps/cli/assets/.` };
    }

    // Merge with the existing config so delayMs/dailyLimit (and anything else) survive.
    let existing: Record<string, unknown> = {};
    try {
      existing = JSON.parse(await fs.readFile(configPath(), 'utf8')) as Record<string, unknown>;
    } catch {
      // no config yet: start from the example keys
    }
    const next = { ...existing, from, subject, resume: `./assets/${resume}` };
    await fs.writeFile(configPath(), JSON.stringify(next, null, 2) + '\n');

    await fs.mkdir(path.dirname(bodyPath()), { recursive: true });
    await fs.writeFile(bodyPath(), input.body.trim() + '\n');
    await fs.writeFile(listPath(), input.recipients.trim() + '\n');

    return { ok: true, savedAt: new Date().toISOString() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
