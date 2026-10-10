import { google } from 'googleapis';
import type { gmail_v1 } from 'googleapis';
import fs from 'node:fs/promises';

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface OAuthCreds {
  installed?: { client_id?: string; client_secret?: string; redirect_uris?: string[] };
  web?: { client_id?: string; client_secret?: string; redirect_uris?: string[] };
}

interface TokenData {
  refresh_token?: string;
  expiry_date?: number;
}

/**
 * Create an authenticated Gmail client.
 * Default paths are absolute under apps/cli/ so Nx can run from the workspace root.
 * Raw JSON strings (e.g. from GMAIL_CREDENTIALS_JSON / GMAIL_TOKEN_JSON env vars)
 * take precedence over files, so CI can inject secrets without writing them to disk.
 */
export async function createGmailClient({
  credentialsPath,
  tokenPath,
  credentialsJson,
  tokenJson,
}: {
  credentialsPath: string;
  tokenPath: string;
  credentialsJson?: string;
  tokenJson?: string;
}): Promise<gmail_v1.Gmail> {
  let creds: OAuthCreds;
  if (credentialsJson !== undefined) {
    try {
      creds = JSON.parse(credentialsJson) as OAuthCreds;
    } catch (err) {
      throw new Error(`cannot parse GMAIL_CREDENTIALS_JSON (${errMessage(err)}).`);
    }
  } else {
    try {
      creds = JSON.parse(await fs.readFile(credentialsPath, 'utf8')) as OAuthCreds;
    } catch (err) {
      throw new Error(
        `cannot read ${credentialsPath} (${errMessage(err)}). Create a Desktop OAuth client and save it there.`,
      );
    }
  }
  const { client_id, client_secret, redirect_uris } = creds.installed ?? creds.web ?? {};
  if (!client_id || !client_secret) {
    throw new Error(`${credentialsPath} missing client_id/client_secret (installed or web).`);
  }
  let token: TokenData;
  if (tokenJson !== undefined) {
    try {
      token = JSON.parse(tokenJson) as TokenData;
    } catch (err) {
      throw new Error(`cannot parse GMAIL_TOKEN_JSON (${errMessage(err)}).`);
    }
  } else {
    try {
      token = JSON.parse(await fs.readFile(tokenPath, 'utf8')) as TokenData;
    } catch (err) {
      throw new Error(`cannot read ${tokenPath} (${errMessage(err)}). Re-run "npm run auth" to log in.`);
    }
  }
  if (!token.refresh_token) {
    console.error(
      'Warning: token.json has no refresh_token; you may need to re-run "npm run auth" when the access token expires.',
    );
  }
  if (token.expiry_date && token.expiry_date < Date.now() && !token.refresh_token) {
    throw new Error('access token expired and no refresh_token present. Re-run "npm run auth".');
  }
  const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris?.[0]);
  auth.setCredentials(token);
  return google.gmail({ version: 'v1', auth });
}
