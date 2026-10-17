import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Nav } from '../components/Nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'JobPilot — Bulk Sender',
  description: 'Local dashboard for the Gmail bulk sender',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        <div className="mx-auto flex min-h-screen max-w-6xl">
          <aside className="w-56 shrink-0 border-r border-slate-200 bg-white px-4 py-6">
            <div className="mb-8 px-2">
              <div className="text-lg font-bold tracking-tight">JobPilot</div>
              <div className="text-xs text-slate-500">Gmail bulk sender — local dashboard</div>
            </div>
            <Nav />
          </aside>
          <main className="flex-1 px-8 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
