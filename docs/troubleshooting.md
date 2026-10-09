# Troubleshooting (`@apps/cli`)

Find your exact error message below. Run `npm run dry` first for any
non-auth problem — it reproduces parsing/config issues without sending.

## Auth failures (exit code 4)

**`Gmail API has not been used in project ... before or it is disabled`**
→ The Gmail API isn't enabled. Open the Enable link inside the error,
click Enable, wait 1–2 minutes, retry. (Setup: [Gmail setup](./gmail-setup.md#1-create-a-google-cloud-project).)

**`cannot read credentials.json ...` / `missing client_id/client_secret`**
→ `apps/cli/credentials.json` is absent or not a Desktop-type OAuth client.
Re-download it per [Gmail setup step 3](./gmail-setup.md#3-create-the-oauth-client).

**`cannot read token.json ... Re-run "npm run auth"`**
→ No login yet (or the file was deleted). Run `npm run auth`.

**`token.json has no refresh_token ...` / `access token expired and no refresh_token present`**
→ Re-run `npm run auth`. (Caused by approving with an already-logged-in session
that skipped re-consent; a fresh login restores the refresh token.)

**`access_denied` in the browser during `npm run auth`**
→ Your Gmail isn't a Test user on the OAuth consent screen. Add it
([step 2](./gmail-setup.md#2-oauth-consent-screen)) and retry.

## Input failures (exit code 2)

**`Cannot read list file "..."`** → wrong path. Default is
`apps/cli/data/emails.txt`; from the repo root either omit the arg
(`npm run dry`) or pass the full relative path.

**`No email addresses found in "..."`** → the regex
`[\w.+-]+@[\w-]+(\.[\w-]+)+` found nothing. Check the file isn't empty and
addresses aren't obfuscated (`name [at] x.com` won't parse).

**`Cannot read resume "..."` / `Warning: resume file ... not found`**
→ path wrong (see [path resolution](./configuration.md#path-resolution-important-in-the-monorepo))
or the PDF isn't there. Real sends abort; dry-runs warn and continue.

**`... is XMB, over Gmail's 25MB limit`** → compress the PDF (print-to-PDF at
lower quality, or drop embedded images) until under 25 MB.

**`Body file "..." is empty / Cannot read body file`**
→ `--body-file` path wrong or file blank. Omit the flag to use the builtin letter.

## Limit abort (exit code 3)

**`Daily limit reached: N/450 already sent today`**
→ expected guard, not a bug. Wait until tomorrow (UTC day) or raise
`--daily-limit` if your account quota allows. `Warning: truncating run ...`
means the same guard trimmed this batch — check `logs/sent_log.csv` for what
already went out before re-running.

## Usage errors (exit code 1)

**`Unknown flag: --bogus` / `Unexpected argument` / `--limit must be a positive integer`**
→ typo or bad value; `npx tsx apps/cli/bin/send.ts --help` lists everything.
Note numeric flags accept `--limit 5` and `--limit=5` forms.

## Still stuck?

1. `npx tsx apps/cli/bin/send.ts --help` — confirms the CLI itself loads (rules out install/TS issues).
2. `npm run dry -- --limit 1` — smallest possible reproduction.
3. `npx nx run @apps/cli:check` + `:lint` — catches broken edits.
4. Read the failing row in `apps/cli/logs/sent_log.csv` — the `detail` column has the raw Gmail error.
