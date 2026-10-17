import { NextResponse } from 'next/server';
import { getSendSnapshot } from '../../../../lib/send-job';

// Local dashboard: never cache job state.
export const dynamic = 'force-dynamic';

/** Live progress of the current/last send batch (polled by the UI). */
export async function GET() {
  return NextResponse.json(getSendSnapshot());
}
