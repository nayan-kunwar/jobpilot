# Commander workflow, end to end (`@apps/cli`)

How one invocation — e.g. `npm run dry -- --limit 5` — travels from the shell
to a sent (or dry-run) batch. Commander owns everything left of `parseArgs()`'s
return; plain TypeScript owns everything right of it.

## The chain in 30 seconds

```
shell:  npm run dry -- --limit 5
  │  root package.json "dry" → nx run @apps/cli:dry
  ▼
bin/send.ts:1-3 ── imports ──▶ src/index.ts (parse → maybe confirm → run)
  ▼
args.ts:16-33  buildProgram()   ← DECLARE the interface once
  │  .argument('[listFile]') + 10 × .option(...)
  ▼
args.ts:46-60  program.parse(argv)  ← TOKENIZE + COERCE + VALIDATE (commander)
  │  program.args[0]  → positional     program.opts() → flags object
  ▼
args.ts:87-100  adapt             ← MAP to CliOptions (constants.ts:15-27)
  │  ?? null normalization, legacy emails.txt fallback
  ▼
index.ts  confirm gate (tui.ts)  ← CONFIRM live TTY sends (skipped: --dry-run/--yes/non-TTY)
  ▼
sender.ts:28  run(opts)          ← EXECUTE (never sees argv)
   ├─ dry-run early return  ·  daily-limit guard  ·  Gmail auth
   └─ retry loop → appendLog → "Done: N addresses"
```

## Stage by stage

### 1. Entry — thin wrappers only

- `bin/send.ts` is 3 lines: shebang + `import '../src/index.js'`. (The `.js`
  suffix resolves to `.ts` under `NodeNext` — repo convention, see
  [Development](./development.md).)
- `src/index.ts:6` is the whole program: parse, then run. No logic lives here,
  so there is exactly one place where CLI meets domain code.

### 2. Declare — `buildProgram()` (`args.ts:16-33`)

| Declaration                         | Meaning                                                          |
| ----------------------------------- | ---------------------------------------------------------------- |
| `.argument('[listFile]', …, D)`     | optional positional (`[]` = optional); default `D` when omitted  |
| `.option('--dry-run', …)`           | boolean flag, default `undefined` → adapted to `false`           |
| `.option('--yes', …)`               | boolean flag: skip interactive confirmation (scripts/CI)         |
| `.option('--limit <n>', …, parser)` | value option (`<n>` = value required); 3rd arg coerces/validates |
| `.option('--config <path>', …, D)`  | value option with a default                                      |

Fourteen options total: `--dry-run --yes --non-interactive --interactive --quiet --json
--limit --subject --from --resume --body-file --delay-ms --daily-limit --config`.
Adding another = one `.option()` line +
a `CliOptions` field (checklist in [Development](./development.md)).

### 3. Tokenize — `program.parse(argv)` (`args.ts:46-60`)

Commander strips `['node', 'send']`, then accepts all three spellings
interchangeably: `--limit 5`, `--limit=5`, `--dry-run`. Results split into:

- `program.args[0]` → the positional (`listFile`)
- `program.opts()` → camelCased flags (`--dry-run` → `dryRun`, `--body-file` → `bodyFile`)

Free behavior we previously hand-coded: `--help`/`-h` rendering, unknown-flag
rejection (`Unknown option '--bogus'`), and missing-value errors — each exits
with usage text, no custom code. Parsing runs under `exitOverride()`, so the
excess-arguments case can print the `Did you forget quotes?` hint before
exiting with commander's original code.

### 4. Coerce / validate — `parsePositiveInt` (`args.ts:6-14`)

Numeric flags pass through `positiveIntParser('--limit')`, which throws
commander's `InvalidArgumentError` on non-positive-integers. Commander catches
it and prints `error: option '--limit <n>' argument 'abc' is invalid…` plus
usage (exit 1). Key property: it **throws instead of `process.exit`**, so
validation is unit-testable — the old hand-rolled parser exited inline and
could not be tested without killing the runner.

### 5. Adapt — argv shapes become `CliOptions` (`args.ts:87-100`)

Raw commander output is reshaped into our stable contract
(`constants.ts:15-27`):

- every unset value becomes `null` (not `undefined`), so `sender.ts` can use
  the `opts.x ?? config.x ?? DEFAULTS.x` fallback chain;
- `listFile` falls back to `DEFAULT_LIST_FILE`, then legacy `emails.txt`
  (checked with `fs.access`; if neither exists the default is kept and the
  sender reports a clean `Cannot read list file` exit-2 error).

This stage is the seam: commander types never leak past it.

### 6. Execute — `run(opts)` (`sender.ts:28`)

Receives a plain object — never `argv`, never a `Command`. Downstream
(dry-run early return → daily-limit guard → `createGmailClient` → retry loop →
`appendLog`) is commander-agnostic, which is why the sender is testable without
spawning processes. Flag precedence for the whole run:
**CLI flag > `config.json` > builtins** (see [Configuration](./configuration.md)).

## Worked example

Input:

```
npm run dry -- --limit 5 --subject=Hi
```

After stages 3–5, `run()` receives exactly:

```json
{
  "listFile": "<APP_ROOT>/data/emails.txt",
  "dryRun": true,
  "yes": false,
  "limit": 5,
  "subject": "Hi",
  "from": null,
  "resume": null,
  "bodyFile": null,
  "delayMs": null,
  "dailyLimit": null,
  "configPath": "<APP_ROOT>/config.json"
}
```

`null` fields resolve from `config.json` inside `run()`; nothing downstream
knows commander exists.

## Confirm gate — `index.ts` + `tui.ts`

Between adapt and execute sits one branch:

```ts
if (shouldPrompt(opts, process.stdin.isTTY)) {
  const ok = await confirmSend(opts.listFile, opts.subject ?? '(from config.json)');
  if (!ok) process.exit(0);
}
```

- `shouldPrompt` (`tui.ts`) is pure: true for live sends (`!dryRun`) without
  `--yes`, when stdin is a TTY or `--interactive` is set. Scripts, CI, and pipes
  skip it. If `--interactive` forces a prompt but stdin is not a TTY, `readConfirm`
  declines immediately — clack cannot see Enter unless raw mode is on.
- `confirmSend` previews the first 5 addresses + subject + list path via clack,
  returns the answer. Decline → exit 0, nothing sent or logged.
- Unreadable list → returns true without asking, so `sender.ts` reports the
  authoritative error (one owner per error).
- The prompter is injected (`ConfirmPrompter` interface, clack by default),
  so `test/tui.test.ts` drives accept/decline/unreadable paths with fakes.

## Test hooks

- `test/args.test.ts:14-29` — `parseArgs()` with fake argv arrays (space and
  `=` forms, defaults case). No subprocess, no exits: validation throws are
  assertable because parsers throw `InvalidArgumentError`.
- `test/args.test.ts:31-36` — `buildProgram()` exposes description/help without
  exiting, so declaration regressions (renamed flag, lost default) fail fast.

## Failure map

| Symptom                            | Raised in                        | User sees                                          | Exit             |
| ---------------------------------- | -------------------------------- | -------------------------------------------------- | ---------------- |
| `--bogus`, missing value, `--help` | commander (`parse`)              | usage + error/help                                 | 0 help / 1 error |
| unquoted multi-word value          | commander + hint (`args.ts`)     | `too many arguments` + `Did you forget quotes?`    | 1                |
| `--limit abc`                      | `parsePositiveInt` via commander | `option '--limit <n>' argument … is invalid`       | 1                |
| user declines confirm              | `tui.ts` via `index.ts`          | `Aborted — nothing sent.`                          | 0                |
| bad `config.json` JSON             | `config.ts`                      | `Failed to load config …`                          | 1                |
| unreadable list / zero addresses   | `sender.ts`                      | `Cannot read list file …` / `No email addresses …` | 2                |
| daily quota hit                    | `sender.ts`                      | `Daily limit reached …`                            | 3                |
| auth failure                       | `gmail.ts` via `sender.ts`       | `Auth failed: … Re-run "npm run auth"`             | 4                |

Full flag table: [CLI usage](./cli-usage.md). Every error string:
[Troubleshooting](./troubleshooting.md).
