# Gmail setup (first time only)

The CLI sends through your Gmail account via the Gmail API using OAuth
(a "Desktop app" client). You do this once; the login is saved to
`apps/cli/token.json`.

## 1. Create a Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project (any name, e.g. `job-apps`).
2. Open **APIs & Services → Library**, search **Gmail API**, click **Enable**.
   - Skipping this causes: `Gmail API has not been used in project ... before or it is disabled`.
     The error message contains a direct Enable link — open it, enable, wait 1–2 minutes, retry.

## 2. OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**.
2. Choose **External**, fill the app name/email (only you will see it).
3. Under **Test users**, add your Gmail address. (While the app is in Testing mode,
   only test users can log in — forgetting this causes `access_denied` at login.)

## 3. Create the OAuth client

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Desktop app**. Any name.
3. Download the JSON and save it as `apps/cli/credentials.json` (repo root → `apps/cli/` folder).
   - Never commit this file — it is gitignored.

## 4. Log in

From the repo root:

```
npm run auth
```

A browser window opens for Google login + consent (`.../auth/gmail.send` scope:
send mail only, no inbox read). On success it prints `Saved token.json`
(`apps/cli/token.json`, also gitignored).

## 5. Verify

```
npm run dry
```

Dry-run needs no Gmail network access, but a successful `auth` means the next
`npm run live` can send. If `auth` fails, see [Troubleshooting](./troubleshooting.md#auth-failures).

## Token notes

- `token.json` holds a short-lived access token plus a `refresh_token`; the CLI
  refreshes silently. If you see `has no refresh_token` warnings or expiry errors,
  just re-run `npm run auth`.
- To revoke access entirely: Google Account → Security → Third-party access → remove the app,
  then delete `apps/cli/token.json`.
