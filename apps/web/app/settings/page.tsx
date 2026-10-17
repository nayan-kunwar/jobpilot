export default function SettingsPage() {
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <p className="text-sm text-slate-500">
        Editing delay, daily limit and paths arrives in the next phase. For now, edit{' '}
        <code className="rounded bg-slate-100 px-1">apps/cli/config.json</code> directly — the dashboard picks
        up changes on reload.
      </p>
    </div>
  );
}
