import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_BODY,
  LEGACY_LOG_PATH,
  LOG_PATH,
  MAX_ATTACHMENT_BYTES,
  RETRY_DELAYS,
  APP_ROOT,
  type CliOptions,
} from './constants.js';
import { loadConfig } from './config.js';
import { parseEmails } from './args.js';
import { createGmailClient } from './gmail.js';
import { buildMime } from './mime.js';
import { appendLog } from './logger.js';
import { countSentToday, csvEscape, isRetryable, sleep } from './utils.js';

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Resolve p against baseDir unless already absolute (config-file paths anchor to the app). */
function resolveFrom(baseDir: string, p: string): string {
  return path.isAbsolute(p) ? p : path.join(baseDir, p);
}

export async function run(opts: CliOptions): Promise<void> {
  const configPathAbs = path.isAbsolute(opts.configPath)
    ? opts.configPath
    : path.join(process.cwd(), opts.configPath);
  const config = await loadConfig(configPathAbs);
  const configDir = path.dirname(configPathAbs);
  const FROM = opts.from ?? config.from;
  const SUBJECT = opts.subject ?? config.subject;
  // CLI --resume stays cwd-relative (explicit user path); config resume anchors to the config dir
  const RESUME = opts.resume ?? resolveFrom(configDir, config.resume);
  const DELAY_MS = opts.delayMs ?? config.delayMs;
  const DAILY_LIMIT = opts.dailyLimit ?? config.dailyLimit;

  // read + clean + dedupe addresses (handles "Name <a@b.com>", commas, semicolons)
  let text: string;
  try {
    text = await fs.readFile(opts.listFile, 'utf8');
  } catch (err) {
    console.error(`Cannot read list file "${opts.listFile}": ${errMessage(err)}`);
    process.exit(2);
  }
  let emails = parseEmails(text);
  if (emails.length === 0) {
    console.error(`No email addresses found in "${opts.listFile}".`);
    process.exit(2);
  }

  // --limit caps this run
  if (opts.limit != null) emails = emails.slice(0, opts.limit);

  // load body (local file, safe for dry-run)
  let BODY = DEFAULT_BODY;
  if (opts.bodyFile) {
    try {
      BODY = (await fs.readFile(opts.bodyFile, 'utf8')).trim();
      if (!BODY) {
        console.error(`Body file "${opts.bodyFile}" is empty.`);
        process.exit(2);
      }
    } catch (err) {
      console.error(`Cannot read body file "${opts.bodyFile}": ${errMessage(err)}`);
      process.exit(2);
    }
  }

  // --- dry-run: exit BEFORE Gmail auth / PDF load (only cheap stat check) ---
  if (opts.dryRun) {
    try {
      const stat = await fs.stat(RESUME);
      if (stat.size > MAX_ATTACHMENT_BYTES) {
        console.error(
          `Warning: resume "${RESUME}" is ${(stat.size / 1024 / 1024).toFixed(1)}MB, over Gmail's 25MB limit.`,
        );
      }
    } catch {
      console.error(`Warning: resume file "${RESUME}" not found (would fail on real send).`);
    }
    console.log(
      `From: ${FROM}\nSubject: ${SUBJECT}\nResume: ${RESUME}\nDelay: ${DELAY_MS}ms (+jitter)\nDaily limit: ${DAILY_LIMIT}`,
    );
    emails.forEach((to, i) => console.log(`[dry-run] ${i + 1}/${emails.length} ${to}`));
    console.log(`Done: ${emails.length} addresses (dry run, nothing sent)`);
    return;
  }

  // --- daily-limit guard (real send only; counts new + legacy log) ---
  const sentToday = await countSentToday(LOG_PATH, LEGACY_LOG_PATH);
  if (sentToday >= DAILY_LIMIT) {
    console.error(`Daily limit reached: ${sentToday}/${DAILY_LIMIT} already sent today. Aborting. See ${LOG_PATH}.`);
    process.exit(3);
  }
  const remaining = DAILY_LIMIT - sentToday;
  if (emails.length > remaining) {
    console.error(
      `Warning: truncating run from ${emails.length} to ${remaining} to stay within daily limit ${DAILY_LIMIT} (${sentToday} already sent today).`,
    );
    emails = emails.slice(0, remaining);
  }

  // --- auth (with clear errors; absolute app-root defaults so Nx cwd doesn't matter) ---
  let gmail;
  try {
    gmail = await createGmailClient({
      credentialsPath: path.join(APP_ROOT, 'credentials.json'),
      tokenPath: path.join(APP_ROOT, 'token.json'),
    });
  } catch (err) {
    console.error(`Auth failed: ${errMessage(err)}`);
    process.exit(4);
  }

  // --- resume load + validation ---
  let pdf: string;
  let fileName: string;
  try {
    const buf = await fs.readFile(RESUME);
    if (buf.length > MAX_ATTACHMENT_BYTES) {
      console.error(`Resume "${RESUME}" is ${(buf.length / 1024 / 1024).toFixed(1)}MB, over Gmail's 25MB limit.`);
      process.exit(2);
    }
    pdf = buf.toString('base64').replace(/.{76}/g, '$&\r\n');
    fileName = path.basename(RESUME);
  } catch (err) {
    console.error(`Cannot read resume "${RESUME}": ${errMessage(err)}`);
    process.exit(2);
  }

  // --- send loop with retry + jittered delay ---
  const log: string[] = [];
  for (const [i, to] of emails.entries()) {
    let sent = false;
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= RETRY_DELAYS.length + 1; attempt++) {
      try {
        const raw = Buffer.from(
          buildMime({ to, from: FROM, subject: SUBJECT, body: BODY, pdfBase64: pdf, fileName }),
        ).toString('base64url');
        const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
        console.log(`✔ ${i + 1}/${emails.length} ${to} (${res.data.id})`);
        log.push([new Date().toISOString(), to, 'sent', res.data.id].map(csvEscape).join(','));
        sent = true;
        break;
      } catch (err) {
        lastErr = err;
        if (attempt <= RETRY_DELAYS.length && isRetryable(err)) {
          const wait = RETRY_DELAYS[attempt - 1] + Math.floor(Math.random() * 1000);
          console.error(`↻ ${to}: attempt ${attempt} failed (${errMessage(err)}). Retrying in ${wait}ms…`);
          await sleep(wait);
        } else {
          break;
        }
      }
    }
    if (!sent) {
      console.error(`✘ ${to}: ${errMessage(lastErr)}`);
      log.push([new Date().toISOString(), to, 'failed', errMessage(lastErr) || 'unknown error'].map(csvEscape).join(','));
    }
    // jittered inter-email pause so Gmail doesn't flag you
    if (i < emails.length - 1) await sleep(DELAY_MS + Math.floor(Math.random() * 2000));
  }

  await appendLog(LOG_PATH, log);
  console.log(`Done: ${emails.length} addresses`);
}
