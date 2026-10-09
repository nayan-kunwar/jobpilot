# Web (`@apps/web`)

> Status: **empty scaffold**. The Next.js app router boots (see `apps/web/app/page.tsx`),
> `dev`/`build`/`lint`/`check` targets are green, and that's the whole contract for now.

## Use

```
npx nx run @apps/web:dev     # local dev server
npx nx run @apps/web:build   # production build → apps/web/.next/
npx nx run @apps/web:start   # serve the production build
```

Shares root `tsconfig.base.json` (strict, `@apps/*` paths), root eslint
(`next-env.d.ts` excluded globally), and prettier.

## Monorepo notes

- `next.config.js` sets `outputFileTracingRoot` to the workspace root (kills the
  multi-lockfile warning; we use the single root `package-lock.json`).
- Build output (`.next/`) and `next-env.d.ts` are gitignored / lint-ignored.
- When real UI work starts: add routes under `apps/web/app/`, colocated
  `page.test.tsx` suites (vitest is already at the root), and — if web needs
  to preview or parse mail — extract `packages/email-core` from the CLI's
  `mime`/`parseEmails`/`utils` modules instead of copy-pasting
  (see [Monorepo](./monorepo.md#adding-a-shared-package)).
