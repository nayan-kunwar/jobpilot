// One-time login: opens a browser, saves token.json for the sender.
// Run: nx run @apps/cli:auth
import { authenticate } from '@google-cloud/local-auth';
import fs from 'node:fs/promises';
import path from 'node:path';
import { APP_ROOT } from './constants.js';

const client = await authenticate({
  keyfilePath: path.join(APP_ROOT, 'credentials.json'), // OAuth client from Google Cloud Console (Desktop app)
  scopes: ['https://www.googleapis.com/auth/gmail.send'],
});
await fs.writeFile(path.join(APP_ROOT, 'token.json'), JSON.stringify(client.credentials, null, 2));
console.log('Saved token.json');
