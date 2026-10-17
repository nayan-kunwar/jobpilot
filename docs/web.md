# Web (`@apps/web`)

Local Next.js dashboard that runs alongside the CLI and edits the **same files**
(`apps/cli/config.json`, `data/body.txt`, `data/emails.txt`, `assets/`). It is
preview-first: composing happens in the browser, **sending stays in the CLI**.

Local only — the server reads and writes files on your machine; don't expose it.

## Use

```bash
npx nx run @apps/web:dev     # dev server, hot reload — http://localhost:3000
npx nx run @apps/web:build   # production build → apps/web/.next/
npx nx run @apps/web:start   # serve the production build
npx nx run @apps/web:test    # vitest + jsdom + testing-library
```

## Pages

| Page      | What it does                                                                                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard | Sent today vs daily limit, recipient count (+ duplicates), resume/token health, the 8 most recent log rows                                                     |
| Compose   | Subject / from / resume picker, cover letter with **live `**bold**` preview** (HTML + plain-text tabs), recipient list with live count, review panel, **Save** |
| Logs      | Stub — full table in a later phase (raw CSV: `apps/cli/logs/sent_log.csv`)                                                                                     |
| Settings  | Stub — edit `apps/cli/config.json` for now (the dashboard picks changes up on reload)                                                                          |

## Compose → send flow

Pressing **Save** on Compose writes three files:

| Your edit               | Written to                                                 |
| ----------------------- | ---------------------------------------------------------- |
| subject / from / resume | `apps/cli/config.json` (merged — keeps delayMs/dailyLimit) |
| cover letter            | `apps/cli/data/body.txt`                                   |
| recipients              | `apps/cli/data/emails.txt`                                 |

Then send from the terminal (flag paths are relative to `apps/cli/`):

```bash
npm run dry  -- --body-file data/body.txt   # verify first
npm run live -- --body-file data/body.txt   # real send
```

## How it finds the CLI files

`apps/web/lib/cli-paths.ts` resolves the CLI root as `../cli` relative to the web
app (Nx runs scripts with `cwd = apps/web`). Override with `CLI_DATA_DIR` when
running from somewhere else:

```bash
CLI_DATA_DIR=/absolute/path/to/cli npx nx run @apps/web:dev
```

## Code layout

- `app/` — App Router pages + `actions.ts` (`saveCompose` server action); data
  pages use `export const dynamic = 'force-dynamic'` so nothing is baked in at
  build time
- `components/` — `Nav`, `ui` (Card/Stat/StatusPill), `ComposeClient` (the
  interactive editor)
- `lib/store.ts` — server-side reads (config, body, list, resumes, log, token
  status); `lib/cli-paths.ts` — path resolution
- `test/` — vitest suites: store (temp fixture dir via `CLI_DATA_DIR`) and
  ComposeClient (preview, dedupe count, save)

Pure mail logic is imported from [`@packages/email-core`](../packages/email-core):
`renderBody` is the same `**bold**` renderer the CLI sends with, and `parseEmails`
parses/dedupes the recipient list. Client components import subpaths
(`@packages/email-core/body`, `/emails`) so they never pull in the barrel's
Node-only code.

## Not built yet (deferred)

- Sending from the browser (`npm run live` still owns the actual send)
- Full log table + filters on `/logs`
- Settings UI (delay, daily limit, paths)
- "Reconnect Gmail" button (still `npm run auth`)
