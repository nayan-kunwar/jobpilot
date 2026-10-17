// @vitest-environment node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { SendTransport } from '@packages/email-core/sender';
import { __setSendJobTestDeps, getSendSnapshot, startSend, stopSend } from '../lib/send-job';
import type { SendJobSnapshot } from '../lib/types';

let dir: string;

interface Fixtures {
  dailyLimit?: number;
  recipients?: string;
  token?: boolean;
}

async function writeFixtures({
  dailyLimit = 10,
  recipients = 'a@x.com\nb@x.com\n',
  token = true,
}: Fixtures = {}) {
  await fs.mkdir(path.join(dir, 'data'), { recursive: true });
  await fs.mkdir(path.join(dir, 'assets'), { recursive: true });
  await fs.mkdir(path.join(dir, 'logs'), { recursive: true });
  await fs.writeFile(
    path.join(dir, 'config.json'),
    JSON.stringify({
      from: 'Me <me@x.com>',
      subject: 'Hi',
      resume: './assets/Resume.pdf',
      delayMs: 1,
      dailyLimit,
    }),
  );
  await fs.writeFile(path.join(dir, 'data', 'emails.txt'), recipients);
  await fs.writeFile(path.join(dir, 'data', 'body.txt'), 'Hello **there**\n');
  await fs.writeFile(path.join(dir, 'assets', 'Resume.pdf'), 'PDFDATA');
  await fs.rm(path.join(dir, 'logs', 'sent_log.csv'), { force: true });
  if (token) await fs.writeFile(path.join(dir, 'token.json'), '{}');
  else await fs.rm(path.join(dir, 'token.json'), { force: true });
}

function fakeTransport(ids: string[] = []): { transport: SendTransport; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    transport: {
      async sendRaw(raw: string) {
        calls.push(raw);
        return { id: ids[calls.length - 1] ?? `mid-${calls.length}` };
      },
    },
  };
}

async function waitForFinish(timeoutMs = 5000): Promise<SendJobSnapshot> {
  const started = Date.now();
  for (;;) {
    const snapshot = getSendSnapshot();
    if (snapshot.state === 'finished') return snapshot;
    if (Date.now() - started > timeoutMs) throw new Error('send job did not finish in time');
    await new Promise((r) => setTimeout(r, 10));
  }
}

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'web-send-'));
  process.env.CLI_DATA_DIR = dir;
});

beforeEach(async () => {
  __setSendJobTestDeps({ sleep: async () => undefined });
  await writeFixtures();
});

afterAll(async () => {
  __setSendJobTestDeps(null);
  delete process.env.CLI_DATA_DIR;
  await fs.rm(dir, { recursive: true, force: true });
});

describe('send job', () => {
  it('accepts a batch, updates recipients and writes the CSV log', async () => {
    const { transport } = fakeTransport(['mid-1', 'mid-2']);
    __setSendJobTestDeps({ sleep: async () => undefined, transport });

    const started = await startSend();
    expect(started).toMatchObject({ ok: true, total: 2 });

    const snapshot = await waitForFinish();
    expect(snapshot).toMatchObject({
      phase: 'done',
      total: 2,
      sent: 2,
      failed: 0,
      skipped: 0,
      stopping: false,
    });
    expect(snapshot.recipients.map((r) => [r.to, r.status, r.detail])).toEqual([
      ['a@x.com', 'sent', 'mid-1'],
      ['b@x.com', 'sent', 'mid-2'],
    ]);
    expect(snapshot.lines.some((l) => l.kind === 'sent' && l.text.includes('a@x.com'))).toBe(true);

    const log = await fs.readFile(path.join(dir, 'logs', 'sent_log.csv'), 'utf8');
    expect(log).toContain(',a@x.com,sent,mid-1');
    expect(log).toContain(',b@x.com,sent,mid-2');
  });

  it('returns 409 while a batch is already running', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const transport: SendTransport = {
      async sendRaw() {
        await gate;
        return { id: 'blocked-1' };
      },
    };
    __setSendJobTestDeps({ sleep: async () => undefined, transport });

    expect(await startSend()).toMatchObject({ ok: true });
    const second = await startSend();
    expect(second).toMatchObject({ ok: false, status: 409 });

    // clean up: let the blocked email finish, then stop the rest
    stopSend();
    release();
    const snapshot = await waitForFinish();
    expect(snapshot.phase).toBe('aborted');
    expect(snapshot.recipients[1]).toMatchObject({ status: 'skipped', detail: 'stopped' });
  });

  it('stops between emails when stop is requested', async () => {
    const { transport } = fakeTransport(['mid-1', 'mid-2']);
    __setSendJobTestDeps({
      transport,
      sleep: async () => {
        stopSend(); // requested during the pause after the first email
      },
    });

    await startSend();
    const snapshot = await waitForFinish();

    expect(snapshot).toMatchObject({ phase: 'aborted', total: 2, sent: 1, skipped: 1, stopping: false });
    expect(snapshot.recipients[1]).toMatchObject({ to: 'b@x.com', status: 'skipped', detail: 'stopped' });
    expect(snapshot.lines.some((l) => l.kind === 'stopped')).toBe(true);
  });

  it('marks the overflow as skipped when the daily budget truncates the batch', async () => {
    await writeFixtures({ dailyLimit: 1 });
    const { transport } = fakeTransport(['mid-1']);
    __setSendJobTestDeps({ sleep: async () => undefined, transport });

    const started = await startSend();
    expect(started).toMatchObject({ ok: true, total: 2 });

    const snapshot = await waitForFinish();
    expect(snapshot).toMatchObject({ phase: 'done', total: 2, sent: 1, skipped: 1 });
    expect(snapshot.recipients[1]).toMatchObject({ status: 'skipped', detail: 'daily limit' });
    expect(snapshot.lines.some((l) => l.kind === 'truncated')).toBe(true);
  });

  it('refuses to start when the daily limit is already reached', async () => {
    await writeFixtures({ dailyLimit: 1 });
    const today = new Date().toISOString().slice(0, 10);
    await fs.writeFile(
      path.join(dir, 'logs', 'sent_log.csv'),
      `timestamp,to,status,detail\n${today}T01:00:00.000Z,x@x.com,sent,id1\n`,
    );

    const result = await startSend();
    expect(result).toMatchObject({ ok: false, status: 400 });
    if (!result.ok) expect(result.error).toMatch(/Daily limit reached/);
  });

  it('rejects an empty recipient list up front', async () => {
    await writeFixtures({ recipients: 'not-an-email\n' });
    const result = await startSend();
    expect(result).toMatchObject({ ok: false, status: 400 });
    if (!result.ok) expect(result.error).toMatch(/No email addresses found/);
  });

  it('asks for npm run auth when token.json is missing', async () => {
    await writeFixtures({ token: false });
    const result = await startSend();
    expect(result).toMatchObject({ ok: false, status: 400 });
    if (!result.ok) expect(result.error).toMatch(/npm run auth/);
  });

  it('records failures without retrying non-retryable errors', async () => {
    const transport: SendTransport = {
      async sendRaw() {
        throw Object.assign(new Error('boom'), { code: 400 });
      },
    };
    __setSendJobTestDeps({ sleep: async () => undefined, transport, retryDelays: [1] });

    await startSend();
    const snapshot = await waitForFinish();

    expect(snapshot).toMatchObject({ phase: 'done', total: 2, sent: 0, failed: 2 });
    expect(snapshot.recipients.every((r) => r.status === 'failed' && r.detail === 'boom')).toBe(true);
    expect(snapshot.lines.some((l) => l.kind === 'failed')).toBe(true);
  });

  it('returns 409 from stop when nothing is running', () => {
    expect(stopSend()).toMatchObject({ ok: false, status: 409 });
  });
});
