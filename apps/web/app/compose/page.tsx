import { ComposeClient } from '../../components/ComposeClient';
import { saveCompose } from '../actions';
import { getStatus, listResumes, readBody, readConfig, readListText } from '../../lib/store';

// Local dashboard: always read the CLI files fresh, never bake them in at build time.
export const dynamic = 'force-dynamic';

export default async function ComposePage() {
  const [config, body, listText, resumes, status] = await Promise.all([
    readConfig(),
    readBody(),
    readListText(),
    listResumes(),
    getStatus(),
  ]);

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Compose</h1>
        <p className="mt-1 text-sm text-slate-500">
          Edit the letter and the recipient list, check the exact preview, then save or send — the CLI uses
          the same files.
        </p>
      </header>
      <ComposeClient
        initial={{
          subject: config.subject,
          from: config.from,
          body,
          recipients: listText,
          resume: resumes.some((r) => r.name === config.resume.split(/[\\/]/).pop())
            ? (config.resume.split(/[\\/]/).pop() as string)
            : (resumes[0]?.name ?? ''),
        }}
        resumes={resumes}
        daily={{ sentToday: status.sentToday, dailyLimit: status.dailyLimit }}
        delayMs={config.delayMs}
        onSave={saveCompose}
      />
    </div>
  );
}
