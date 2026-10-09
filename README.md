# job-apps

Nx + TypeScript monorepo (npm workspaces) for job-application tooling.

## Apps

| App                      | Package     | Description                                                                                            |
| ------------------------ | ----------- | ------------------------------------------------------------------------------------------------------ |
| [`apps/cli`](./apps/cli) | `@apps/cli` | Gmail bulk sender — personalized job-application emails + PDF resume via the Gmail API (commander CLI) |
| [`apps/web`](./apps/web) | `@apps/web` | Next.js web app — empty scaffold, UI comes later                                                       |

Shared code goes in [`packages/`](./packages) when 2+ apps need it.

Full usage docs live in [`docs/`](./docs/README.md) — start with
[Getting started](./docs/getting-started.md).

## Quick start

Requires Node >= 20 (see `.nvmrc`). Install once at the root:

```
npm install
npm run setup  # first time only: creates local config.json + data/emails.txt from examples
```

**CLI (most common):**

```
npm run dry    # dry-run with default list (apps/cli/data/emails.txt) — nothing sent
npm run live   # real send with default list
```

Pass-through extras after `--`:

```
npm run dry -- --limit 5
npm run send -- apps/cli/data/other.txt --subject "Application For Backend Developer"
```

One-time Gmail login for the CLI (creates `apps/cli/token.json`):

```
npm run auth
```

## Full command reference

```
npx nx run @apps/cli:dry              # = npm run dry
npx nx run @apps/cli:send -- --limit 50 --subject "..."
npx nx run @apps/cli:auth
npx nx run-many -t test               # all tests
npx nx run-many -t lint check         # all lints + typechecks
npx nx run @apps/web:dev              # Next.js dev server
npx nx graph                          # project graph
```

## Project structure

```
.
  nx.json                  # task caching (dry/live/send/auth never cached)
  tsconfig.base.json       # strict TS, paths @apps/*
  eslint.config.js / .prettierrc / .editorconfig
  apps/
    cli/                   # @apps/cli — the Gmail bulk sender
      src/                 # index/sender/args/config/gmail/mime/logger/utils/constants/auth (.ts)
      bin/send.ts          # executable entry
      config/default.json  # tracked example config
      config.json          # local config (resume/subject/delay/dailyLimit)
      data/emails.txt      # address list (gitignored; .example.txt is tracked)
      assets/resume.pdf    # resume (gitignored)
      logs/sent_log.csv    # append-only send log (gitignored)
      test/                # vitest suites
    web/                   # @apps/web — empty Next.js scaffold
  packages/                # shared libs (future)
```

## Gmail setup (CLI)

1. Google Cloud Console: create a project, enable the **Gmail API** → OAuth consent screen (External, add yourself as test user) → Credentials → OAuth client ID (**Desktop app**). Save as `apps/cli/credentials.json`.
2. Resume at `apps/cli/assets/resume.pdf` (or set `resume` in `apps/cli/config.json`).
3. `npm install` (root) → `npm run auth` → `npm run dry` → `npm run live`.

Safety: 5s + jitter delay between emails, `dailyLimit` 450 guard, 3x retry on 429/5xx, CSV-escaped append-only log. Never commit `credentials.json`, `token.json`, `*.pdf`, or logs.

## Migration notes (from single-package layout)

- `node send.js emails.txt` → `npm run dry` / `npm run live` (or `nx run @apps/cli:send -- ...`).
- `node send.js emails.txt --dry-run` → `npm run dry`.
- `npm run auth` still works (now runs `apps/cli/src/auth.ts` via Nx).
- Log moved `sent_log.csv` → `apps/cli/logs/sent_log.csv` (old path still counted by the daily guard).
- Resume moved from the old root PDF filename → `apps/cli/assets/resume.pdf`.
