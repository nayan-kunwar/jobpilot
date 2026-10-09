import { describe, expect, it } from 'vitest';
import { csvEscape, isRetryable } from '../src/utils.js';

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
