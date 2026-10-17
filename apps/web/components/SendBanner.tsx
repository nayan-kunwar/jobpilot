'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SendJobSnapshot } from '../lib/types';

/** Dashboard banner shown while a batch is sending (polls the send API). */
export function SendBanner({ pollMs = 2000 }: { pollMs?: number }) {
  const [snapshot, setSnapshot] = useState<SendJobSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch('/api/send/status');
        if (res.ok && active) setSnapshot((await res.json()) as SendJobSnapshot);
      } catch {
        // local server hiccup: keep the last known snapshot
      }
    };
    void tick();
    const id = setInterval(tick, pollMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [pollMs]);

  if (!snapshot || snapshot.state !== 'running') return null;

  const done = snapshot.sent + snapshot.failed;
  async function handleStop() {
    setSnapshot((s) => (s ? { ...s, stopping: true } : s));
    try {
      await fetch('/api/send', { method: 'DELETE' });
    } catch {
      // the next poll reconciles
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
      <p className="text-blue-900">
        <span className="font-semibold">
          {snapshot.stopping ? 'Stopping after the current email' : 'Sending now'}
        </span>
        {' — '}
        {done} of {snapshot.total} done
        {snapshot.currentTo ? ` · current: ${snapshot.currentTo}` : ''}
        {snapshot.failed > 0 ? ` · ${snapshot.failed} failed` : ''}
      </p>
      <div className="flex shrink-0 items-center gap-3">
        <Link href="/compose" className="font-medium text-blue-700 hover:underline">
          Open Compose →
        </Link>
        {snapshot.stopping ? null : (
          <button
            type="button"
            onClick={handleStop}
            className="rounded-md border border-blue-300 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
          >
            Stop
          </button>
        )}
      </div>
    </div>
  );
}
