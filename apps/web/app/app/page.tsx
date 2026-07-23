'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { getApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace-store';

export default function DashboardPage() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const workspaceId = workspace?.id;

  const kits = useQuery({
    queryKey: ['kits', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => getApi().kits.list(workspaceId!),
  });
  const expiring = useQuery({
    queryKey: ['expiring', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => getApi().inventory.expiring(workspaceId!),
  });
  const lowStock = useQuery({
    queryKey: ['low-stock', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => getApi().inventory.lowStock(workspaceId!),
  });

  return (
    <main>
      <h1 className="font-display text-3xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-ink/70">Your kits, expirations, and stock at a glance.</p>
      {!workspaceId ? (
        <p className="mt-8 text-sm">
          Sign in and sync a workspace from the{' '}
          <Link className="text-accent underline" href="/login">
            login page
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Stat label="Kits" value={kits.data?.length ?? 0} href="/app/kits" />
          <Stat label="Expiring soon" value={expiring.data?.length ?? 0} href="/app/alerts" />
          <Stat label="Low stock" value={lowStock.data?.length ?? 0} href="/app/alerts" />
        </div>
      )}
    </main>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-ink/10 bg-white/80 p-5 shadow-sm">
      <p className="text-sm text-ink/60">{label}</p>
      <p className="mt-2 font-display text-4xl font-semibold">{value}</p>
    </Link>
  );
}
