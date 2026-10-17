import { describe, expect, it } from 'vitest';
import { renderBody } from '../src/body.js';

describe('renderBody', () => {
  it('converts **bold** to <b> in HTML and strips markers in the plain fallback', () => {
    const { text, html } = renderBody('I have **2+ years** of experience.');
    expect(text).toBe('I have 2+ years of experience.');
    expect(html).toBe('<p>I have <b>2+ years</b> of experience.</p>');
  });

  it('converts every pair on a line', () => {
    const { html } = renderBody('**Node.js** and **TypeScript**');
    expect(html).toBe('<p><b>Node.js</b> and <b>TypeScript</b></p>');
  });

  it('escapes HTML so body text cannot inject tags', () => {
    const { html, text } = renderBody('Use <script>alert(1)</script> & "quotes"');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('"quotes"'); // quotes need no escaping in text nodes
    expect(html).not.toContain('<script>');
    expect(text).toContain('<script>'); // plain part keeps raw text
  });

  it('turns blank lines into paragraphs and single newlines into <br>', () => {
    const { text, html } = renderBody('Dear Team,\n\nLine one\nLine two');
    expect(text).toBe('Dear Team,\n\nLine one\nLine two');
    expect(html).toBe('<p>Dear Team,</p>\n<p>Line one<br>Line two</p>');
  });

  it('leaves unmatched markers as literal text', () => {
    const { text, html } = renderBody('cost: **5 and no close');
    expect(text).toBe('cost: **5 and no close');
    expect(html).toBe('<p>cost: **5 and no close</p>');
  });

  it('handles a paired marker followed by an unmatched one', () => {
    const { text, html } = renderBody('**ok** then **');
    expect(text).toBe('ok then **');
    expect(html).toBe('<p><b>ok</b> then **</p>');
  });
});
