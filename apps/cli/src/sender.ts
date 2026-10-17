// CLI adapter over the shared send engine (@packages/email-core/sender):
// resolves args/config into send inputs, renders engine events to the console
// with the exact output this CLI always had, and maps SendError kinds to
// exit codes: 2 = bad input file/body/resume, 3 = daily limit, 4 = auth.
import fs from 'node:fs/promises';
import path from 'node:path';
import { MAX_ATTACHMENT_BYTES } from '@packages/email-core';
import {
  SendError,
  resolveSendInputs,
  runSend,
  type ResolvedSendInputs,
  type SendErrorKind,
  type SendEvent,
  type SendRunResult,
} from '@packages/email-core/sender';
import { APP_ROOT, LEGACY_LOG_PATH, LOG_PATH, type CliOptions } from './constants.js';
import { loadConfig } from './config.js';

const EXIT_CODES: Record<SendErrorKind, number> = {
  list: 2,
  'no-recipients': 2,
  body: 2,
  resume: 2,
  auth: 4,
  'daily-limit': 3,
};

function fail(err: unknown): never {
  if (err instanceof SendError) {
    console.error(err.message);
    process.exit(EXIT_CODES[err.kind]);
  }
  throw err;
}

export async function run(opts: CliOptions): Promise<void> {
  // --json implies --quiet: machine output only (errors on stderr, summary on stdout)
  const terse = opts.quiet || opts.json;
  const say = (...parts: unknown[]): void => {
    if (!terse) console.log(...parts);
  };
  const configPathAbs = path.isAbsolute(opts.configPath)
    ? opts.configPath
    : path.join(process.cwd(), opts.configPath);
  const config = await loadConfig(configPathAbs);

  let inputs: ResolvedSendInputs;
  try {
    inputs = await resolveSendInputs({
      listFile: opts.listFile,
      config,
      baseDir: path.dirname(configPathAbs),
      limit: opts.limit,
      bodyFile: opts.bodyFile,
      overrides: {
        from: opts.from,
        subject: opts.subject,
        resume: opts.resume,
        delayMs: opts.delayMs,
        dailyLimit: opts.dailyLimit,
      },
    });
  } catch (err) {
    fail(err);
  }

  // --- dry-run: exit BEFORE Gmail auth / PDF load (only cheap stat check) ---
  if (opts.dryRun) {
    try {
      const stat = await fs.stat(inputs.resumePath);
      if (stat.size > MAX_ATTACHMENT_BYTES) {
        console.error(
          `Warning: resume "${inputs.resumePath}" is ${(stat.size / 1024 / 1024).toFixed(1)}MB, over Gmail's 25MB limit.`,
        );
      }
    } catch {
      console.error(`Warning: resume file "${inputs.resumePath}" not found (would fail on real send).`);
    }
    say(
      `From: ${inputs.from}\nSubject: ${inputs.subject}\nResume: ${inputs.resumePath}\nDelay: ${inputs.delayMs}ms (+jitter)\nDaily limit: ${inputs.dailyLimit}`,
    );
    inputs.emails.forEach((to, i) => say(`[dry-run] ${i + 1}/${inputs.emails.length} ${to}`));
    if (opts.json) {
      console.log(
        JSON.stringify({
          dryRun: true,
          total: inputs.emails.length,
          subject: inputs.subject,
          listFile: inputs.listFile,
        }),
      );
    } else {
      say(`Done: ${inputs.emails.length} addresses (dry run, nothing sent)`);
    }
    return;
  }

  const onEvent = (e: SendEvent): void => {
    switch (e.type) {
      case 'emails-truncated':
        console.error(
          `Warning: truncating run from ${e.requested} to ${e.allowed} to stay within daily limit ${e.dailyLimit} (${e.sentToday} already sent today).`,
        );
        break;
      case 'email-sent':
        say(`✔ ${e.index + 1}/${e.total} ${e.to} (${e.messageId})`);
        break;
      case 'email-retry':
        console.error(`↻ ${e.to}: attempt ${e.attempt} failed (${e.error}). Retrying in ${e.waitMs}ms…`);
        break;
      case 'email-failed':
        console.error(`✘ ${e.to}: ${e.error}`);
        break;
      default:
        break; // email-start / run-end are for interactive callers
    }
  };

  let result: SendRunResult;
  try {
    result = await runSend({
      ...inputs,
      logPath: LOG_PATH,
      legacyLogPath: LEGACY_LOG_PATH,
      credentialsPath: path.join(APP_ROOT, 'credentials.json'),
      tokenPath: path.join(APP_ROOT, 'token.json'),
      onEvent,
    });
  } catch (err) {
    fail(err);
  }

  if (opts.json) {
    console.log(
      JSON.stringify({
        dryRun: false,
        total: result.total,
        sent: result.sent,
        failed: result.failed,
        logPath: LOG_PATH,
      }),
    );
  } else {
    console.log(`Done: ${result.total} addresses`);
  }
}
