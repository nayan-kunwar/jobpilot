# packages/

Shared libraries used by 2+ apps of the monorepo.

## email-core (`@packages/email-core`)

Mail logic shared by `@apps/cli` and `@apps/web`:

- `renderBody` — plain-text body → `{ text, html }` (`**bold**` → `<b>`, the
  multipart/alternative pair the sender builds)
- `buildMime` — RFC message builder with PDF attachment
- `parseEmails` — regex extract + dedupe of addresses
- `countSentToday`, `csvEscape`, `isRetryable` — daily-limit guard, log and
  retry helpers
- `DEFAULT_BODY`, `DEFAULT_FROM`, `DEFAULT_SUBJECT`, `DEFAULT_RESUME_REL`,
  `DEFAULT_DELAY_MS`, `DEFAULT_DAILY_LIMIT` — builtin body + scalar defaults

Subpath exports let client code import pure modules without pulling in Node
built-ins: `@packages/email-core/body`, `/emails`, `/defaults` are pure; the
barrel also exports `countSentToday` (uses `node:fs`).

```bash
npx nx run @packages/email-core:test    # vitest
npx nx run @packages/email-core:build   # tsc → dist/
```

## Conventions

- Each package: `package.json` (`@packages/<name>`), `src/index.ts`, and
  `project.json` with `build`/`test`/`lint`/`check` targets.
- Apps depend with `"@packages/<name>": "*"`; `tsconfig.base.json` maps the
  alias to `src/` so checks, tests and `tsx` run from source, and `nx.json`
  `sharedGlobals` invalidates caches when package files change.
- A library build that needs real declaration files can override the alias to
  `dist/*.d.ts` (see `apps/cli/tsconfig.lib.json`).
