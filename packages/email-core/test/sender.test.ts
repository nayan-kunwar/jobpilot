import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_BODY } from '../src/defaults.js';
import {
  resolveSendInputs,
  runSend,
  type RunSendOptions,
  type SendEvent,
  type SendTransport,
} from '../src/sender.js';

let tmpDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tmpDirs.map((d) => fs.rm(d, { recursive: true, force: true })));
  tmpDirs = [];
});

async function tmp(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sender-test-'));
  tmpDirs.push(dir);
  return dir;
}

function gmailError(message: string, code: number): Error {
  return Object.assign(new Error(message), { code });
}

type TrackingTransport = SendTransport & { raw: string[] };

function makeTransport(send: (raw: string) => Promise<{ id?: string }>): TrackingTransport {
  const raw: string[] = [];
  return {
    raw,
    async sendRaw(r: string) {
      raw.push(r);
      return send(r);
    },
  };
}

const CONFIG = {
  from: 'Me <me@x.com>',
  subject: 'Hi',
  resume: './assets/resume.pdf',
  delayMs: 0,
  dailyLimit: 100,
};

async function baseOptions(overrides: Partial<RunSendOptions> = {}): Promise<RunSendOptions> {
  const dir = await tmp();
  const resumePath = path.join(dir, 'resume.pdf');
  await fs.writeFile(resumePath, '%PDF-1.4 test');
  return {
    emails: ['a@x.com', 'b@x.com'],
    from: CONFIG.from,
    subject: CONFIG.subject,
    body: 'Hello **world**',
    resumePath,
    delayMs: 0,
    dailyLimit: 100,
    listFile: path.join(dir, 'emails.txt'),
    bodyFile: null,
    logPath: path.join(dir, 'logs', 'sent_log.csv'),
    credentialsPath: path.join(dir, 'credentials.json'),
    tokenPath: path.join(dir, 'token.json'),
    sleep: async () => undefined,
    transport: makeTransport(async () => ({ id: 'mid' })),
    ...overrides,
  };
}

async function seedSentToday(logPath: string, count: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = Array.from(
    { length: count },
    (_, i) => `${today}T0${i + 1}:00:00.000Z,seed${i}@x.com,sent,id${i}`,
  );
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.writeFile(logPath, ['timestamp,to,status,detail', ...rows, ''].join('\n'));
}

describe('resolveSendInputs', () => {
  it('reads, dedupes and limits the list; merges config and overrides', async () => {
    const dir = await tmp();
    const listFile = path.join(dir, 'emails.txt');
    await fs.writeFile(listFile, 'a@x.com, A@X.com\nb@y.com\n');

    const inputs = await resolveSendInputs({ listFile, config: CONFIG, baseDir: dir, limit: 2 });
    expect(inputs.emails).toEqual(['a@x.com', 'b@y.com']);
    expect(inputs.from).toBe(CONFIG.from);
    expect(inputs.subject).toBe(CONFIG.subject);
    expect(inputs.resumePath).toBe(path.join(dir, 'assets', 'resume.pdf'));
    expect(inputs.body).toBe(DEFAULT_BODY);

    const overridden = await resolveSendInputs({
      listFile,
      config: CONFIG,
      baseDir: dir,
      overrides: { from: 'Other <o@x.com>', resume: 'other.pdf', delayMs: 25, dailyLimit: 7 },
    });
    expect(overridden.from).toBe('Other <o@x.com>');
    expect(overridden.resumePath).toBe(path.resolve('other.pdf'));
    expect(overridden.delayMs).toBe(25);
    expect(overridden.dailyLimit).toBe(7);
  });

  it('maps missing lists and empty lists to typed errors', async () => {
    const dir = await tmp();
    await expect(
      resolveSendInputs({ listFile: path.join(dir, 'nope.txt'), config: CONFIG, baseDir: dir }),
    ).rejects.toMatchObject({ kind: 'list' });

    const empty = path.join(dir, 'empty.txt');
    await fs.writeFile(empty, 'no addresses here\n');
    await expect(resolveSendInputs({ listFile: empty, config: CONFIG, baseDir: dir })).rejects.toMatchObject({
      kind: 'no-recipients',
    });
  });

  it('uses the body file and rejects empty or missing ones', async () => {
    const dir = await tmp();
    const listFile = path.join(dir, 'emails.txt');
    await fs.writeFile(listFile, 'a@x.com\n');
    const bodyFile = path.join(dir, 'body.txt');
    await fs.writeFile(bodyFile, 'Hi **there**\n');

    const inputs = await resolveSendInputs({ listFile, config: CONFIG, baseDir: dir, bodyFile });
    expect(inputs.body).toBe('Hi **there**');

    await fs.writeFile(bodyFile, '   \n\n');
    await expect(
      resolveSendInputs({ listFile, config: CONFIG, baseDir: dir, bodyFile }),
    ).rejects.toMatchObject({ kind: 'body' });

    await expect(
      resolveSendInputs({ listFile, config: CONFIG, baseDir: dir, bodyFile: path.join(dir, 'missing.txt') }),
    ).rejects.toMatchObject({ kind: 'body' });
  });

  it('prefers inline bodyText over the body file', async () => {
    const dir = await tmp();
    const listFile = path.join(dir, 'emails.txt');
    await fs.writeFile(listFile, 'a@x.com\n');
    const bodyFile = path.join(dir, 'body.txt');
    await fs.writeFile(bodyFile, ''); // an empty file would normally be a 'body' error

    const inputs = await resolveSendInputs({
      listFile,
      config: CONFIG,
      baseDir: dir,
      bodyFile,
      bodyText: 'Inline **body**',
    });
    expect(inputs.body).toBe('Inline **body**');

    await expect(
      resolveSendInputs({ listFile, config: CONFIG, baseDir: dir, bodyText: '   ' }),
    ).rejects.toMatchObject({ kind: 'body' });
  });
});

describe('runSend', () => {
  it('sends every email, writes the CSV log and emits events', async () => {
    let n = 0;
    const transport = makeTransport(async () => ({ id: `mid-${++n}` }));
    const events: SendEvent[] = [];
    const opts = await baseOptions({ transport, onEvent: (e) => events.push(e) });

    const result = await runSend(opts);

    expect(result).toMatchObject({ total: 2, sent: 2, failed: 0, skipped: 0, aborted: false });
    const lines = (await fs.readFile(opts.logPath, 'utf8')).trim().split('\n');
    expect(lines[0]).toBe('timestamp,to,status,detail');
    expect(lines[1]).toMatch(/,a@x\.com,sent,mid-1$/);
    expect(lines[2]).toMatch(/,b@x\.com,sent,mid-2$/);

    const decoded = Buffer.from(transport.raw[0], 'base64url').toString('utf8');
    expect(decoded).toContain('To: a@x.com');
    expect(decoded).toContain('Subject: Hi');

    expect(events.map((e) => e.type)).toEqual([
      'email-start',
      'email-sent',
      'email-start',
      'email-sent',
      'run-end',
    ]);
    expect(events.at(-1)).toMatchObject({ type: 'run-end', sent: 2, failed: 0, skipped: 0 });
  });

  it('retries retryable errors with backoff and then succeeds', async () => {
    let calls = 0;
    const transport = makeTransport(async () => {
      if (++calls === 1) throw gmailError('rate limited', 429);
      return { id: 'ok-1' };
    });
    const seen: SendEvent[] = [];
    const opts = await baseOptions({
      emails: ['a@x.com'],
      transport,
      retryDelays: [5],
      onEvent: (e) => seen.push(e),
    });

    const result = await runSend(opts);

    expect(result.sent).toBe(1);
    const retry = seen.find((e) => e.type === 'email-retry');
    expect(retry).toMatchObject({ attempt: 1, error: expect.stringContaining('rate limited') });
    if (retry?.type === 'email-retry') expect(retry.waitMs).toBeGreaterThanOrEqual(5);
    expect(seen.some((e) => e.type === 'email-sent')).toBe(true);
  });

  it('logs a failure after the retries are exhausted', async () => {
    const transport = makeTransport(async () => {
      throw gmailError('boom 500', 500);
    });
    const seen: SendEvent[] = [];
    const opts = await baseOptions({
      emails: ['a@x.com'],
      transport,
      retryDelays: [1, 1],
      onEvent: (e) => seen.push(e),
    });

    const result = await runSend(opts);

    expect(result).toMatchObject({ sent: 0, failed: 1, skipped: 0 });
    expect(seen.filter((e) => e.type === 'email-retry')).toHaveLength(2);
    expect(seen.filter((e) => e.type === 'email-failed')).toHaveLength(1);
    expect(await fs.readFile(opts.logPath, 'utf8')).toContain(',a@x.com,failed,boom 500');
  });

  it('does not retry non-retryable errors', async () => {
    const transport = makeTransport(async () => {
      throw gmailError('bad request', 400);
    });
    const seen: SendEvent[] = [];
    const opts = await baseOptions({
      emails: ['a@x.com'],
      transport,
      retryDelays: [1, 1],
      onEvent: (e) => seen.push(e),
    });

    const result = await runSend(opts);

    expect(result.failed).toBe(1);
    expect(seen.some((e) => e.type === 'email-retry')).toBe(false);
  });

  it('stops before the next email when shouldStop flips', async () => {
    let stop = false;
    const transport = makeTransport(async () => {
      stop = true; // stop requested as soon as the first send completes
      return { id: 'first' };
    });
    const seen: SendEvent[] = [];
    const opts = await baseOptions({
      emails: ['a@x.com', 'b@x.com', 'c@x.com'],
      transport,
      shouldStop: () => stop,
      onEvent: (e) => seen.push(e),
    });

    const result = await runSend(opts);

    expect(result).toMatchObject({ total: 3, sent: 1, failed: 0, skipped: 2, aborted: true });
    expect(seen.filter((e) => e.type === 'email-start')).toHaveLength(1);
  });

  it('refuses to send when the daily limit is already reached', async () => {
    const transport = makeTransport(async () => ({ id: 'never' }));
    const opts = await baseOptions({ dailyLimit: 2, transport });
    await seedSentToday(opts.logPath, 2);

    await expect(runSend(opts)).rejects.toMatchObject({ kind: 'daily-limit' });
    expect(transport.raw).toHaveLength(0);
  });

  it('truncates the run to the remaining daily budget', async () => {
    let n = 0;
    const transport = makeTransport(async () => ({ id: `t-${++n}` }));
    const seen: SendEvent[] = [];
    const opts = await baseOptions({
      emails: ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com'],
      dailyLimit: 4,
      transport,
      onEvent: (e) => seen.push(e),
    });
    await seedSentToday(opts.logPath, 1);

    const result = await runSend(opts);

    expect(result.total).toBe(3);
    expect(seen.find((e) => e.type === 'emails-truncated')).toMatchObject({
      requested: 5,
      allowed: 3,
      dailyLimit: 4,
      sentToday: 1,
    });
  });

  it('fails auth with a typed error when credentials are missing', async () => {
    const opts = await baseOptions({ transport: undefined });
    await expect(runSend(opts)).rejects.toMatchObject({ kind: 'auth' });
    await expect(runSend(opts)).rejects.toThrow(/Auth failed/);
  });

  it('fails typed when the resume is missing or over the injected size limit', async () => {
    const opts = await baseOptions({ resumePath: path.join(await tmp(), 'missing.pdf') });
    await expect(runSend(opts)).rejects.toMatchObject({ kind: 'resume' });

    const oversize = await baseOptions({ maxAttachmentBytes: 4 }); // fixture pdf is 13 bytes
    await expect(runSend(oversize)).rejects.toMatchObject({ kind: 'resume' });
  });
});
