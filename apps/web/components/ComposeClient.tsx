'use client';

import { renderBody } from '@packages/email-core/body';
import { parseEmails } from '@packages/email-core/emails';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { ResumeFile, SaveInput, SaveResult } from '../lib/types';

const EMAIL_RE = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g; // raw count only; parsing/deduping uses parseEmails
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // Gmail limit

export interface ComposeInitial {
  subject: string;
  from: string;
  body: string;
  recipients: string;
  resume: string;
}

export function ComposeClient({
  initial,
  resumes,
  daily,
  onSave,
}: {
  initial: ComposeInitial;
  resumes: ResumeFile[];
  daily: { sentToday: number; dailyLimit: number };
  onSave: (input: SaveInput) => Promise<SaveResult>;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(initial.subject);
  const [from, setFrom] = useState(initial.from);
  const [body, setBody] = useState(initial.body);
  const [recipients, setRecipients] = useState(initial.recipients);
  const [resume, setResume] = useState(initial.resume);
  const [previewMode, setPreviewMode] = useState<'html' | 'plain'>('html');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);

  const parsed = useMemo(() => parseEmails(recipients), [recipients]);
  const rawCount = useMemo(() => (recipients.match(EMAIL_RE) || []).length, [recipients]);
  const dupesRemoved = Math.max(rawCount - parsed.length, 0);
  const rendered = useMemo(() => renderBody(body), [body]);

  const selected = resumes.find((r) => r.name === resume);
  const resumeTooBig = selected ? selected.size > MAX_ATTACHMENT_BYTES : false;
  const remaining = Math.max(daily.dailyLimit - daily.sentToday, 0);
  const overDaily = parsed.length > remaining;

  async function handleSave() {
    setSaving(true);
    setResult(null);
    const res = await onSave({ subject, from, body, recipients, resume });
    setResult(res);
    setSaving(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">From</span>
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Resume attachment</span>
          <select
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {resumes.length === 0 ? <option value="">No PDFs found in assets/</option> : null}
            {resumes.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name} — {(r.size / 1024 / 1024).toFixed(2)} MB
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Cover letter</h2>
            <span className="text-xs text-slate-500">
              wrap words in <code className="rounded bg-slate-100 px-1">**asterisks**</code> to make them bold
            </span>
          </div>
          <textarea
            aria-label="Email body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={18}
            spellCheck={false}
            className="w-full rounded-md border border-slate-300 p-3 font-mono text-[13px] leading-relaxed"
          />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Preview</h2>
            <div className="flex gap-1 rounded-md bg-slate-100 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setPreviewMode('html')}
                className={`rounded px-2 py-1 ${previewMode === 'html' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
              >
                HTML (Gmail)
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('plain')}
                className={`rounded px-2 py-1 ${previewMode === 'plain' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
              >
                Plain text
              </button>
            </div>
          </div>
          <div
            data-testid="preview"
            className="min-h-[24rem] rounded-md border border-slate-200 bg-white p-6 text-[15px] leading-relaxed text-slate-800"
          >
            {previewMode === 'html' ? (
              <div dangerouslySetInnerHTML={{ __html: rendered.html }} />
            ) : (
              <pre className="font-sans whitespace-pre-wrap">{rendered.text}</pre>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            HTML is exactly what Gmail renders; Plain text is the fallback other clients show.
          </p>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Recipients</h2>
            <span className="text-xs text-slate-500">
              {parsed.length} recipient{parsed.length === 1 ? '' : 's'}
              {dupesRemoved > 0 ? ` (${dupesRemoved} duplicate${dupesRemoved === 1 ? '' : 's'} removed)` : ''}
            </span>
          </div>
          <textarea
            aria-label="Recipients"
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            rows={10}
            spellCheck={false}
            placeholder="one@address.com per line — or paste any format; emails are extracted automatically"
            className="w-full rounded-md border border-slate-300 p-3 font-mono text-[13px] leading-relaxed"
          />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Review</h2>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Recipients</dt>
              <dd className="font-medium">{parsed.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Duplicates removed</dt>
              <dd className="font-medium">{dupesRemoved}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Resume</dt>
              <dd className={resumeTooBig ? 'font-medium text-red-600' : 'font-medium'}>
                {selected
                  ? `${selected.name} (${(selected.size / 1024 / 1024).toFixed(2)} MB)`
                  : 'none selected'}
                {resumeTooBig ? ' — over the 25 MB Gmail limit' : ''}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Daily limit</dt>
              <dd className={overDaily ? 'font-medium text-amber-600' : 'font-medium'}>
                {remaining} remaining of {daily.dailyLimit}
                {overDaily ? ` — the CLI will truncate to ${remaining}` : ''}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {result ? (
              result.ok ? (
                <p className="text-sm text-emerald-600">
                  Saved — config.json, data/body.txt and data/emails.txt updated.
                </p>
              ) : (
                <p className="text-sm text-red-600">{result.error}</p>
              )
            ) : null}
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Sending stays in the CLI for now — after saving, run{' '}
            <code className="rounded bg-slate-100 px-1">npm run dry</code> to verify, then{' '}
            <code className="rounded bg-slate-100 px-1">npm run live -- --body-file data/body.txt</code>.
          </p>
        </section>
      </div>
    </div>
  );
}
