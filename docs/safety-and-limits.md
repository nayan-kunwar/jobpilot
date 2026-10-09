# Safety and limits (`@apps/cli`)

Sending bulk mail from a personal Gmail account can get you rate-limited or
flagged. The CLI has four guardrails — understand them before large runs.

## 1. Daily cap (Gmail ~500/day → we stop at 450)

- Every real send appends to `apps/cli/logs/sent_log.csv`; before sending, the CLI
  counts today's `sent` rows (plus the legacy root `sent_log.csv` for continuity).
- If the count is already ≥ `dailyLimit` (default **450**), it aborts with exit code 3.
- If your list is bigger than the remaining quota, it **truncates with a warning**
  instead of overshooting.
- `--limit <n>` caps a single run further; the effective batch is
  `min(--limit, dailyLimit - sentToday)`.

## 2. Pacing (5 s + jitter)

- Default `delayMs: 5000` between emails, plus up to 2 s random jitter, plus
  exponential backoff (2 s / 8 s / 30 s) on retries.
- Never set `--delay-ms 0` for real sends. For 100+ address lists consider
  `--delay-ms 10000` and splitting across days.

## 3. Retries (transient errors only)

- Up to 3 retries on **retryable** failures: HTTP `429`, any `5xx`, or network
  errors (`ECONNRESET`, `ETIMEDOUT`, `EAI_AGAIN`, `ENOTFOUND`).
- Permanent errors (bad auth, invalid address, oversize attachment) fail fast —
  no pointless retries.

## 4. Audit log (`logs/sent_log.csv`)

Append-only CSV with header (created automatically on first write):

```
timestamp,to,status,detail
2026-10-09T10:31:17.098Z,friend@example.com,sent,abc123exampleid
```

- `status` is `sent` (detail = Gmail message id) or `failed` (detail = error text).
- Fields are CSV-escaped, so commas/quotes in errors can't corrupt the file.
- **Dry-runs never touch the log.** Check the log after every live run:
  any `failed` row tells you exactly what to fix and retry.

## What is NOT protected

- Gmail may still throttle or temporarily restrict unusual sending patterns —
  start small, use `--limit`, and spread large campaigns over days.
- Duplicate addresses across _different_ list files are not skipped (dedupe is
  per-run). The log is your de-facto "already contacted" record — grep it before
  re-sending to overlapping lists.
- `From:` must be your account or a verified Send-As alias, else Gmail rejects
  every message regardless of these guards.
