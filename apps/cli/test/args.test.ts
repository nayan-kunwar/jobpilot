import { describe, expect, it } from 'vitest';
import { buildProgram, parseArgs, parseEmails } from '../src/args.js';

describe('parseEmails', () => {
  it('extracts and dedupes (case-insensitive)', () => {
    expect(parseEmails('A@x.com, a@X.com; Jane <jane@co.com>\nnope')).toEqual(['A@x.com', 'jane@co.com']);
  });

  it('returns [] for no addresses', () => {
    expect(parseEmails('hello world')).toEqual([]);
  });
});

describe('parseArgs', () => {
  it('parses list + flags (space and = forms)', async () => {
    const o = await parseArgs(['node', 'send', 'data/emails.txt', '--dry-run', '--limit', '5', '--subject=Hi']);
    expect(o.listFile).toBe('data/emails.txt');
    expect(o.dryRun).toBe(true);
    expect(o.limit).toBe(5);
    expect(o.subject).toBe('Hi');
  });

  it('defaults listFile and configPath', async () => {
    const o = await parseArgs(['node', 'send', '--dry-run']);
    expect(o.listFile).toMatch(/emails\.txt$/);
    expect(o.configPath).toMatch(/config\.json$/);
    expect(o.dryRun).toBe(true);
  });
});

describe('buildProgram', () => {
  it('exposes --help without exiting', () => {
    const program = buildProgram();
    expect(program.description()).toMatch(/Gmail API/);
  });
});
