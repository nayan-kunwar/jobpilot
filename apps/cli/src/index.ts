// Canonical CLI entry. Run: tsx ./src/index.ts [listFile] [flags] or tsx ./bin/send.ts ...
// Commander handles --help/validation; parseArgs() returns typed CliOptions.
// Interactive confirmation (TTY live sends without --yes) lives in tui.ts;
// sender.ts stays automation-safe and never prompts.
import { parseArgs } from './args.js';
import { run } from './sender.js';
import { confirmSend, shouldPrompt } from './tui.js';

const opts = await parseArgs(process.argv);
if (shouldPrompt(opts, process.stdin.isTTY)) {
  const ok = await confirmSend(opts.listFile, opts.subject ?? '(from config.json)');
  if (!ok) process.exit(0); // user declined: not a failure, nothing sent
}
await run(opts);
