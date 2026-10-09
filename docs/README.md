# Docs

Usage and contributor documentation for the **job-apps** monorepo.

## I want to…

| Goal                                           | Start here                                    |
| ---------------------------------------------- | --------------------------------------------- |
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

- [`apps/cli`](../apps/cli) (`@apps/cli`) — Gmail bulk sender. The only production app right now.
- [`apps/web`](../apps/web) (`@apps/web`) — empty Next.js scaffold.
- [`packages/`](../packages) — shared libraries (empty until 2+ apps need the same code).

Root `README.md` is the overview; this folder is the source of truth for details.
Per-app READMEs keep short quick-refs and link here.
