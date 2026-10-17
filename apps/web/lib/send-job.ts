/**
 * In-memory send job for the dashboard (localhost, single user, one process).
 *
 * Wraps the shared engine (@packages/email-core/sender) with everything the UI
 * needs: up-front validation, a per-recipient progress snapshot the /api/send
 * routes return, and cooperative stop. The job lives in the Next server
 * process, so restarting (`next dev` source edits) kills a run in progress —
 * the log keeps whatever was already sent.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { MAX_ATTACHMENT_BYTES, countSentToday } from '@packages/email-core';
import {
  SendError,
  resolveSendInputs,
  runSend,
  type ResolvedSendInputs,
  type SendEvent,
  type SendTransport,
} from '@packages/email-core/sender';
import { cliRoot, legacyLogPath, listPath, logPath, tokenPath } from './cli-paths';
import { readBody, readConfig } from './store';
import type { RecipientState, SendJobSnapshot, SendLogLine, SendStartResult, SendStopResult } from './types';

const LINES_LIMIT = 200;

interface ActiveJob {
  snapshot: SendJobSnapshot;
  stopRequested: boolean;
}

/** Test seam: unit tests inject a fake transport and skip real waits. */
interface TestDeps {
  transport?: SendTransport;
  sleep?: (ms: number) => Promise<void>;
  retryDelays?: number[];
}

let job: ActiveJob | null = null;
let testDeps: TestDeps = {};

/** Override engine dependencies (tests only; call with null to reset). */
export function __setSendJobTestDeps(deps: TestDeps | null): void {
  testDeps = deps ?? {};
}

function idleSnapshot(): SendJobSnapshot {
  return {
    state: 'idle',
    phase: null,
    startedAt: null,
    finishedAt: null,
    total: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    stopping: false,
    currentTo: null,
    error: null,
    logPath: null,
    recipients: [],
    lines: [],
  };
}

/** Current progress: idle before the first run, the last run's result after. */
export function getSendSnapshot(): SendJobSnapshot {
  return job ? job.snapshot : idleSnapshot();
}

function addLine(snapshot: SendJobSnapshot, kind: SendLogLine['kind'], text: string, to?: string): void {
  snapshot.lines.push({ at: new Date().toISOString(), kind, text, ...(to ? { to } : {}) });
  if (snapshot.lines.length > LINES_LIMIT) snapshot.lines.shift();
}

function setRecipient(snapshot: SendJobSnapshot, index: number, patch: Partial<RecipientState>): void {
  const current = snapshot.recipients[index];
  if (current) snapshot.recipients[index] = { ...current, ...patch };
}

function applyEvent(active: ActiveJob, event: SendEvent): void {
  const s = active.snapshot;
  switch (event.type) {
    case 'email-start':
      s.currentTo = event.to;
      setRecipient(s, event.index, { status: 'sending' });
      break;
    case 'email-sent':
      s.currentTo = null;
      setRecipient(s, event.index, { status: 'sent', detail: event.messageId ?? '' });
      addLine(s, 'sent', `Sent ${event.to}${event.messageId ? ` (${event.messageId})` : ''}`, event.to);
      break;
    case 'email-retry':
      setRecipient(s, event.index, {
        status: 'sending',
        detail: `attempt ${event.attempt} failed — retrying`,
      });
      addLine(
        s,
        'retry',
        `${event.to}: attempt ${event.attempt} failed (${event.error}) — retrying in ${Math.round(event.waitMs / 1000)}s`,
        event.to,
      );
      break;
    case 'email-failed':
      s.currentTo = null;
      setRecipient(s, event.index, { status: 'failed', detail: event.error });
      addLine(s, 'failed', `Failed ${event.to}: ${event.error}`, event.to);
      break;
    case 'emails-truncated':
      for (let i = event.allowed; i < s.recipients.length; i++) {
        setRecipient(s, i, { status: 'skipped', detail: 'daily limit' });
      }
      addLine(
        s,
        'truncated',
        `Daily limit: sending ${event.allowed} of ${event.requested} (${event.sentToday}/${event.dailyLimit} already sent today).`,
      );
      break;
    case 'run-end':
      s.sent = event.sent;
      s.failed = event.failed;
      if (event.aborted) {
        for (let i = 0; i < s.recipients.length; i++) {
          const status = s.recipients[i].status;
          if (status === 'pending' || status === 'sending') {
            setRecipient(s, i, { status: 'skipped', detail: 'stopped' });
          }
        }
      }
      s.skipped = s.recipients.filter((r) => r.status === 'skipped').length;
      addLine(
        s,
        event.aborted ? 'stopped' : 'done',
        event.aborted
          ? `Stopped: ${event.sent} sent, ${event.failed} failed, ${event.skipped} skipped.`
          : `Done: ${event.sent} sent, ${event.failed} failed.`,
      );
      break;
  }
}

async function executeSend(active: ActiveJob, inputs: ResolvedSendInputs): Promise<void> {
  const s = active.snapshot;
  try {
    const result = await runSend({
      ...inputs,
      logPath: logPath(),
      legacyLogPath: legacyLogPath(),
      credentialsPath: path.join(cliRoot(), 'credentials.json'),
      tokenPath: tokenPath(),
      transport: testDeps.transport,
      sleep: testDeps.sleep,
      retryDelays: testDeps.retryDelays,
      shouldStop: () => active.stopRequested,
      onEvent: (event) => applyEvent(active, event),
    });
    s.phase = result.aborted ? 'aborted' : 'done';
  } catch (err) {
    s.phase = 'error';
    s.error = err instanceof Error ? err.message : String(err);
    addLine(s, 'error', s.error);
  } finally {
    s.state = 'finished';
    s.stopping = false;
    s.finishedAt = new Date().toISOString();
    s.currentTo = null;
  }
}

/**
 * Validate and start a send batch. Returns 400 with a message the UI can show
 * when the inputs are not sendable, 409 when a batch is already running.
 */
export async function startSend(): Promise<SendStartResult> {
  if (job?.snapshot.state === 'running') {
    return { ok: false, status: 409, error: 'A send is already running. Stop it or wait for it to finish.' };
  }

  const [config, body] = await Promise.all([readConfig(), readBody()]);
  let inputs: ResolvedSendInputs;
  try {
    inputs = await resolveSendInputs({
      listFile: listPath(),
      config,
      baseDir: cliRoot(),
      bodyText: body,
    });
  } catch (err) {
    if (err instanceof SendError) return { ok: false, status: 400, error: err.message };
    throw err;
  }

  // Resume must exist and fit under Gmail's limit (the engine would fail later anyway).
  try {
    const stat = await fs.stat(inputs.resumePath);
    if (stat.size > MAX_ATTACHMENT_BYTES) {
      return {
        ok: false,
        status: 400,
        error: `Resume "${inputs.resumePath}" is ${(stat.size / 1024 / 1024).toFixed(1)}MB, over Gmail's 25MB limit.`,
      };
    }
  } catch {
    return {
      ok: false,
      status: 400,
      error: `Resume "${inputs.resumePath}" not found — pick one in Compose.`,
    };
  }

  // Gmail connection: env override wins, same as the engine.
  if (!process.env.GMAIL_TOKEN_JSON) {
    try {
      await fs.access(tokenPath());
    } catch {
      return {
        ok: false,
        status: 400,
        error: 'Gmail is not connected (no token.json). Run "npm run auth", then try again.',
      };
    }
  }

  // Refuse when nothing remains today (the engine re-checks at run time).
  const sentToday = await countSentToday(logPath(), legacyLogPath());
  if (sentToday >= inputs.dailyLimit) {
    return {
      ok: false,
      status: 400,
      error: `Daily limit reached: ${sentToday}/${inputs.dailyLimit} already sent today.`,
    };
  }

  const snapshot: SendJobSnapshot = {
    state: 'running',
    phase: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    total: inputs.emails.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    stopping: false,
    currentTo: null,
    error: null,
    logPath: logPath(),
    recipients: inputs.emails.map((to) => ({ to, status: 'pending' as const })),
    lines: [],
  };
  const active: ActiveJob = { snapshot, stopRequested: false };
  job = active;
  void executeSend(active, inputs);
  return { ok: true, total: inputs.emails.length };
}

/** Ask the running batch to stop after the current email (cooperative stop). */
export function stopSend(): SendStopResult {
  if (!job || job.snapshot.state !== 'running') {
    return { ok: false, status: 409, error: 'No send is running.' };
  }
  job.stopRequested = true;
  job.snapshot.stopping = true;
  return { ok: true };
}
