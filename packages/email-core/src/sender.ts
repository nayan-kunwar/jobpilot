/**
 * Shared send pipeline for the CLI and the web dashboard.
 *
 * The engine is transport-agnostic: callers inject a `SendTransport` in tests,
 * everything else (daily-limit guard, resume validation, retry/backoff,
 * jittered pacing, CSV logging) behaves exactly like the CLI always did.
 * It never calls `process.exit` — failures throw `SendError` with a `kind`
 * the caller maps to an exit code (CLI) or a UI message (web).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildMime } from './mime.js';
import { parseEmails } from './emails.js';
import { DEFAULT_BODY, MAX_ATTACHMENT_BYTES, RETRY_DELAYS } from './defaults.js';
import { countSentToday, csvEscape, isRetryable, sleep } from './utils.js';
import { appendLog } from './logger.js';

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export type SendErrorKind = 'list' | 'no-recipients' | 'body' | 'resume' | 'auth' | 'daily-limit';

/** A send-pipeline failure with a kind callers map to exit codes / UI errors. */
export class SendError extends Error {
  constructor(
    message: string,
    readonly kind: SendErrorKind,
  ) {
    super(message);
    this.name = 'SendError';
  }
}

export interface SendConfigValues {
  from: string;
  subject: string;
  resume: string;
  delayMs: number;
  dailyLimit: number;
}

export interface ResolveSendInputsOptions {
  /** Address list file (absolute recommended). */
  listFile: string;
  /** Loaded config values (CLI config.json or web equivalent). */
  config: SendConfigValues;
  /** Base dir for resolving a relative config resume path (its config file's dir). */
  baseDir: string;
  /** Cap this run to the first N addresses. */
  limit?: number | null;
  /** Body file; when absent the builtin body is used. */
  bodyFile?: string | null;
  /** Per-field overrides (CLI flags / web form). A resume override resolves against cwd. */
  overrides?: {
    from?: string | null;
    subject?: string | null;
    resume?: string | null;
    delayMs?: number | null;
    dailyLimit?: number | null;
  };
}

export interface ResolvedSendInputs {
  emails: string[];
  from: string;
  subject: string;
  resumePath: string;
  body: string;
  delayMs: number;
  dailyLimit: number;
  listFile: string;
  bodyFile: string | null;
}

/** Resolve p against baseDir unless already absolute (config-file paths anchor to their dir). */
function resolveFrom(baseDir: string, p: string): string {
  return path.isAbsolute(p) ? p : path.join(baseDir, p);
}

/** Read + parse the list file and body file, apply `limit`, and merge overrides. */
export async function resolveSendInputs(o: ResolveSendInputsOptions): Promise<ResolvedSendInputs> {
  let text: string;
  try {
    text = await fs.readFile(o.listFile, 'utf8');
  } catch (err) {
    throw new SendError(`Cannot read list file "${o.listFile}": ${errMessage(err)}`, 'list');
  }
  let emails = parseEmails(text);
  if (emails.length === 0) {
    throw new SendError(`No email addresses found in "${o.listFile}".`, 'no-recipients');
  }
  if (o.limit != null) emails = emails.slice(0, o.limit);

  let body = DEFAULT_BODY;
  if (o.bodyFile) {
    try {
      body = (await fs.readFile(o.bodyFile, 'utf8')).trim();
    } catch (err) {
      throw new SendError(`Cannot read body file "${o.bodyFile}": ${errMessage(err)}`, 'body');
    }
    if (!body) throw new SendError(`Body file "${o.bodyFile}" is empty.`, 'body');
  }

  const ov = o.overrides ?? {};
  return {
    emails,
    from: ov.from ?? o.config.from,
    subject: ov.subject ?? o.config.subject,
    resumePath: ov.resume ? path.resolve(ov.resume) : resolveFrom(o.baseDir, o.config.resume),
    body,
    delayMs: ov.delayMs ?? o.config.delayMs,
    dailyLimit: ov.dailyLimit ?? o.config.dailyLimit,
    listFile: o.listFile,
    bodyFile: o.bodyFile ?? null,
  };
}

/** One-message send primitive. The real one wraps the Gmail API; tests fake it. */
export interface SendTransport {
  sendRaw(raw: string): Promise<{ id?: string }>;
}

export type SendEvent =
  | { type: 'email-start'; index: number; total: number; to: string }
  | { type: 'email-sent'; index: number; total: number; to: string; messageId?: string }
  | {
      type: 'email-retry';
      index: number;
      total: number;
      to: string;
      attempt: number;
      error: string;
      waitMs: number;
    }
  | { type: 'email-failed'; index: number; total: number; to: string; error: string }
  | { type: 'emails-truncated'; requested: number; allowed: number; dailyLimit: number; sentToday: number }
  | {
      type: 'run-end';
      total: number;
      sent: number;
      failed: number;
      skipped: number;
      aborted: boolean;
      logPath: string;
    };

export interface SendRunResult {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  aborted: boolean;
  logPath: string;
}

export interface RunSendOptions extends ResolvedSendInputs {
  logPath: string;
  /** Legacy log location, still counted by the daily-limit guard after restructures. */
  legacyLogPath?: string;
  credentialsPath: string;
  tokenPath: string;
  /** Fakes in tests; defaults to the real Gmail API. */
  transport?: SendTransport;
  /** Injected in tests to skip real waiting. */
  sleep?: (ms: number) => Promise<void>;
  /** Cooperative stop: checked between emails (and between retries). */
  shouldStop?: () => boolean;
  onEvent?: (event: SendEvent) => void;
  retryDelays?: number[];
  maxAttachmentBytes?: number;
}

/** Real Gmail transport; googleapis is imported lazily to keep tests/dry-runs light. */
async function defaultTransport(credentialsPath: string, tokenPath: string): Promise<SendTransport> {
  const { createGmailClient } = await import('./gmail.js');
  const gmail = await createGmailClient({
    credentialsPath,
    tokenPath,
    credentialsJson: process.env.GMAIL_CREDENTIALS_JSON,
    tokenJson: process.env.GMAIL_TOKEN_JSON,
  });
  return {
    async sendRaw(raw: string) {
      const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
      return { id: res.data.id ?? undefined };
    },
  };
}

/** Run one send batch: daily-limit guard, auth, resume load, retry loop, CSV log. */
export async function runSend(o: RunSendOptions): Promise<SendRunResult> {
  const emit = o.onEvent ?? ((): void => undefined);
  const pause = o.sleep ?? sleep;
  const retryDelays = o.retryDelays ?? RETRY_DELAYS;
  const maxBytes = o.maxAttachmentBytes ?? MAX_ATTACHMENT_BYTES;
  const stopped = (): boolean => o.shouldStop?.() === true;

  // --- daily-limit guard (counts canonical + legacy log) ---
  const sentToday = await countSentToday(o.logPath, ...(o.legacyLogPath ? [o.legacyLogPath] : []));
  if (sentToday >= o.dailyLimit) {
    throw new SendError(
      `Daily limit reached: ${sentToday}/${o.dailyLimit} already sent today. Aborting. See ${o.logPath}.`,
      'daily-limit',
    );
  }
  let emails = o.emails;
  const remaining = o.dailyLimit - sentToday;
  if (emails.length > remaining) {
    emit({
      type: 'emails-truncated',
      requested: emails.length,
      allowed: remaining,
      dailyLimit: o.dailyLimit,
      sentToday,
    });
    emails = emails.slice(0, remaining);
  }

  // --- auth (env vars win for CI; files for local use) ---
  let transport = o.transport;
  if (!transport) {
    try {
      transport = await defaultTransport(o.credentialsPath, o.tokenPath);
    } catch (err) {
      throw new SendError(`Auth failed: ${errMessage(err)}`, 'auth');
    }
  }

  // --- resume load + validation ---
  let pdf: string;
  let fileName: string;
  try {
    const buf = await fs.readFile(o.resumePath);
    if (buf.length > maxBytes) {
      throw new SendError(
        `Resume "${o.resumePath}" is ${(buf.length / 1024 / 1024).toFixed(1)}MB, over Gmail's 25MB limit.`,
        'resume',
      );
    }
    pdf = buf.toString('base64').replace(/.{76}/g, '$&\r\n');
    fileName = path.basename(o.resumePath);
  } catch (err) {
    if (err instanceof SendError) throw err;
    throw new SendError(`Cannot read resume "${o.resumePath}": ${errMessage(err)}`, 'resume');
  }

  // --- send loop with retry + jittered delay ---
  const total = emails.length;
  let sent = 0;
  let failed = 0;
  let aborted = false;
  for (const [i, to] of emails.entries()) {
    if (stopped()) {
      aborted = true;
      break;
    }
    emit({ type: 'email-start', index: i, total, to });
    let ok = false;
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= retryDelays.length + 1; attempt++) {
      try {
        const raw = Buffer.from(
          buildMime({ to, from: o.from, subject: o.subject, body: o.body, pdfBase64: pdf, fileName }),
        ).toString('base64url');
        const res = await transport.sendRaw(raw);
        await appendLog(o.logPath, [[new Date().toISOString(), to, 'sent', res.id].map(csvEscape).join(',')]);
        emit({ type: 'email-sent', index: i, total, to, messageId: res.id });
        ok = true;
        sent++;
        break;
      } catch (err) {
        lastErr = err;
        if (attempt <= retryDelays.length && isRetryable(err) && !stopped()) {
          const wait = retryDelays[attempt - 1] + Math.floor(Math.random() * 1000);
          emit({ type: 'email-retry', index: i, total, to, attempt, error: errMessage(err), waitMs: wait });
          await pause(wait);
        } else {
          break;
        }
      }
    }
    if (!ok) {
      const message = errMessage(lastErr);
      await appendLog(o.logPath, [
        [new Date().toISOString(), to, 'failed', message || 'unknown error'].map(csvEscape).join(','),
      ]);
      emit({ type: 'email-failed', index: i, total, to, error: message });
      failed++;
    }
    if (i < total - 1) {
      if (stopped()) {
        aborted = true;
        break;
      }
      await pause(o.delayMs + Math.floor(Math.random() * 2000));
    }
  }

  const result: SendRunResult = {
    total,
    sent,
    failed,
    skipped: total - sent - failed,
    aborted,
    logPath: o.logPath,
  };
  emit({ type: 'run-end', ...result });
  return result;
}
