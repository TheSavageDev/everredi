'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace-store';

export default function KitsPage() {
  const workspaceId = useWorkspaceStore((s) => s.workspace?.id);
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const kits = useQuery({
    queryKey: ['kits', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => getApi().kits.list(workspaceId!),
  });
  const create = useMutation({
    mutationFn: () => getApi().kits.create(workspaceId!, { name }),
    onSuccess: () => {
      setName('');
      void qc.invalidateQueries({ queryKey: ['kits', workspaceId] });
    },
  });

  return (
    <main>
      <h1 className="font-display text-3xl font-semibold">Kits</h1>
      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <input
          className="flex-1 rounded-md border border-ink/15 bg-white px-3 py-2"
          placeholder="New kit name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white" type="submit">
          Add kit
        </button>
      </form>
      <ul className="mt-6 space-y-2">
        {(kits.data ?? []).map((kit) => (
          <li key={kit.id} className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3">
            <p className="font-medium">{kit.name}</p>
            <p className="text-xs text-ink/60">{kit.status}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
