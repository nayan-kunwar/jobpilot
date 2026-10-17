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
