/** Shared shapes between server (store/actions) and client components. */

export interface CliConfig {
  from: string;
  subject: string;
  resume: string;
  delayMs: number;
  dailyLimit: number;
}

export interface ResumeFile {
  name: string;
  size: number;
}

export interface LogRow {
  timestamp: string;
  to: string;
  status: string;
  detail: string;
}

export interface Status {
  sentToday: number;
  dailyLimit: number;
  remaining: number;
  recipients: number;
  dupesRemoved: number;
  subject: string;
  from: string;
  resumeName: string;
  resumeSize: number | null;
  resumeExists: boolean;
  tokenExists: boolean;
  tokenExpiry: number | null;
}

export interface SaveInput {
  subject: string;
  from: string;
  body: string;
  recipients: string;
  resume: string;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  savedAt?: string;
}

/** Per-recipient progress in a running/finished send batch. */
export type RecipientStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';

export interface RecipientState {
  to: string;
  status: RecipientStatus;
  /** Gmail message id (sent) or error/reason (failed/skipped/retry note). */
  detail?: string;
}

/** Human-readable ticker line for the send progress panel. */
export interface SendLogLine {
  at: string; // ISO timestamp
  kind: 'sent' | 'retry' | 'failed' | 'truncated' | 'stopped' | 'done' | 'error';
  to?: string;
  text: string;
}

export interface SendJobSnapshot {
  state: 'idle' | 'running' | 'finished';
  phase: 'running' | 'done' | 'aborted' | 'error' | null;
  startedAt: string | null;
  finishedAt: string | null;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  /** Stop requested; the engine finishes the current email first. */
  stopping: boolean;
  currentTo: string | null;
  error: string | null;
  logPath: string | null;
  recipients: RecipientState[];
  lines: SendLogLine[];
}

export type SendStartResult = { ok: true; total: number } | { ok: false; status: number; error: string };
export type SendStopResult = { ok: true } | { ok: false; status: number; error: string };
