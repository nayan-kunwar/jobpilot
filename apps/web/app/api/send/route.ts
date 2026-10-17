import { NextResponse } from 'next/server';
import { startSend, stopSend } from '../../../lib/send-job';

// Local dashboard: never cache job state.
export const dynamic = 'force-dynamic';

/** Start a send batch. The UI shows its confirm dialog before calling this. */
export async function POST() {
  const result = await startSend();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, total: result.total });
}

/** Ask the running batch to stop after the current email. */
export async function DELETE() {
  const result = stopSend();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
