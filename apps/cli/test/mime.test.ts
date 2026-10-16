import { describe, expect, it } from 'vitest';
import { buildMime } from '../src/mime.js';

const base = {
  to: 'a@x.com',
  from: 'Me <me@x.com>',
  subject: 'Hi',
  pdfBase64: 'QUJD',
  fileName: 'resume.pdf',
};

describe('buildMime', () => {
  it('includes headers, both body parts and the attachment', () => {
    const raw = buildMime({ ...base, body: 'Hello **world**' });
    expect(raw).toMatch(/From: Me <me@x\.com>/);
    expect(raw).toMatch(/To: a@x\.com/);
    expect(raw).toMatch(/Subject: Hi/);
    expect(raw).toMatch(/Message-ID: <.+@bulk-sender>/);
    expect(raw).toMatch(/Content-Type: multipart\/mixed; boundary="boundary_.+"/);
    expect(raw).toMatch(/Content-Type: multipart\/alternative; boundary="boundary_.+"/);
    expect(raw).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(raw).toContain('Content-Type: text/html; charset="UTF-8"');
    expect(raw).toContain('Hello world'); // plain fallback: markers stripped
    expect(raw).toContain('<b>world</b>'); // HTML part: bold applied
    expect(raw).toMatch(/filename="resume\.pdf"/);
  });

  it('closes both boundaries and keeps them distinct', () => {
    const raw = buildMime({ ...base, body: 'Hi' });
    const mixed = raw.match(/multipart\/mixed; boundary="(boundary_\w+)"/)?.[1];
    const alt = raw.match(/multipart\/alternative; boundary="(boundary_\w+)"/)?.[1];
    expect(mixed).toBeTruthy();
    expect(alt).toBeTruthy();
    expect(alt).not.toBe(mixed);
    expect(raw).toContain(`--${alt}--`);
    expect(raw.trimEnd().endsWith(`--${mixed}--`)).toBe(true);
  });
});
