import fs from 'node:fs/promises';

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function csvEscape(field: unknown): string {
  const s = String(field ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function retryCode(err: unknown): string | number | undefined {
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    if (typeof e.code === 'string' || typeof e.code === 'number') return e.code;
    if (typeof e.status === 'number') return e.status;
    const resp = e.response as Record<string, unknown> | undefined;
    if (resp && typeof resp.status === 'number') return resp.status;
  }
  return undefined;
}

export function isRetryable(err: unknown): boolean {
  const code = retryCode(err);
  if (code === 429) return true;
  if (typeof code === 'number' && code >= 500 && code < 600) return true;
  if (typeof code === 'string' && ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND'].includes(code))
    return true;
  return false;
}

function errCode(err: unknown): string | undefined {
  return err instanceof Error && 'code' in err ? String((err as NodeJS.ErrnoException).code) : undefined;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function countSentInFile(logPath: string, today: string): Promise<number> {
  try {
    const content = await fs.readFile(logPath, 'utf8');
    let count = 0;
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      if (line.startsWith('timestamp,')) continue; // header
      const [ts, , status] = line.split(',');
      if (status === 'sent' && ts.startsWith(today)) count++;
    }
    return count;
  } catch (err) {
    if (errCode(err) === 'ENOENT') return 0;
    console.error(`Warning: could not read ${logPath}: ${errMessage(err)}`);
    return 0;
  }
}

/**
 * Count today's sent rows across the canonical + legacy log paths
 * so the daily-limit guard keeps working after the restructure.
 */
export async function countSentToday(...logPaths: string[]): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  let total = 0;
  for (const p of logPaths) total += await countSentInFile(p, today);
  return total;
}
