/** Builtin cover letter used when no body file exists. */
export const DEFAULT_BODY = `Dear Hiring Team,

I am writing to apply for the Backend Developer position at your organization.

I have over 2+ years of hands-on experience building secure and scalable backend systems using Node.js, TypeScript, PostgreSQL/MongoDB, Redis, Kafka, and Docker. I also have experience working with event-driven architecture (EDA) and designing asynchronous, scalable backend services.

I've attached my resume for your review. I would appreciate the opportunity to discuss the Backend Developer role.

Thank you for your time and consideration. I look forward to hearing from you.

Best regards,

Your Name
+91-XXXXXXXXXX
LinkedIn: https://www.linkedin.com/in/your-handle/
GitHub: https://github.com/your-handle`;

/** Scalar defaults shared by the CLI and the web dashboard. */
export const DEFAULT_FROM = 'Your Name <you@gmail.com>';
export const DEFAULT_SUBJECT = 'Job Application';
/** Resume path relative to the app root (CLI resolves it against APP_ROOT). */
export const DEFAULT_RESUME_REL = './assets/resume.pdf';
export const DEFAULT_DELAY_MS = 5000; // pause between emails so Gmail doesn't flag you
export const DEFAULT_DAILY_LIMIT = 450; // Gmail ~500/day for normal accounts; stay under it

/** Gmail's hard attachment limit (25 MB). */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
/** Backoff schedule for retryable send errors (ms) — one wait per retry, 3 retries total. */
export const RETRY_DELAYS = [2000, 8000, 30000];
