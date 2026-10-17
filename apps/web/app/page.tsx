import Link from 'next/link';
import { SendBanner } from '../components/SendBanner';
import { Card, Stat, StatusPill } from '../components/ui';
import { getStatus, readLog } from '../lib/store';

// Local dashboard: always read the CLI files fresh, never bake them in at build time.
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [status, log] = await Promise.all([getStatus(), readLog(8)]);
  const resumeSub =
    status.resumeSize != null ? `${(status.resumeSize / 1024 / 1024).toFixed(2)} MB` : 'check assets/';

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of the local bulk sender — same files the CLI uses.
        </p>
      </header>

      <SendBanner />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Sent today"
          value={`${status.sentToday} / ${status.dailyLimit}`}
          sub={`${status.remaining} remaining today`}
        />
        <Stat
          label="Recipients"
          value={String(status.recipients)}
          sub={
            status.dupesRemoved > 0
              ? `${status.dupesRemoved} duplicate${status.dupesRemoved === 1 ? '' : 's'} skipped`
              : 'list is clean'
          }
        />
        <Stat
          label="Resume"
          value={status.resumeExists ? status.resumeName : 'missing'}
          sub={status.resumeExists ? resumeSub : 'update config.json / assets'}
          warn={!status.resumeExists}
        />
        <Stat
          label="Gmail token"
          value={status.tokenExists ? 'connected' : 'missing'}
          sub={status.tokenExists ? 'token.json found' : 'run npm run auth'}
          warn={!status.tokenExists}
        />
      </div>

      <Card
        title="Send workflow"
        right={
          <Link href="/compose" className="text-sm font-medium text-blue-600 hover:underline">
            Compose →
          </Link>
        }
      >
        <p className="text-sm text-slate-600">
          Write the letter and paste recipients in Compose, then send right from this dashboard — or keep
          using the CLI:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-slate-900 px-4 py-3 text-xs leading-relaxed text-slate-100">
          {`npm run dry  -- --body-file data/body.txt   # verify first\nnpm run live -- --body-file data/body.txt   # real send`}
        </pre>
      </Card>

      <Card title="Recent sends">
        {log.length === 0 ? (
          <p className="text-sm text-slate-500">No sends logged yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs tracking-wide text-slate-400 uppercase">
                <th className="py-1 pr-4">When (UTC)</th>
                <th className="pr-4">To</th>
                <th className="pr-4">Status</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {log.map((row, i) => (
                <tr key={`${row.timestamp}-${row.to}-${i}`} className="border-t border-slate-100">
                  <td className="py-1.5 pr-4 whitespace-nowrap text-slate-500">
                    {row.timestamp.slice(0, 19).replace('T', ' ')}
                  </td>
                  <td className="pr-4">{row.to}</td>
                  <td className="pr-4">
                    <StatusPill status={row.status} />
                  </td>
                  <td className="max-w-[16rem] truncate text-slate-500" title={row.detail}>
                    {row.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
