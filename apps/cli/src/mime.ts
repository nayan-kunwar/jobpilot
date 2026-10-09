import crypto from 'node:crypto';

export interface MimeParts {
  to: string;
  from: string;
  subject: string;
  body: string;
  pdfBase64: string;
  fileName: string;
}

export function buildMime({ to, from, subject, body, pdfBase64, fileName }: MimeParts): string {
  const boundary = 'boundary_' + crypto.randomBytes(16).toString('hex');
  const messageId = `<${crypto.randomBytes(16).toString('hex')}@bulk-sender>`;
  const date = new Date().toUTCString();
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    `Date: ${date}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${fileName}"`,
    `Content-Disposition: attachment; filename="${fileName}"`,
    'Content-Transfer-Encoding: base64',
    '',
    pdfBase64,
    '',
    `--${boundary}--`,
  ].join('\r\n');
}
