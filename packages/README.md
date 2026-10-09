# packages/

Shared libraries extracted from apps go here when 2+ apps need the same code.

Candidates from `@apps/cli` if the future web app needs them:
- `email-core/` — MIME builder (`mime.ts`), address parsing (`args.ts` → `parseEmails`), retry/daily-limit utils
- `config/` — shared tsconfig/eslint presets (if they outgrow the root files)

Conventions:
- Each package: `packages/<name>/package.json` (`@packages/<name>`), `src/index.ts`, `project.json` with `build/test/lint` targets.
- Depend via workspace version: `"@packages/email-core": "*"` in the app's `package.json`.
- Nothing here yet — intentionally empty so `npm workspaces` globs stay valid.
