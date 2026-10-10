import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  confirmSend,
  NO_KEYBOARD,
  previewRecipients,
  readConfirm,
  shouldPrompt,
  type ConfirmPrompter,
} from '../src/tui.js';

function fakePrompter(answer: boolean): ConfirmPrompter & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    intro: () => void calls.push('intro'),
    note: () => void calls.push('note'),
    outro: () => void calls.push('outro'),
    askConfirm: async () => {
      calls.push('askConfirm');
      return answer;
    },
  };
}

let tmpDirs: string[] = [];
afterEach(async () => {
  await Promise.all(tmpDirs.map((d) => fs.rm(d, { recursive: true, force: true })));
  tmpDirs = [];
});

async function makeList(content: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tui-test-'));
  tmpDirs.push(dir);
  const file = path.join(dir, 'emails.txt');
  await fs.writeFile(file, content);
  return file;
}

describe('shouldPrompt', () => {
  it('prompts only for live TTY sends without --yes', () => {
    expect(shouldPrompt({ dryRun: false, yes: false, interactive: false }, true)).toBe(true);
    expect(shouldPrompt({ dryRun: true, yes: false, interactive: false }, true)).toBe(false);
    expect(shouldPrompt({ dryRun: false, yes: true, interactive: false }, true)).toBe(false);
    expect(shouldPrompt({ dryRun: false, yes: false, interactive: false }, false)).toBe(false);
    expect(shouldPrompt({ dryRun: false, yes: false, interactive: false }, undefined)).toBe(false);
  });

  it('--interactive forces the prompt even when TTY is not detected (Nx-safe)', () => {
    expect(shouldPrompt({ dryRun: false, yes: false, interactive: true }, false)).toBe(true);
    expect(shouldPrompt({ dryRun: false, yes: false, interactive: true }, undefined)).toBe(true);
  });

  it('--yes still wins over --interactive, dry-run never prompts', () => {
    expect(shouldPrompt({ dryRun: false, yes: true, interactive: true }, true)).toBe(false);
    expect(shouldPrompt({ dryRun: true, yes: false, interactive: true }, true)).toBe(false);
  });
});

describe('readConfirm', () => {
  it('declines immediately when stdin is not a TTY and does not ask', async () => {
    const ask = vi.fn(async () => true);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(readConfirm('Send?', false, ask)).resolves.toBe(false);
    await expect(readConfirm('Send?', undefined, ask)).resolves.toBe(false);
    expect(ask).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(NO_KEYBOARD);
    spy.mockRestore();
  });

  it('uses the answer only when stdin is a TTY', async () => {
    await expect(readConfirm('Send?', true, async () => true)).resolves.toBe(true);
    await expect(readConfirm('Send?', true, async () => false)).resolves.toBe(false);
    await expect(readConfirm('Send?', true, async () => Symbol('cancel'))).resolves.toBe(false);
  });
});

describe('previewRecipients', () => {
  it('parses addresses with count', async () => {
    const file = await makeList('a@x.com, B@y.com\nb@Y.COM');
    await expect(previewRecipients(file)).resolves.toEqual({ emails: ['a@x.com', 'B@y.com'], total: 2 });
  });

  it('returns null for unreadable files (sender.ts owns that error)', async () => {
    await expect(previewRecipients(path.join(os.tmpdir(), 'does-not-exist-xyz.txt'))).resolves.toBeNull();
  });
});

describe('confirmSend', () => {
  it('returns true and previews first-N on accept', async () => {
    const file = await makeList('a@x.com\nb@x.com');
    const prompter = fakePrompter(true);
    await expect(confirmSend(file, 'Hi', prompter, 5)).resolves.toBe(true);
    expect(prompter.calls).toEqual(['intro', 'note', 'askConfirm', 'outro']);
  });

  it('returns false on decline without touching anything else', async () => {
    const file = await makeList('a@x.com');
    const prompter = fakePrompter(false);
    await expect(confirmSend(file, 'Hi', prompter)).resolves.toBe(false);
  });

  it('proceeds (true) when the list is unreadable so sender.ts can report it', async () => {
    const prompter = fakePrompter(false); // even a "decliner" is never asked
    await expect(confirmSend(path.join(os.tmpdir(), 'does-not-exist-xyz.txt'), 'Hi', prompter)).resolves.toBe(
      true,
    );
    expect(prompter.calls).not.toContain('askConfirm');
  });
});
