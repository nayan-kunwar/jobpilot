# Development

Contributor workflow for the monorepo. User-facing behavior is documented in
[CLI usage](./cli-usage.md); this page is for changing code.

## Commands (repo root)

```
npm install                    # once; hoists all workspaces
npm run dry                    # fastest sanity check (cli dry-run)
npx nx run-many -t test        # vitest (cli) — add web tests when UI exists
npx nx run-many -t lint check  # eslint + tsc --noEmit, every project
npx nx run @apps/cli:build     # tsc → apps/cli/dist/
npx nx graph                   # visual project graph
```

Per-app: `npx nx run @apps/cli:<target>` / `npx nx run @apps/web:<target>`
(see `apps/*/project.json` for target lists). Send/auth/dry/live targets are
never Nx-cached; test/lint/check/build are.

## Conventions

- **TypeScript strict**, ESM (`NodeNext`). Imports of local files keep the `.js`
  suffix (`./mime.js` → resolves to `mime.ts`) — required by `NodeNext`.
- **Commander** owns CLI parsing (`apps/cli/src/args.ts`): add a flag there with
  a positive-int parser or string option, extend `CliOptions` in `constants.ts`,
  consume it in `sender.ts`, cover it in `test/args.test.ts`.
- **Pure logic stays testable**: `parseEmails`, `buildMime`, `csvEscape`,
  `isRetryable` have no I/O — keep it that way. `sender.ts:run(opts)` takes a
  parsed options object (not `argv`) for the same reason.
- **No `any`**: type Gmail errors via the `unknown` + guard pattern in `utils.ts`;
  use the `errMessage()` helper instead of `err.message` casts.
- **Paths**: app-root-anchored (`APP_ROOT` in `constants.ts`), never bare
  `./`-relative — Nx runs from the workspace root. Config-file paths resolve
  from the config dir; CLI-passed paths stay cwd-relative
  (details: [Configuration](./configuration.md)).
- **Logging**: append via `src/logger.ts` (never hand-roll CSV); dry-runs must
  never write to the log — covered by design (early return before auth).

## Adding a flag (checklist)

1. `args.ts`: `.option(...)` + `CliOptions` field + `parseArgs()` mapping.
2. `sender.ts` or `constants.ts`: consume with `??` fallback chain.
3. `test/args.test.ts`: parse case (space + `=` forms) + default case.
4. Docs: flag table in [CLI usage](./cli-usage.md) + key row in
   [Configuration](./configuration.md) if it has a config counterpart.

## Definition of done

`nx run-many -t test lint check build` green, `npm run dry` output unchanged
for default inputs, and docs updated in the same change.
