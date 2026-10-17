export { renderBody, type RenderedBody } from './body.js';
export { buildMime, type MimeParts } from './mime.js';
export { parseEmails } from './emails.js';
export { countSentToday, csvEscape, isRetryable, sleep, LOG_HEADER } from './utils.js';
export {
  DEFAULT_BODY,
  DEFAULT_FROM,
  DEFAULT_SUBJECT,
  DEFAULT_RESUME_REL,
  DEFAULT_DELAY_MS,
  DEFAULT_DAILY_LIMIT,
  MAX_ATTACHMENT_BYTES,
  RETRY_DELAYS,
} from './defaults.js';
// The send engine (./sender) is a server-only subpath: it pulls in googleapis
// via a lazy import, so it is intentionally NOT re-exported from this barrel.
