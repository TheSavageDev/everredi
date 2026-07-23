'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace-store';

export default function InventoryPage() {
  const workspaceId = useWorkspaceStore((s) => s.workspace?.id);
  const qc = useQueryClient();
  const [supplyName, setSupplyName] = useState('');
  const [actualQuantity, setActualQuantity] = useState('1');
  const items = useQuery({
    queryKey: ['inventory', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => getApi().inventory.list(workspaceId!),
  });
  const create = useMutation({
    mutationFn: () =>
      getApi().inventory.create(workspaceId!, {
        freeformName: supplyName,
        supplyName,
        actualQuantity: Number(actualQuantity) || 0,
        requiredQuantity: Number(actualQuantity) || 0,
      }),
    onSuccess: () => {
      setSupplyName('');
      void qc.invalidateQueries({ queryKey: ['inventory', workspaceId] });
    },
  });

  return (
    <main>
      <h1 className="font-display text-3xl font-semibold">Inventory</h1>
      <form
        className="mt-6 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (supplyName.trim()) create.mutate();
        }}
      >
        <input
          className="min-w-[200px] flex-1 rounded-md border border-ink/15 bg-white px-3 py-2"
          placeholder="Item name"
          value={supplyName}
          onChange={(e) => setSupplyName(e.target.value)}
        />
        <input
          className="w-24 rounded-md border border-ink/15 bg-white px-3 py-2"
          type="number"
          min={0}
          value={actualQuantity}
          onChange={(e) => setActualQuantity(e.target.value)}
        />
        <button className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white" type="submit">
          Add item
        </button>
      </form>
      <ul className="mt-6 space-y-2">
        {(items.data ?? []).map((item) => (
          <li key={item.id} className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3">
            <p className="font-medium">{item.supplyName}</p>
            <p className="text-xs text-ink/60">
              {item.actualQuantity ?? 0}/{item.requiredQuantity ?? 0} · {item.status}
              {item.expirationDate ? ` · exp ${item.expirationDate.slice(0, 10)}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
