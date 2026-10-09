import fs from 'node:fs/promises';
import path from 'node:path';
import { LOG_HEADER } from './constants.js';

/** Append rows to the CSV log, creating parent dirs + header for new/empty files. */
export async function appendLog(logPath: string, rows: string[]): Promise<void> {
  if (!rows.length) return;
  let needsHeader = false;
  try {
    const stat = await fs.stat(logPath);
    needsHeader = stat.size === 0;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      needsHeader = true;
      await fs.mkdir(path.dirname(logPath), { recursive: true });
    } else throw err;
  }
  await fs.appendFile(logPath, (needsHeader ? LOG_HEADER + '\n' : '') + rows.join('\n') + '\n');
}
