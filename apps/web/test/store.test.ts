import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getStatus, listResumes, readConfig, readListText, readLog, readBody } from '../lib/store';

let dir: string;

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'web-store-'));
  process.env.CLI_DATA_DIR = dir;
  const today = new Date().toISOString().slice(0, 10);
  await fs.mkdir(path.join(dir, 'data'), { recursive: true });
  await fs.mkdir(path.join(dir, 'assets'), { recursive: true });
  await fs.mkdir(path.join(dir, 'logs'), { recursive: true });
  await fs.writeFile(
    path.join(dir, 'config.json'),
    JSON.stringify({
      from: 'Me <me@x.com>',
      subject: 'Hi',
      resume: './assets/Resume_Test.pdf',
      delayMs: 1000,
      dailyLimit: 10,
    }),
  );
  await fs.writeFile(path.join(dir, 'data', 'body.txt'), 'Hello **world**\n');
  await fs.writeFile(path.join(dir, 'data', 'emails.txt'), 'a@x.com, b@y.com\na@X.com\n');
  await fs.writeFile(path.join(dir, 'assets', 'Resume_Test.pdf'), 'PDFDATA');
  await fs.writeFile(
    path.join(dir, 'logs', 'sent_log.csv'),
    [
      'timestamp,to,status,detail',
      `${today}T10:00:00.000Z,a@x.com,sent,id1`,
      `${today}T10:01:00.000Z,b@y.com,failed,"boom, 5xx"`,
      '',
    ].join('\n'),
  );
  await fs.writeFile(path.join(dir, 'token.json'), JSON.stringify({ expiry_date: 123 }));
});

afterAll(async () => {
  delete process.env.CLI_DATA_DIR;
  await fs.rm(dir, { recursive: true, force: true });
});

describe('store', () => {
  it('merges config.json over defaults', async () => {
    const config = await readConfig();
    expect(config.from).toBe('Me <me@x.com>');
    expect(config.subject).toBe('Hi');
    expect(config.dailyLimit).toBe(10);
  });

  it('reads the managed body file', async () => {
    expect(await readBody()).toBe('Hello **world**');
  });

  it('falls back to the legacy emails.txt when data/emails.txt is missing', async () => {
    const listFile = path.join(dir, 'data', 'emails.txt');
    const legacy = path.join(dir, 'emails.txt');
    const saved = await fs.readFile(listFile, 'utf8');
    await fs.rm(listFile);
    await fs.writeFile(legacy, 'legacy@x.com\n');
    try {
      expect(await readListText()).toContain('legacy@x.com');
    } finally {
      await fs.writeFile(listFile, saved);
      await fs.rm(legacy);
    }
  });

  it('lists resume PDFs with sizes', async () => {
    expect(await listResumes()).toEqual([{ name: 'Resume_Test.pdf', size: 7 }]);
  });

  it('parses the log newest-first with quoted details intact', async () => {
    const rows = await readLog(10);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ to: 'b@y.com', status: 'failed', detail: 'boom, 5xx' });
    expect(rows[1]).toMatchObject({ to: 'a@x.com', status: 'sent', detail: 'id1' });
  });

  it('summarizes status for the dashboard', async () => {
    const status = await getStatus();
    expect(status.sentToday).toBe(1); // failed rows are not counted
    expect(status.remaining).toBe(9);
    expect(status.recipients).toBe(2); // a@x.com + b@y.com (A@X.com deduped)
    expect(status.dupesRemoved).toBe(1);
    expect(status.resumeName).toBe('Resume_Test.pdf');
    expect(status.resumeSize).toBe(7);
    expect(status.resumeExists).toBe(true);
    expect(status.tokenExists).toBe(true);
    expect(status.tokenExpiry).toBe(123);
  });
});
