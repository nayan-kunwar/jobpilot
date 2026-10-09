import { describe, expect, it } from 'vitest';
import { buildMime } from '../src/mime.js';

describe('buildMime', () => {
  it('includes headers, body and attachment markers', () => {
    const raw = buildMime({
      to: 'a@x.com',
      from: 'Me <me@x.com>',
      subject: 'Hi',
      body: 'Hello',
      pdfBase64: 'QUJD',
      fileName: 'resume.pdf',
    });
    expect(raw).toMatch(/From: Me <me@x\.com>/);
    expect(raw).toMatch(/To: a@x\.com/);
    expect(raw).toMatch(/Subject: Hi/);
    expect(raw).toMatch(/Message-ID: <.+@bulk-sender>/);
    expect(raw).toMatch(/Content-Type: multipart\/mixed; boundary="boundary_.+"/);
    expect(raw).toContain('Hello');
    expect(raw).toMatch(/filename="resume\.pdf"/);
  });
});
