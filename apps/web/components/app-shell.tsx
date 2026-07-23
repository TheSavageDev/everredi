'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWorkspaceStore } from '@/stores/workspace-store';

const links = [
  { href: '/app', label: 'Dashboard' },
  { href: '/app/kits', label: 'Kits' },
  { href: '/app/inventory', label: 'Inventory' },
  { href: '/app/locations', label: 'Locations' },
  { href: '/app/templates', label: 'Templates' },
  { href: '/app/shared', label: 'Shared with me' },
  { href: '/app/workspace', label: 'Workspace' },
  { href: '/app/alerts', label: 'Alerts' },
  { href: '/app/account', label: 'Account' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const workspace = useWorkspaceStore((s) => s.workspace);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl gap-8 px-4 py-6 md:px-6">
      <aside className="hidden w-56 shrink-0 md:block">
        <p className="font-display text-2xl font-bold">EverRedi</p>
        <p className="mt-1 truncate text-xs text-ink/60">
          {workspace?.name ?? 'No workspace selected'}
        </p>
        <nav className="mt-8 flex flex-col gap-1">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-2 text-sm ${
                  active ? 'bg-white font-semibold text-accent shadow-sm' : 'text-ink/80 hover:bg-white/60'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
