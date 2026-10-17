export default function LogsPage() {
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Logs</h1>
      <p className="text-sm text-slate-500">
        The full log table arrives in the next phase. Raw CSV:{' '}
        <code className="rounded bg-slate-100 px-1">apps/cli/logs/sent_log.csv</code> — the dashboard already
        shows the eight most recent rows.
      </p>
    </div>
  );
}
