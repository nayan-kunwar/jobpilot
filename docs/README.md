# Docs

Usage and contributor documentation for the **job-apps** monorepo.

## I want to…

| Goal                                           | Start here                                    |
| ---------------------------------------------- | --------------------------------------------- |
| **See every command on one page**              | [**Cheat sheet**](./cheatsheet.md)            |
| Send my first batch of emails                  | [Getting started](./getting-started.md)       |
| Set up Google Cloud + Gmail login (first time) | [Gmail setup](./gmail-setup.md)               |
| Learn every command and flag                   | [CLI usage](./cli-usage.md)                   |
| Trace one invocation through commander         | [Commander workflow](./commander-workflow.md) |
| Change subject / resume / delays               | [Configuration](./configuration.md)           |
| Understand sending limits and the audit log    | [Safety and limits](./safety-and-limits.md)   |
| Fix an error                                   | [Troubleshooting](./troubleshooting.md)       |
| Contribute code (tests, lint, conventions)     | [Development](./development.md)               |
| Add a new app or shared package                | [Monorepo](./monorepo.md)                     |
| Work on the web UI                             | [Web](./web.md)                               |

## Repo map (one-liners)

- [`apps/cli`](../apps/cli) (`@apps/cli`) — Gmail bulk sender: bin/entry, args/tui/auth, and the daily guard wiring.
- [`apps/web`](../apps/web) (`@apps/web`) — local Next.js dashboard: compose with live preview, send from the UI with progress + stop, dashboard stats.
- [`packages/email-core`](../packages/email-core) — shared mail logic (MIME, `**bold**` renderer, address parsing, utils) and the send engine (`/sender`) both apps run.

Root `README.md` is the overview; this folder is the source of truth for details.
Per-app READMEs keep short quick-refs and link here.
