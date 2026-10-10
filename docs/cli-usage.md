# CLI usage (`@apps/cli`)

All commands run from the **repo root**. Nx executes the CLI package for you.

## Everyday commands

```
npm run setup   # first run: creates apps/cli/config.json + data/emails.txt from examples (never overwrites)
npm run dry     # dry-run, default list — NOTHING is sent (start here, always)
npm run live    # real send, default list
npm run auth    # one-time Gmail login (see Gmail setup)
```

Default list = `apps/cli/data/emails.txt` (falls back to legacy `apps/cli/emails.txt`).

## Interactive confirmation

Live sends from a human terminal show a preview (first 5 addresses + subject +
list path) and ask `Send to N address(es)?` before anything goes out. Declining
aborts with `Aborted — nothing sent` (exit 0, nothing sent, nothing logged).
Prompting is skipped automatically for `--dry-run`, `--yes`, and non-TTY
(pipes/CI) — automation never hangs waiting for input. `--yes` still wins if
`--interactive` is also passed.

`npm run send` and `npm run live` start the CLI in this terminal, so arrow keys
and Enter reach the Yes/No prompt. `npx nx run @apps/cli:send` on Windows does
not: Nx uses `child_process.exec` and drops stdin, so the prompt is drawn and
Enter does nothing. Use `npm run send`, or `--yes` for an unattended run.
`--interactive` still asks when a TTY is not detected; if the keyboard is not
actually connected, the CLI prints why and sends nothing.

## Passing flags

Everything after `--` goes to the CLI. Two cwd rules that bite:

- **Multi-word values don't survive Nx forwarding** (`--subject "a b c"` arrives
  split). Put multi-word text in `config.json` instead — CLI flags are for
  single-token overrides (`--limit 5`, `--dry-run`).
- **Nx executes with cwd = `apps/cli/`**, so relative paths are project-relative:
  `--body-file cover.txt` (not `apps/cli/cover.txt`), `--resume assets/resume.pdf`.
  Only `cd apps/cli && npx tsx …` direct runs use the same cwd by coincidence —
  the rule is really "paths are relative to `apps/cli/` either way".

```
npm run dry -- --limit 5
npm run send -- data/other.txt --dry-run
npm run send -- --resume assets/resume-v2.pdf --body-file cover.txt --dry-run
```

Raw Nx equivalents (`send` on Windows cannot read the Yes/No keys; use `npm run send`):

```
npx nx run @apps/cli:dry
npx nx run @apps/cli:send -- --limit 50 --subject "..."
npx nx run @apps/cli:auth
```

Direct execution (inside `apps/cli/`, after root `npm install`):

```
npx tsx ./bin/send.ts --dry-run
npx tsx ./bin/send.ts --help
```

## Full syntax

```
gmail-bulk-sender [options] [listFile]
```

| Argument / flag      | Meaning                                                                          | Default                             |
| -------------------- | -------------------------------------------------------------------------------- | ----------------------------------- |
| `[listFile]`         | address list file (any format — emails are regex-extracted, lowercased, deduped) | `apps/cli/data/emails.txt`          |
| `--dry-run`          | print effective config + addresses, send nothing, skip Gmail auth                | off                                 |
| `--yes`              | skip interactive confirmation (for scripts/CI; implied by non-TTY)               | off                                 |
| `--interactive`      | ask for confirmation even when TTY is not detected (aborts if no keyboard)       | off                                 |
| `--non-interactive`  | same as `--yes`                                                                  | off                                 |
| `--quiet`            | errors and final summary only (no per-address lines)                             | off                                 |
| `--json`             | machine-readable JSON summary on stdout (implies `--quiet`)                      | off                                 |
| `--limit <n>`        | send to at most N addresses this run                                             | all                                 |
| `--subject <text>`   | override email subject                                                           | `config.json` → builtin             |
| `--from <text>`      | override `From:` header                                                          | `config.json` → builtin             |
| `--resume <path>`    | override resume PDF (must be < 25 MB)                                            | `config.json` → `assets/resume.pdf` |
| `--body-file <path>` | read the email body from a text file                                             | builtin cover letter                |
| `--delay-ms <n>`     | pause between emails (plus up to 2 s random jitter)                              | `5000`                              |
| `--daily-limit <n>`  | abort/truncate past N sends today                                                | `450`                               |
| `--config <path>`    | use a different config file                                                      | `apps/cli/config.json`              |
| `-h, --help`         | commander help                                                                   | —                                   |

Precedence: **CLI flag > `config.json` > builtin defaults** (see [Configuration](./configuration.md)).
Numeric flags must be positive integers or the CLI exits with an error.

## Exit codes

| Code | Meaning                                                                              |
| ---- | ------------------------------------------------------------------------------------ |
| `0`  | success (or dry-run done)                                                            |
| `1`  | bad CLI usage / bad flag value / bad config JSON                                     |
| `2`  | unreadable list/resume/body file, zero addresses parsed, empty body, oversize resume |
| `3`  | daily limit already reached                                                          |
| `4`  | Gmail auth failure (fix: `npm run auth`)                                             |

## Recipes

**Test a new subject on 5 addresses:**

```
npm run dry -- --subject "Application For Backend Developer (Node.js)" --limit 5
```

**Full-stack variant with a different resume + cover letter:**

```
npm run send -- --resume ./assets/resume-fullstack.pdf --body-file ./cover-fullstack.txt --subject "Application For Full Stack Developer" --dry-run
# remove --dry-run only when the preview is right
```

**Slow down for a big list (avoid spam flags):**

```
npm run send -- --delay-ms 10000
```

**Check what a flag does:** `npx tsx apps/cli/bin/send.ts --help`.
