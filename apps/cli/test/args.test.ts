import { describe, expect, it } from 'vitest';
import { buildProgram, excessArgumentsHint, parseArgs, parseEmails } from '../src/args.js';

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
    const o = await parseArgs([
      'node',
      'send',
      'data/emails.txt',
      '--dry-run',
      '--limit',
      '5',
      '--subject=Hi',
    ]);
    expect(o.listFile).toBe('data/emails.txt');
    expect(o.dryRun).toBe(true);
    expect(o.limit).toBe(5);
    expect(o.subject).toBe('Hi');
    expect(o.yes).toBe(false);
  });

  it('parses --yes', async () => {
    const o = await parseArgs(['node', 'send', '--yes']);
    expect(o.yes).toBe(true);
    expect(o.interactive).toBe(false);
  });

  it('parses --interactive', async () => {
    const o = await parseArgs(['node', 'send', '--interactive']);
    expect(o.interactive).toBe(true);
    expect(o.yes).toBe(false);
  });

  it('maps --non-interactive to yes and parses --quiet/--json', async () => {
    const o = await parseArgs(['node', 'send', '--non-interactive', '--quiet', '--json']);
    expect(o.yes).toBe(true);
    expect(o.quiet).toBe(true);
    expect(o.json).toBe(true);
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

describe('excessArgumentsHint', () => {
  it('returns null when there are no extras', () => {
    expect(excessArgumentsHint([])).toBeNull();
  });

  it('suggests quotes and the apps/cli cwd rule', () => {
    const hint = excessArgumentsHint(['Your', 'new', 'subject']);
    expect(hint).toMatch(/forget quotes/);
    expect(hint).toMatch(/--subject "Job Application"/);
    expect(hint).toMatch(/apps\/cli\//);
  });
});
