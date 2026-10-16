/**
 * Render the plain-text email body into the two parts of a
 * multipart/alternative message:
 * - `text`: original text with `**bold**` markers stripped (fallback for
 *   clients that do not render HTML),
 * - `html`: escaped HTML where `**bold**` becomes `<b>bold</b>`, blank lines
 *   become paragraphs and single newlines become `<br>`.
 *
 * Markers must open and close on the same line; a lone `**` stays literal.
 */

const BOLD = /\*\*(.+?)\*\*/g;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface RenderedBody {
  /** Plain-text fallback with bold markers removed. */
  text: string;
  /** HTML part with bold markers converted to <b> tags. */
  html: string;
}

export function renderBody(body: string): RenderedBody {
  const text = body.replace(BOLD, '$1');
  const html = body
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>').replace(BOLD, '<b>$1</b>')}</p>`)
    .join('\n');
  return { text, html };
}
