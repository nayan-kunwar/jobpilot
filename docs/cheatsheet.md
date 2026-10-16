# Command cheat sheet

Every command on one page, from first install to live sends. Details and
background: [Getting started](./getting-started.md) · [CLI usage](./cli-usage.md) ·
[Configuration](./configuration.md).

## First time only

```bash
npm install        # once at the repo root (installs all workspaces)
npm run setup      # create config.json + data/emails.txt from examples (never overwrites)
npm run auth       # Gmail login → apps/cli/token.json (re-run if a send says invalid_grant)
```

## Sending emails (repo root)

```bash
npm run dry            # preview the default list — sends NOTHING (always start here)
npm run live           # real send to apps/cli/data/emails.txt
npm run send -- <flags>  # real send with flags (everything after -- goes to the CLI)
```

Useful runs:

```bash
npm run dry -- --limit 5                    # first 5 addresses only
npm run live -- --body-file cover.txt       # custom body (bold: wrap words in **asterisks**)
npm run live -- --yes                       # skip the "Send to N address(es)?" prompt (scripts/CI)
npm run send -- --resume assets/other.pdf   # different resume PDF
npm run send -- --delay-ms 10000            # slower pace between emails
npm run send -- --json                      # machine-readable summary (implies --quiet)
```

Two path rules under Nx: flag paths are relative to `apps/cli/`
(`--body-file cover.txt` = `apps/cli/cover.txt`), and multi-word values
(`--subject "a b c"`) can't be forwarded through raw `npx nx run` — put them in
`config.json` instead, or run the CLI directly (see below).

## All flags

| Flag                 | What it does                                                |
| -------------------- | ----------------------------------------------------------- |
| `[listFile]`         | address list file (any format; regex-extracted, deduped)    |
| `--dry-run`          | print config + addresses; send nothing                      |
| `--yes`              | skip confirmation prompt (`--non-interactive` is the same)  |
| `--interactive`      | force the prompt even without a TTY (aborts if no keyboard) |
| `--quiet`            | errors and final summary only                               |
| `--json`             | JSON summary on stdout (implies `--quiet`)                  |
| `--limit <n>`        | cap this run to N addresses                                 |
| `--subject <text>`   | override subject                                            |
| `--from <text>`      | override From header                                        |
| `--resume <path>`    | override resume PDF (< 25 MB)                               |
| `--body-file <path>` | read body from a text file (`**bold**` markers supported)   |
| `--delay-ms <n>`     | pause between emails (+ up to 2 s jitter)                   |
| `--daily-limit <n>`  | abort/truncate past N sends today                           |
| `--config <path>`    | use a different config file                                 |
| `-h, --help`         | full commander help                                         |

Precedence: **CLI flag > `config.json` > builtin defaults**.

## Bold text in the body

In the file passed to `--body-file`, wrap words in `**double asterisks**` — they
arrive bold in Gmail; the plain-text fallback has the markers stripped:

```
Dear Hiring Team,

I have over **2+ years** of backend experience with **Node.js and TypeScript**.

Best regards,
Your Name
```

Markers must open and close on the same line; a lone `**` stays literal.

## Config (`apps/cli/config.json`)

```json
{
  "from": "Your Name <you@gmail.com>",
  "subject": "Job Application",
  "resume": "./assets/resume.pdf",
  "delayMs": 5000,
  "dailyLimit": 450
}
```

The body is not in the config — it is the builtin template or `--body-file`.

## Direct / raw forms

```bash
cd apps/cli
npx tsx ./bin/send.ts --dry-run            # bypasses Nx entirely
npm run dev -- --dry-run                   # same, via package script
npx nx run @apps/cli:dry                   # raw Nx target
npx nx run @apps/cli:send -- --limit 50 --dry-run
```

⚠ On Windows, `npx nx run @apps/cli:send` cannot read the Yes/No prompt keys —
use `npm run send` or pass `--yes`.

## Exit codes

| Code | Meaning                                                                              |
| ---- | ------------------------------------------------------------------------------------ |
| `0`  | success (or dry-run done)                                                            |
| `1`  | bad CLI usage / bad flag value / bad config JSON                                     |
| `2`  | unreadable list/resume/body file, zero addresses parsed, empty body, oversize resume |
| `3`  | daily limit already reached                                                          |
| `4`  | Gmail auth failure → `npm run auth`                                                  |

## Dev commands (repo root)

```bash
npm test           # vitest (all projects)
npm run lint       # eslint, every project
npm run check      # tsc --noEmit, every project
npm run build      # tsc → apps/cli/dist/
npm run format     # prettier --write .
npm run graph      # Nx project graph
```

Per-app: `npx nx run @apps/cli:<target>` (or `npm test`, `npm run lint|check|build|format`
inside `apps/cli/`).

## Where things live

| What         | Path                                              |
| ------------ | ------------------------------------------------- |
| Address list | `apps/cli/data/emails.txt`                        |
| Resume       | `apps/cli/assets/` (set the exact file in config) |
| Send log     | `apps/cli/logs/sent_log.csv`                      |
| Gmail token  | `apps/cli/token.json` (expired → `npm run auth`)  |
