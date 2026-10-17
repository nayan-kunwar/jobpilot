# @apps/web

Local Next.js dashboard for the Gmail bulk sender — compose with live `**bold**`
preview, then send from the browser (or hand the same files to the CLI). Reads
and writes the CLI's files (`apps/cli/config.json`, `data/body.txt`,
`data/emails.txt`, `assets/`); root override: `CLI_DATA_DIR`.

```bash
npx nx run @apps/web:dev      # dev server — http://localhost:3000
npx nx run @apps/web:build    # production build
npx nx run @apps/web:start    # serve the production build
npx nx run @apps/web:test     # vitest + jsdom + testing-library
npx nx run @apps/web:lint     # eslint
npx nx run @apps/web:check    # tsc --noEmit
npm start                     # same as @apps/web:start, from the repo root
```

Full docs: [`docs/web.md`](../../docs/web.md). Shared mail logic comes from
[`@packages/email-core`](../../packages/email-core) (`renderBody`, `parseEmails`).
