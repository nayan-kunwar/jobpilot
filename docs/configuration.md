# Configuration (`@apps/cli`)

Settings live in `apps/cli/config.json`. The tracked example is
`apps/cli/config/default.json` — copy it to get started:

```json
{
  "from": "Your Name <you@gmail.com>",
  "subject": "Job Application",
  "resume": "./assets/resume.pdf",
  "delayMs": 5000,
  "dailyLimit": 450
}
```

## Keys

| Key          | Type              | Default                     | Notes                                                                                             |
| ------------ | ----------------- | --------------------------- | ------------------------------------------------------------------------------------------------- |
| `from`       | string            | `Your Name <you@gmail.com>` | Must be your Gmail account or a verified Send-As address, or Gmail rejects the send               |
| `subject`    | string            | `Job Application`           | Per-run override: `--subject "..."`                                                               |
| `resume`     | path              | `./assets/resume.pdf`       | PDF attached to every mail; must be < 25 MB. Per-run override: `--resume <path>`                  |
| `delayMs`    | positive int (ms) | `5000`                      | Pause between emails; up to 2 s random jitter is always added. Per-run override: `--delay-ms <n>` |
| `dailyLimit` | positive int      | `450`                       | Cap on `sent` rows per UTC day (Gmail allows ~500). Per-run override: `--daily-limit <n>`         |

The email **body** is not in `config.json` — it is a builtin template in
`apps/cli/src/constants.ts` (`DEFAULT_BODY`), overridden per-run with
`--body-file <path>` (plain-text file; empty file = error).

## Precedence

**CLI flag > `config.json` (or `--config` file) > builtin defaults.**
Missing `config.json` is fine — the CLI just uses builtins (handy for `--dry-run`
on a fresh checkout).

## Path resolution (important in the monorepo)

Nx runs tasks from the **workspace root**, so relative paths need anchors:

- Paths **inside `config.json`** (`resume`) resolve relative to the **config file's
  directory** — `"./assets/resume.pdf"` in `apps/cli/config.json` means
  `apps/cli/assets/resume.pdf` no matter where you invoke from.
- **CLI flags** (`--resume`, `--body-file`, `--config`, `[listFile]`) resolve
  relative to your **current directory**, exactly as typed.
- Omitted `[listFile]` defaults to the absolute `apps/cli/data/emails.txt`
  (then legacy `apps/cli/emails.txt`).

So from the repo root, `--resume ./x.pdf` means `<root>/x.pdf`,
while the config default still finds the app's own assets. Prefer absolute
mental model: if in doubt, pass absolute paths or `cd apps/cli` first.
