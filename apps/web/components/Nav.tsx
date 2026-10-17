'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/compose', label: 'Compose' },
  { href: '/logs', label: 'Logs' },
  { href: '/settings', label: 'Settings' },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {LINKS.map((link) => {
        const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              active
                ? 'rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white'
                : 'rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100'
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
