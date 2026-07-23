'use client';

import { useQuery } from '@tanstack/react-query';
import { getApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace-store';

export default function AlertsPage() {
  const workspaceId = useWorkspaceStore((s) => s.workspace?.id);
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
  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getApi().notifications.list(),
  });

  return (
    <main className="space-y-8">
      <h1 className="font-display text-3xl font-semibold">Alerts</h1>
      <section>
        <h2 className="font-semibold">Expiring soon</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {(expiring.data ?? []).map((i) => (
            <li key={i.id}>
              {i.supplyName} · {i.expirationDate?.slice(0, 10)}
            </li>
          ))}
          {(expiring.data ?? []).length === 0 ? <li className="text-ink/60">None</li> : null}
        </ul>
      </section>
      <section>
        <h2 className="font-semibold">Low stock</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {(lowStock.data ?? []).map((i) => (
            <li key={i.id}>
              {i.supplyName} · {i.actualQuantity ?? 0}/{i.requiredQuantity ?? 0}
            </li>
          ))}
          {(lowStock.data ?? []).length === 0 ? <li className="text-ink/60">None</li> : null}
        </ul>
      </section>
      <section>
        <h2 className="font-semibold">Notifications</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {(notifications.data ?? []).map((n) => (
            <li key={n.id}>
              {n.title}: {n.message}
            </li>
          ))}
          {(notifications.data ?? []).length === 0 ? <li className="text-ink/60">None</li> : null}
        </ul>
      </section>
    </main>
  );
}
