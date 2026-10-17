import crypto from 'node:crypto';
import { renderBody } from './body.js';

export interface MimeParts {
  to: string;
  from: string;
  subject: string;
  body: string;
  pdfBase64: string;
  fileName: string;
}

export function buildMime({ to, from, subject, body, pdfBase64, fileName }: MimeParts): string {
  const mixedBoundary = 'boundary_' + crypto.randomBytes(16).toString('hex');
  const altBoundary = 'boundary_' + crypto.randomBytes(16).toString('hex');
  const messageId = `<${crypto.randomBytes(16).toString('hex')}@bulk-sender>`;
  const date = new Date().toUTCString();
  const { text, html } = renderBody(body);
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    `Date: ${date}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    '',
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    '',
    `--${altBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    text,
    '',
    `--${altBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    html,
    '',
    `--${altBoundary}--`,
    '',
    `--${mixedBoundary}`,
    `Content-Type: application/pdf; name="${fileName}"`,
    `Content-Disposition: attachment; filename="${fileName}"`,
    'Content-Transfer-Encoding: base64',
    '',
    pdfBase64,
    '',
    `--${mixedBoundary}--`,
  ].join('\r\n');
}
