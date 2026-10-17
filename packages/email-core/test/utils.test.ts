import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { countSentToday, csvEscape, isRetryable } from '../src/utils.js';

describe('csvEscape', () => {
  it('quotes fields with commas/quotes/newlines', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('plain')).toBe('plain');
  });
});

describe('isRetryable', () => {
  it('retries 429 and 5xx, not 400', () => {
    expect(isRetryable({ code: 429 })).toBe(true);
    expect(isRetryable({ code: 503 })).toBe(true);
    expect(isRetryable({ code: 400 })).toBe(false);
    expect(isRetryable({ code: 'ECONNRESET' })).toBe(true);
  });
});

describe('countSentToday', () => {
  it('counts only today sent rows across multiple files', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'email-core-'));
    const today = new Date().toISOString().slice(0, 10);
    const canonical = path.join(dir, 'sent_log.csv');
    const legacy = path.join(dir, 'legacy.csv');
    await fs.writeFile(
      canonical,
      [
        'timestamp,to,status,detail',
        `${today}T10:00:00.000Z,a@x.com,sent,id1`,
        `${today}T10:01:00.000Z,b@x.com,failed,boom`,
        '2020-01-01T00:00:00.000Z,c@x.com,sent,id2',
        '',
      ].join('\n'),
    );
    await fs.writeFile(legacy, `timestamp,to,status,detail\n${today}T11:00:00.000Z,d@x.com,sent,id3\n`);
    expect(await countSentToday(canonical)).toBe(1);
    expect(await countSentToday(canonical, legacy)).toBe(2);
    expect(await countSentToday(path.join(dir, 'missing.csv'))).toBe(0);
  });
});
