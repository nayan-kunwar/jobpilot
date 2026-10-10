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

/**
 * Windows Nx launches scripts via child_process.exec and never forwards stdin.
 * Clack only hears Enter after setRawMode, which it skips when stdin is not a TTY,
 * so the Yes/No box paints and then ignores the keyboard. Fail closed instead.
 */
export const NO_KEYBOARD =
  'Cannot read Yes/No: this process has no terminal keyboard, so Enter never arrives.\n' +
  'On Windows, `nx run` starts the CLI with child_process.exec and does not forward stdin.\n' +
  'From the repo root use `npm run send` (or `npm run live`). Nothing was sent.';

/** Clack confirm when stdin is a real TTY; otherwise decline without waiting. */
export async function readConfirm(
  message: string,
  stdinIsTTY: boolean | undefined,
  ask: (message: string) => Promise<unknown> = (m) => p.confirm({ message: m }),
): Promise<boolean> {
  if (stdinIsTTY !== true) {
    console.error(NO_KEYBOARD);
    return false;
  }
  const answer = await ask(message);
  return answer === true; // Ctrl+C cancel counts as decline
}

export const clackPrompter: ConfirmPrompter = {
  intro: (title = 'gmail-bulk-sender') => p.intro(title),
  note: (message, title) => p.note(message, title),
  outro: (message = '') => p.outro(message),
  askConfirm: (message) => readConfirm(message, process.stdin.isTTY),
};

/** Prompt only for live sends. --yes / --dry-run / non-TTY skip, unless --interactive forces it. */
export function shouldPrompt(
  opts: { dryRun: boolean; yes: boolean; interactive: boolean },
  stdinIsTTY: boolean | undefined,
): boolean {
  if (opts.dryRun || opts.yes) return false;
  return stdinIsTTY === true || opts.interactive;
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
