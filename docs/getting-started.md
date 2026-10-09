# Getting started

Get from zero to a verified dry-run in under 5 minutes.

## Prereqs

- Node.js >= 20 (`node --version`; the pinned version is in `.nvmrc`).
- A Gmail account you will send from.
- Google Cloud OAuth files (first time only) — full walkthrough in [Gmail setup](./gmail-setup.md).

## Install

Run once at the repo root (npm workspaces + Nx live here):

```
npm install
npm run setup  # 0. copies config/default.json → config.json and
               #    data/emails.example.txt → data/emails.txt (skips existing files)
```

## The 4-step loop

```
npm run auth   # 1. one-time Gmail login → creates apps/cli/token.json
npm run dry    # 2. dry-run with apps/cli/data/emails.txt — sends NOTHING
npm run live   # 3. real send (only when the dry-run list looks right)
```

Step 2 prints the effective config plus one line per address:

```
From: Your Name <you@gmail.com>
Subject: Job Application
Resume: C:\...\apps\cli\assets\resume.pdf
Delay: 5000ms (+jitter)
Daily limit: 450
[dry-run] 1/1 friend@example.com
Done: 1 addresses (dry run, nothing sent)
```

## Where things live

| What         | Path                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------- |
| Address list | `apps/cli/data/emails.txt` (any format — regex-extracted, deduped; see `data/emails.example.txt`) |
| Resume       | `apps/cli/assets/resume.pdf`                                                                      |
| Settings     | `apps/cli/config.json` (example: `apps/cli/config/default.json`)                                  |
| Send log     | `apps/cli/logs/sent_log.csv`                                                                      |

## Next steps

- First time? Do [Gmail setup](./gmail-setup.md) before `npm run auth`.
- Every flag and example: [CLI usage](./cli-usage.md).
- Something failed? [Troubleshooting](./troubleshooting.md).
