# Monorepo guide (Nx + npm workspaces)

## Layout

```
.
  package.json            # private root, workspaces ["apps/*","packages/*"], shortcuts (dry/live/send/auth/test/lint/...)
  nx.json                 # task pipeline + cache rules
  tsconfig.base.json      # strict TS, path aliases @apps/*
  apps/cli/               # @apps/cli — Gmail bulk sender (production)
  apps/web/               # @apps/web — empty Next.js scaffold
  packages/               # shared libs (empty; see below)
```

`npx nx graph` shows the live project graph (`@apps/cli`, `@apps/web`).

## How Nx is wired here

- Each app has `package.json` scripts (the real commands: `tsx`, `vitest`, `tsc`, `next`)
  plus `project.json` targets delegating via `nx:run-script` — one source of truth,
  Nx adds caching + orchestration.
- Cached: `test`, `lint`, `check`, `build`. **Never cached**: `dry`, `live`,
  `send`, `auth`, `dev` (they send mail / open browsers / start servers).
- Root shortcuts (`npm run dry` → `nx run @apps/cli:dry`) exist so daily use
  never needs the long form. Extra args pass through after `--`.

## Adding a new app

1. `mkdir apps/<name>` with its own `package.json` (`name: @apps/<name>`,
   `private: true` unless publishable), `project.json` (Nx targets in the same
   `nx:run-script` style), `tsconfig.json` extending `../../tsconfig.base.json`,
   `README.md`.
2. Run `npm install` at the root (workspace pickup), then
   `npx nx show projects` must list `@apps/<name>`.
3. If it's Next.js: copy the target set from `apps/web/project.json`
   (`dev/build/start/lint/check`) and the `tsconfig.json` shape
   (`jsx: preserve`, Next plugin, `next-env.d.ts` ignore is already global).
4. Add root shortcuts only for daily-use commands; everything else goes through
   `nx run @apps/<name>:<target>`.

## Adding a shared package

Create `packages/<name>/` when **2+ apps** import the same code (rule of thumb —
don't extract prematurely). Candidates already identified: `email-core`
(MIME builder, address parsing, retry utils) if the web app ever previews mail.

1. `packages/<name>/package.json` (`@packages/<name>`, version `0.1.0`),
   `src/index.ts` barrel, `project.json` (`build/test/lint` via `nx:run-script`).
2. Depend with workspace range: `"@packages/<name>": "*"` in the app.
3. Add path alias in `tsconfig.base.json` (`@packages/<name>/*`).

## Caching pitfalls

- If a task behaves differently on re-run (sends, timestamps, network), its target
  must have `"cache": false` in both `nx.json` `targetDefaults` and the
  `project.json` entry — check both places.
- `nx reset` clears a poisoned cache; `nx run <t> --skip-nx-cache` forces one run.
