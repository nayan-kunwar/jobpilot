import type { SendJobSnapshot } from '../lib/types';

/** Minimal fetch Response stand-in for stubbed global fetch. */
export function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** SendJobSnapshot builder: running mid-batch by default. */
export function snapshot(overrides: Partial<SendJobSnapshot> = {}): SendJobSnapshot {
  return {
    state: 'running',
    phase: 'running',
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: null,
    total: 2,
    sent: 1,
    failed: 0,
    skipped: 0,
    stopping: false,
    currentTo: 'b@y.com',
    error: null,
    logPath: 'C:/repo/apps/cli/logs/sent_log.csv',
    recipients: [
      { to: 'a@x.com', status: 'sent', detail: 'mid-1' },
      { to: 'b@y.com', status: 'sending' },
    ],
    lines: [{ at: '2026-01-01T00:00:01.000Z', kind: 'sent', to: 'a@x.com', text: 'Sent a@x.com (mid-1)' }],
    ...overrides,
  };
}

export function idleSnapshot(): SendJobSnapshot {
  return snapshot({
    state: 'idle',
    phase: null,
    startedAt: null,
    total: 0,
    sent: 0,
    currentTo: null,
    recipients: [],
    lines: [],
  });
}

export function doneSnapshot(): SendJobSnapshot {
  return snapshot({
    state: 'finished',
    phase: 'done',
    finishedAt: '2026-01-01T00:00:05.000Z',
    sent: 2,
    currentTo: null,
    recipients: [
      { to: 'a@x.com', status: 'sent', detail: 'mid-1' },
      { to: 'b@y.com', status: 'sent', detail: 'mid-2' },
    ],
    lines: [
      { at: '2026-01-01T00:00:01.000Z', kind: 'sent', to: 'a@x.com', text: 'Sent a@x.com (mid-1)' },
      { at: '2026-01-01T00:00:04.000Z', kind: 'sent', to: 'b@y.com', text: 'Sent b@y.com (mid-2)' },
      { at: '2026-01-01T00:00:05.000Z', kind: 'done', text: 'Done: 2 sent, 0 failed.' },
    ],
  });
}
