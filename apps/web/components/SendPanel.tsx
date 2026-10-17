'use client';

import { useEffect, useState } from 'react';
import type { RecipientStatus, SendJobSnapshot } from '../lib/types';

const STATUS_CLASS: Record<RecipientStatus, string> = {
  pending: 'bg-slate-100 text-slate-500',
  sending: 'bg-blue-50 text-blue-700',
  sent: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
  skipped: 'bg-amber-50 text-amber-700',
};

function titleFor(snapshot: SendJobSnapshot): string {
  if (snapshot.state === 'running') return snapshot.stopping ? 'Stopping…' : 'Sending…';
  if (snapshot.phase === 'aborted') return 'Send stopped';
  if (snapshot.phase === 'error') return 'Send failed';
  return 'Send complete';
}

/** Live progress of a send batch: per-recipient states, ticker, stop button. */
export function SendPanel({
  initial,
  onClose,
  pollMs = 1000,
}: {
  initial: SendJobSnapshot;
  onClose: () => void;
  pollMs?: number;
}) {
  const [snapshot, setSnapshot] = useState<SendJobSnapshot>(initial);

  useEffect(() => {
    if (snapshot.state !== 'running') return;
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/send/status');
        if (res.ok && !cancelled) setSnapshot((await res.json()) as SendJobSnapshot);
      } catch {
        // transient fetch failure: keep the last known snapshot
      }
    }, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [snapshot.state, pollMs]);

  const running = snapshot.state === 'running';
  const left = Math.max(snapshot.total - snapshot.sent - snapshot.failed - snapshot.skipped, 0);
  const resolved = snapshot.sent + snapshot.failed + snapshot.skipped;
  const percent = snapshot.total > 0 ? Math.round((resolved / snapshot.total) * 100) : 0;

  async function handleStop() {
    setSnapshot((s) => ({ ...s, stopping: true }));
    try {
      await fetch('/api/send', { method: 'DELETE' });
    } catch {
      // the next poll reconciles
    }
  }

  return (
    <section data-testid="send-panel" className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">{titleFor(snapshot)}</h2>
        <span className="text-xs text-slate-500">
          {snapshot.sent} sent · {snapshot.failed} failed · {left} left
          {snapshot.skipped > 0 ? ` · ${snapshot.skipped} skipped` : ''}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${snapshot.failed > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {running && snapshot.currentTo ? (
        <p className="mt-3 text-sm text-slate-600">
          {snapshot.stopping ? 'Finishing ' : 'Sending to '}
          <span className="font-medium">{snapshot.currentTo}</span>…
        </p>
      ) : null}

      {snapshot.error ? <p className="mt-3 text-sm text-red-600">{snapshot.error}</p> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="max-h-64 overflow-auto rounded-md border border-slate-200">
          <table className="w-full text-left text-sm">
            <tbody>
              {snapshot.recipients.map((r, i) => (
                <tr key={`${r.to}-${i}`} className="border-b border-slate-50 last:border-0">
                  <td className="py-1.5 pl-3">{r.to}</td>
                  <td className="pr-3 text-right whitespace-nowrap">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="max-w-[12rem] truncate py-1.5 pr-3 text-xs text-slate-400" title={r.detail}>
                    {r.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
          {snapshot.lines.length === 0 ? (
            <p className="text-slate-400">Waiting for events…</p>
          ) : (
            <ul className="grid gap-1">
              {snapshot.lines.slice(-40).map((l, i) => (
                <li
                  key={`${l.at}-${i}`}
                  className={
                    l.kind === 'failed' || l.kind === 'error'
                      ? 'text-red-300'
                      : l.kind === 'sent'
                        ? 'text-emerald-300'
                        : ''
                  }
                >
                  <span className="text-slate-500">{l.at.slice(11, 19)}</span> {l.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        {running ? (
          <button
            type="button"
            onClick={handleStop}
            disabled={snapshot.stopping}
            className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            {snapshot.stopping ? 'Stopping…' : 'Stop'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        )}
        <span className="text-xs text-slate-400">
          {running
            ? 'Stops after the current email finishes.'
            : snapshot.finishedAt
              ? `Finished at ${snapshot.finishedAt.slice(11, 19)} UTC`
              : ''}
        </span>
      </div>
    </section>
  );
}
