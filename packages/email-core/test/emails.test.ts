import { describe, expect, it } from 'vitest';
import { parseEmails } from '../src/emails.js';

describe('parseEmails', () => {
  it('extracts and dedupes (case-insensitive)', () => {
    expect(parseEmails('A@x.com, a@X.com; Jane <jane@co.com>\nnope')).toEqual(['A@x.com', 'jane@co.com']);
  });

  it('returns [] for no addresses', () => {
    expect(parseEmails('hello world')).toEqual([]);
  });

  it('handles commas, semicolons and display names', () => {
    const found = parseEmails('a@b.co, B <b@c.org>; c@d.net');
    expect(found).toEqual(['a@b.co', 'b@c.org', 'c@d.net']);
  });
});
