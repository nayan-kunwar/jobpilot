// @vitest-environment node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SendTransport } from '@packages/email-core/sender';
import { DELETE, POST } from '../app/api/send/route';
import { GET } from '../app/api/send/status/route';
import { __setSendJobTestDeps, getSendSnapshot } from '../lib/send-job';

let dir: string;

async function writeFixtures({ token = true }: { token?: boolean } = {}) {
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
      dailyLimit: 10,
    }),
  );
  await fs.writeFile(path.join(dir, 'data', 'emails.txt'), 'a@x.com\n');
  await fs.writeFile(path.join(dir, 'data', 'body.txt'), 'Hello\n');
  await fs.writeFile(path.join(dir, 'assets', 'Resume.pdf'), 'PDFDATA');
  await fs.rm(path.join(dir, 'logs', 'sent_log.csv'), { force: true });
  if (token) await fs.writeFile(path.join(dir, 'token.json'), '{}');
  else await fs.rm(path.join(dir, 'token.json'), { force: true });
}

async function waitForFinish(): Promise<void> {
  const started = Date.now();
  while (getSendSnapshot().state === 'running') {
    if (Date.now() - started > 5000) throw new Error('send job did not finish in time');
    await new Promise((r) => setTimeout(r, 10));
  }
}

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'web-send-api-'));
  process.env.CLI_DATA_DIR = dir;
});

afterAll(async () => {
  __setSendJobTestDeps(null);
  delete process.env.CLI_DATA_DIR;
  await fs.rm(dir, { recursive: true, force: true });
});

describe('send API routes', () => {
  it('GET /api/send/status reports idle before any run', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { state: string };
    expect(body.state).toBe('idle');
  });

  it('DELETE /api/send returns 409 when nothing is running', async () => {
    const res = await DELETE();
    expect(res.status).toBe(409);
    expect((await res.json()) as { error: string }).toMatchObject({
      error: expect.stringContaining('No send is running'),
    });
  });

  it('POST /api/send returns 400 with a message when the token is missing', async () => {
    await writeFixtures({ token: false });
    const res = await POST();
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/npm run auth/);
  });

  it('POST /api/send starts a batch and GET reports it finished', async () => {
    await writeFixtures();
    const transport: SendTransport = {
      async sendRaw() {
        return { id: 'api-mid-1' };
      },
    };
    __setSendJobTestDeps({ sleep: async () => undefined, transport });

    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, total: 1 });

    await waitForFinish();
    const status = await GET();
    expect(status.status).toBe(200);
    const body = (await status.json()) as { phase: string; sent: number; recipients: { status: string }[] };
    expect(body).toMatchObject({ phase: 'done', sent: 1 });
    expect(body.recipients[0].status).toBe('sent');
  });
});
