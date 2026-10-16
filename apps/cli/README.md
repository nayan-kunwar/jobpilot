# @apps/cli — Gmail bulk application sender

Send personalized job-application emails with PDF resume via the Gmail API. Commander-based CLI, TypeScript, run via Nx from the workspace root.

> Details: [`docs/cli-usage.md`](../../docs/cli-usage.md) · [`docs/commander-workflow.md`](../../docs/commander-workflow.md) · [`docs/configuration.md`](../../docs/configuration.md) · [`docs/troubleshooting.md`](../../docs/troubleshooting.md)

## Usage (from repo root)

```
npm run setup  # first run: creates config.json + data/emails.txt from examples
npm run dry    # dry-run, default list (data/emails.txt)
npm run live   # real send, default list
npm run send -- data/emails.txt --limit 5 --subject "..."
npm run auth   # one-time Gmail login → token.json
```

Direct (inside `apps/cli/`, needs root `npm install` first):

```
npx tsx ./bin/send.ts --dry-run
npx tsx ./bin/send.ts --help
```

## Options

```
gmail-bulk-sender [options] [listFile]

  listFile              address list (default: data/emails.txt)
  --dry-run             list what would be sent without sending
  --yes                 skip confirmation prompts (scripts/CI)
  --non-interactive     same as --yes
  --interactive         ask even without a TTY (aborts if no keyboard)
  --quiet               errors and final summary only
  --json                JSON summary on stdout (implies --quiet)
  --limit <n>           cap this run to N addresses
  --subject <text>      override subject      --from <text>  override From
  --resume <path>       override resume PDF   --body-file <path>  body file (**bold** ok)
  --delay-ms <n>        delay between emails  --daily-limit <n>  daily cap
  --config <path>       config file (default: config.json)
  -h, --help            full help
```

CLI flags override `config.json` (example: `config/default.json`).

## Develop

```
nx run @apps/cli:test     # vitest
nx run @apps/cli:lint     # eslint
nx run @apps/cli:check    # tsc --noEmit
nx run @apps/cli:build    # tsc → dist/
```

Direct scripts (inside `apps/cli/`): `npm test`, `npm run lint|check|build|format`,
and `npm run dev -- <flags>` to run the CLI without Nx (`npm run dev -- --dry-run`;
accepts the same flags as `bin/send.ts`).

Layout: `src/` (sender/args/config/gmail/mime/body/logger/utils/constants/auth), `bin/send.ts` entry, `data/` lists, `assets/` resume, `logs/` audit CSV, `test/` suites.
