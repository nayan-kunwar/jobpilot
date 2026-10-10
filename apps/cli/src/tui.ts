import * as p from '@clack/prompts';
import fs from 'node:fs/promises';
import { parseEmails } from './args.js';

/** Minimal prompter surface so tests can inject fakes (no TTY needed). */
export interface ConfirmPrompter {
  intro(title?: string): void;
  note(message: string, title?: string): void;
  outro(message?: string): void;
  askConfirm(message: string): Promise<boolean>;
}

export const clackPrompter: ConfirmPrompter = {
  intro: (title = 'gmail-bulk-sender') => p.intro(title),
  note: (message, title) => p.note(message, title),
  outro: (message = '') => p.outro(message),
  askConfirm: async (message: string) => {
    const answer = await p.confirm({ message });
    return answer === true; // Ctrl+C cancel counts as decline
  },
};

/** Prompt only for live sends with a human present. Everything else skips. */
export function shouldPrompt(
  opts: { dryRun: boolean; yes: boolean },
  stdinIsTTY: boolean | undefined,
): boolean {
  return !opts.dryRun && !opts.yes && stdinIsTTY === true;
}

export interface RecipientPreview {
  emails: string[];
  total: number;
}

/** Read + parse the list for the confirm screen. null = unreadable; sender.ts reports the real error. */
export async function previewRecipients(listFile: string): Promise<RecipientPreview | null> {
  try {
    const emails = parseEmails(await fs.readFile(listFile, 'utf8'));
    return { emails, total: emails.length };
  } catch {
    return null;
  }
}

/**
 * Pre-send confirmation. Returns true to proceed.
 * Pure apart from the injected prompter; sender.ts still owns the actual send.
 */
export async function confirmSend(
  listFile: string,
  subjectLabel: string,
  prompter: ConfirmPrompter = clackPrompter,
  previewN = 5,
): Promise<boolean> {
  const preview = await previewRecipients(listFile);
  prompter.intro('gmail-bulk-sender');
  if (!preview || preview.total === 0) {
    // Empty/unreadable list: don't block — sender.ts prints the authoritative error.
    prompter.note('List preview unavailable — continuing to detailed checks.', 'Preview');
    prompter.outro();
    return true;
  }
  const lines = preview.emails.slice(0, previewN).map((e, i) => `${i + 1}. ${e}`);
  if (preview.total > previewN) lines.push(`…and ${preview.total - previewN} more`);
  prompter.note(
    [...lines, '', `Subject: ${subjectLabel}`, `List: ${listFile}`].join('\n'),
    `About to send to ${preview.total}`,
  );
  const ok = await prompter.askConfirm(`Send to ${preview.total} address(es)?`);
  prompter.outro(ok ? 'Sending…' : 'Aborted — nothing sent.');
  return ok;
}
