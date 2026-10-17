# Web (`@apps/web`)

Local Next.js dashboard that runs alongside the CLI and edits the **same files**
(`apps/cli/config.json`, `data/body.txt`, `data/emails.txt`, `assets/`). Compose
in the browser and either **send right from the dashboard** or hand the same
files to the CLI.

Local only — the server reads and writes files on your machine and sends from
your Gmail account; don't expose it.

## Use

```bash
npx nx run @apps/web:dev     # dev server, hot reload — http://localhost:3000
npx nx run @apps/web:build   # production build → apps/web/.next/
npx nx run @apps/web:start   # serve the production build
npx nx run @apps/web:test    # vitest + jsdom + testing-library
npm start                    # same as @apps/web:start, from the repo root
```

## Pages

| Page      | What it does                                                                                                                                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard | Sent today vs daily limit, recipient count (+ duplicates), resume/token health, a live **"Sending now"** banner with stop, the 8 most recent log rows                                                            |
| Compose   | Subject / from / resume picker, cover letter with **live `**bold**` preview** (HTML + plain-text tabs), recipient list with live count, review panel, **Save** and **Send now** (confirm dialog → live progress) |
| Logs      | Stub — full table in a later phase (raw CSV: `apps/cli/logs/sent_log.csv`)                                                                                                                                       |
| Settings  | Stub — edit `apps/cli/config.json` for now (the dashboard picks changes up on reload)                                                                                                                            |

## Send from the UI

**Send now** on Compose saves the three files first, then opens a confirmation
dialog (recipients, subject, from, resume, remaining daily budget, estimated
time). Confirming starts a single batch through the **same engine the CLI
uses**: input validation (token, recipients, body, resume ≤ 25 MB), daily-limit
guard + truncation, retry with backoff on 429/5xx, jittered 5 s pacing, and
CSV log rows appended per email.

Compose then shows a live progress panel — per-recipient states (pending →
sending → sent/failed/skipped), an event ticker, summary counts, and **Stop**
(finishes the current email, then halts). While a batch runs, the dashboard
shows a banner with a Stop button.

Rules and caveats:

- **One batch at a time** — starting a second returns 409 while one is running.
- The job lives in the Next server process: editing source files under
  `next dev` restarts the server and **kills a run in progress**. Keep batches
  short in dev, or use `build` + `start` (`npm run build && npm start` from the
  repo root) for real runs.
- Rows are logged as they are sent, so an interrupted run loses nothing.
- The daily limit is enforced server-side; if the list exceeds the remaining
  budget, the overflow is marked _skipped (daily limit)_.
- Token problems surface as "run `npm run auth`" — reconnecting from the UI is
  not built yet.
- Progress is polled (1 s); closing the tab does not stop the batch.

Sending from the terminal still works exactly as before (flag paths are
relative to `apps/cli/`):

```bash
npm run dry  -- --body-file data/body.txt   # verify first
npm run live -- --body-file data/body.txt   # real send
```

## Save writes three files

| Your edit               | Written to                                                 |
| ----------------------- | ---------------------------------------------------------- |
| subject / from / resume | `apps/cli/config.json` (merged — keeps delayMs/dailyLimit) |
| cover letter            | `apps/cli/data/body.txt`                                   |
| recipients              | `apps/cli/data/emails.txt`                                 |

## Local send API

| Route              | Method | Behaviour                                                            |
| ------------------ | ------ | -------------------------------------------------------------------- |
| `/api/send`        | POST   | start a batch; `400` + reason when not sendable, `409` while running |
| `/api/send`        | DELETE | cooperative stop (finish the current email)                          |
| `/api/send/status` | GET    | job snapshot for polling (idle / running / finished)                 |

## How it finds the CLI files

`apps/web/lib/cli-paths.ts` resolves the CLI root as `../cli` relative to the web
app (Nx runs scripts with `cwd = apps/web`). Override with `CLI_DATA_DIR` when
running from somewhere else:

```bash
CLI_DATA_DIR=/absolute/path/to/cli npx nx run @apps/web:dev
```

## Code layout

- `app/` — App Router pages + `actions.ts` (`saveCompose` server action); data
  pages and API routes use `export const dynamic = 'force-dynamic'` so nothing
  is baked in at build time
- `app/api/send/` — POST/DELETE `/api/send` and GET `/api/send/status`
- `components/` — `Nav`, `ui` (Card/Stat/StatusPill), `ComposeClient` (editor +
  confirm dialog), `SendPanel` (progress), `SendBanner` (dashboard)
- `lib/store.ts` — server-side reads (config, body, list, resumes, log, token
  status); `lib/cli-paths.ts` — path resolution; `lib/send-job.ts` — the
  in-memory send job (preflight validation, engine wiring, progress snapshot)
- `test/` — vitest: store, send-job (fake transport, no Gmail), send routes
  (real handlers), and component tests with mocked fetch

Pure mail logic is imported from [`@packages/email-core`](../packages/email-core):
`renderBody` is the same `**bold**` renderer the CLI sends with, and `parseEmails`
parses/dedupes the recipient list. The send engine itself lives in the
server-only subpath `@packages/email-core/sender` — the CLI and the dashboard
run the exact same pipeline. Client components import subpaths
(`@packages/email-core/body`, `/emails`) so they never pull in Node-only code.

## Not built yet (deferred)

- Full log table + filters on `/logs`
- Settings UI (delay, daily limit, paths)
- "Reconnect Gmail" button (still `npm run auth`)
- Job state that survives a server restart
