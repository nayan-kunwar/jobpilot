// Canonical CLI entry. Run: tsx ./src/index.ts [listFile] [flags] or tsx ./bin/send.ts ...
// Commander handles --help/validation; parseArgs() returns typed CliOptions.
import { parseArgs } from './args.js';
import { run } from './sender.js';

await run(await parseArgs(process.argv));
