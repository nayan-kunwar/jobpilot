import type { ReactNode } from 'react';

export function Stat({
  label,
  value,
  sub,
  warn = false,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div className={`rounded-lg border bg-white p-4 ${warn ? 'border-amber-300' : 'border-slate-200'}`}>
      <div className="text-xs font-medium tracking-wide text-slate-400 uppercase">{label}</div>
      <div className="mt-1 truncate text-xl font-semibold" title={value}>
        {value}
      </div>
      {sub ? (
        <div className={`mt-0.5 text-xs ${warn ? 'text-amber-600' : 'text-slate-500'}`}>{sub}</div>
      ) : null}
    </div>
  );
}

export function Card({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function StatusPill({ status }: { status: string }) {
  const cls = status === 'sent' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}
