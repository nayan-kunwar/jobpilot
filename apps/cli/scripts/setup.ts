#!/usr/bin/env tsx
// First-run setup: copy tracked examples to gitignored local paths (never overwrites).
// Run: npm run setup  (repo root)  or  tsx ./scripts/setup.ts  (inside apps/cli)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url));

const PAIRS: Array<[example: string, target: string, hint: string]> = [
  ['config/default.json', 'config.json', 'edit "from" and "subject" for yourself'],
  ['data/emails.example.txt', 'data/emails.txt', 'replace with real addresses'],
];

async function main(): Promise<void> {
  let created = 0;
  for (const [exampleRel, targetRel, hint] of PAIRS) {
    const example = path.join(APP_ROOT, exampleRel);
    const target = path.join(APP_ROOT, targetRel);
    try {
      await fs.access(target);
      console.log(`keep    ${targetRel} (already exists)`);
    } catch {
      try {
        await fs.copyFile(example, target);
        created++;
        console.log(`created ${targetRel} from ${exampleRel} — ${hint}`);
      } catch (err) {
        console.error(
          `setup failed: cannot read example "${exampleRel}": ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }
    }
  }

  console.log(created === 0 ? 'setup: nothing to do.' : `setup: created ${created} file(s).`);
  console.log('next: npm run auth  →  put your PDF at apps/cli/assets/resume.pdf  →  npm run dry');
}

void main();
